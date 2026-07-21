package com.shiftpay.mvp.service;

import com.shiftpay.mvp.dto.CreateShiftRequest;
import com.shiftpay.mvp.dto.ShiftCloseResponse;
import com.shiftpay.mvp.dto.ShiftCreateResponse;
import com.shiftpay.mvp.dto.ShiftResponse;
import com.shiftpay.mvp.dto.ShiftStartResponse;
import com.shiftpay.mvp.dto.ShiftSummaryResponse;
import com.shiftpay.mvp.dto.WorkerSummaryResponse;
import com.shiftpay.mvp.entity.AttendanceStatus;
import com.shiftpay.mvp.entity.Company;
import com.shiftpay.mvp.entity.Role;
import com.shiftpay.mvp.entity.ShiftAttendance;
import com.shiftpay.mvp.entity.ShiftSession;
import com.shiftpay.mvp.entity.ShiftStatus;
import com.shiftpay.mvp.entity.User;
import com.shiftpay.mvp.exception.BadRequestException;
import com.shiftpay.mvp.exception.ForbiddenException;
import com.shiftpay.mvp.exception.ShiftNotFoundException;
import com.shiftpay.mvp.exception.ShiftStateConflictException;
import com.shiftpay.mvp.repository.CompanyRepository;
import com.shiftpay.mvp.repository.ShiftAttendanceRepository;
import com.shiftpay.mvp.repository.ShiftSessionRepository;
import com.shiftpay.mvp.repository.UserRepository;
import com.shiftpay.mvp.security.AuthenticatedUserPrincipal;
import com.shiftpay.mvp.security.JwtAuthenticationException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.security.SecureRandom;
import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.LocalDateTime;
import java.time.OffsetDateTime;
import java.time.ZoneOffset;
import java.util.List;
import java.util.Objects;

/**
 * Business service for shift lifecycle and closed-shift salary summaries.
 *
 * <p>It creates shifts, starts and closes them with pessimistic locks, calculates salary for approved attendance on
 * close, reads managed-shift lists for the current creator, and reads persisted summary data without recalculating
 * salary. Foreman ownership and admin access are enforced here in addition to route-level role checks.</p>
 */
@Service
public class ShiftSessionService {

	private static final String DEFAULT_COMPANY_NAME = "Default Company";
	private static final char[] JOIN_CODE_CHARS = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789".toCharArray();
	private static final int JOIN_CODE_LENGTH = 6;
	private static final int JOIN_CODE_MAX_ATTEMPTS = 20;

	private final CompanyRepository companyRepository;
	private final ShiftAttendanceRepository shiftAttendanceRepository;
	private final ShiftSessionRepository shiftSessionRepository;
	private final UserRepository userRepository;
	private final SalaryCalculationService salaryCalculationService;
	private final SecureRandom secureRandom;

	/**
	 * Creates the service with repositories, salary service, and secure join code generation.
	 *
	 * @param companyRepository company repository used for the MVP default company
	 * @param shiftAttendanceRepository attendance repository used for close and summary data
	 * @param shiftSessionRepository shift repository used for lifecycle persistence and locks
	 * @param userRepository user repository used to resolve the authenticated creator
	 * @param salaryCalculationService salary calculation service used on close
	 */
	public ShiftSessionService(
			CompanyRepository companyRepository,
			ShiftAttendanceRepository shiftAttendanceRepository,
			ShiftSessionRepository shiftSessionRepository,
			UserRepository userRepository,
			SalaryCalculationService salaryCalculationService
	) {
		this.companyRepository = companyRepository;
		this.shiftAttendanceRepository = shiftAttendanceRepository;
		this.shiftSessionRepository = shiftSessionRepository;
		this.userRepository = userRepository;
		this.salaryCalculationService = salaryCalculationService;
		this.secureRandom = new SecureRandom();
	}

	/**
	 * Creates an OPEN shift for a foreman or admin.
	 *
	 * <p>The method validates planned time ordering, creates or reuses the default company, trims text fields,
	 * generates a unique join code, stores default break minutes and default hourly rate, and records the creator.</p>
	 *
	 * @param request shift creation request
	 * @param principal authenticated foreman or admin principal
	 * @return created shift response
	 */
	@Transactional
	public ShiftCreateResponse createShift(CreateShiftRequest request, AuthenticatedUserPrincipal principal) {
		validatePlannedTimeOrder(request.plannedStartTime(), request.plannedEndTime());

		User createdBy = userRepository.findById(principal.id())
				.orElseThrow(() -> new JwtAuthenticationException("Authenticated user not found"));

		ShiftSession shiftSession = new ShiftSession();
		shiftSession.setCompany(getOrCreateDefaultCompany());
		shiftSession.setTitle(request.title().trim());
		shiftSession.setLocation(trimToNull(request.location()));
		shiftSession.setJoinCode(generateUniqueJoinCode());
		shiftSession.setStatus(ShiftStatus.OPEN);
		shiftSession.setPlannedStartTime(toUtcOffsetDateTime(request.plannedStartTime()));
		shiftSession.setPlannedEndTime(toUtcOffsetDateTime(request.plannedEndTime()));
		shiftSession.setDefaultBreakMinutes(request.defaultBreakMinutes() == null ? 0 : request.defaultBreakMinutes());
		shiftSession.setDefaultHourlyRate(request.defaultHourlyRate());
		shiftSession.setCreatedBy(createdBy);

		return ShiftCreateResponse.from(shiftSessionRepository.save(shiftSession));
	}

	/**
	 * Reads a shift by id for an owner foreman or admin.
	 *
	 * @param shiftId shift session id
	 * @param principal authenticated foreman or admin principal
	 * @return shift details response
	 */
	@Transactional(readOnly = true)
	public ShiftResponse getShift(Long shiftId, AuthenticatedUserPrincipal principal) {
		ShiftSession shiftSession = shiftSessionRepository.findById(shiftId)
				.orElseThrow(ShiftNotFoundException::new);

		validateShiftAccess(shiftSession, principal);
		return ShiftResponse.from(shiftSession);
	}

	/**
	 * Lists shifts created by the current foreman or admin for their managed-shifts dashboard.
	 *
	 * <p>The method does not recalculate salary or include worker attendance. The repository returns rows ordered by
	 * createdAt descending and id descending for stable newest-first results.</p>
	 *
	 * @param principal authenticated foreman or admin principal
	 * @return shift responses for shifts created by the current user
	 */
	@Transactional(readOnly = true)
	public List<ShiftResponse> getMyManagedShifts(AuthenticatedUserPrincipal principal) {
		return shiftSessionRepository.findManagedShiftsByCreatedById(principal.id()).stream()
				.map(ShiftResponse::from)
				.toList();
	}

	/**
	 * Starts an OPEN shift and records the actual start time in UTC.
	 *
	 * <p>The shift row is locked so concurrent joins, approvals, starts, and closes see a consistent lifecycle state.</p>
	 *
	 * @param shiftId shift session id
	 * @param principal authenticated owner foreman or admin principal
	 * @return start response with actual start time
	 */
	@Transactional
	public ShiftStartResponse startShift(Long shiftId, AuthenticatedUserPrincipal principal) {
		ShiftSession shiftSession = shiftSessionRepository.findByIdForUpdate(shiftId)
				.orElseThrow(ShiftNotFoundException::new);

		validateShiftAccess(shiftSession, principal);
		if (shiftSession.getStatus() != ShiftStatus.OPEN) {
			throw new ShiftStateConflictException("Shift can only be started when status is OPEN");
		}

		shiftSession.setStatus(ShiftStatus.ACTIVE);
		shiftSession.setActualStartTime(OffsetDateTime.now(ZoneOffset.UTC));
		return ShiftStartResponse.from(shiftSession);
	}

	/**
	 * Closes an ACTIVE shift, records actual end time, and persists salary results.
	 *
	 * <p>The method locks the shift and all attendance rows. Only APPROVED attendance receives worked minutes and
	 * calculated salary; JOINED, REJECTED, and CANCELLED attendance salary fields are cleared. Any salary validation
	 * failure rolls back the transaction so the shift remains ACTIVE.</p>
	 *
	 * @param shiftId shift session id
	 * @param principal authenticated owner foreman or admin principal
	 * @return close response with actual end time
	 */
	@Transactional
	public ShiftCloseResponse closeShift(Long shiftId, AuthenticatedUserPrincipal principal) {
		ShiftSession shiftSession = shiftSessionRepository.findByIdForUpdate(shiftId)
				.orElseThrow(ShiftNotFoundException::new);

		validateShiftAccess(shiftSession, principal);
		if (shiftSession.getStatus() != ShiftStatus.ACTIVE) {
			throw new ShiftStateConflictException("Shift can only be closed when status is ACTIVE");
		}

		OffsetDateTime actualEndTime = OffsetDateTime.now(ZoneOffset.UTC);
		long durationMinutes = salaryCalculationService.calculateDurationMinutes(
				shiftSession.getActualStartTime(),
				actualEndTime
		);

		for (ShiftAttendance attendance : shiftAttendanceRepository.findAllByShiftSessionIdForUpdate(shiftId)) {
			if (attendance.getStatus() == AttendanceStatus.APPROVED) {
				SalaryCalculationService.SalaryCalculationResult salary = salaryCalculationService.calculate(
						durationMinutes,
						attendance.getBreakMinutes(),
						attendance.getHourlyRate()
				);
				attendance.setWorkedMinutes(salary.workedMinutes());
				attendance.setCalculatedSalary(salary.calculatedSalary());
			}
			else {
				attendance.setWorkedMinutes(null);
				attendance.setCalculatedSalary(null);
			}
		}

		shiftSession.setStatus(ShiftStatus.CLOSED);
		shiftSession.setActualEndTime(actualEndTime);
		return ShiftCloseResponse.from(shiftSession);
	}

	/**
	 * Builds the salary summary for a CLOSED shift.
	 *
	 * <p>The summary reads persisted attendance salary fields and does not recalculate salary. It includes only
	 * approved attendance and fails if any approved attendance is missing close-time salary data.</p>
	 *
	 * @param shiftId shift session id
	 * @param principal authenticated owner foreman or admin principal
	 * @return closed shift summary response
	 */
	@Transactional(readOnly = true)
	public ShiftSummaryResponse getShiftSummary(Long shiftId, AuthenticatedUserPrincipal principal) {
		ShiftSession shiftSession = shiftSessionRepository.findById(shiftId)
				.orElseThrow(ShiftNotFoundException::new);

		validateShiftAccess(shiftSession, principal);
		if (shiftSession.getStatus() != ShiftStatus.CLOSED) {
			throw new ShiftStateConflictException("Shift summary is available only for CLOSED shifts");
		}

		List<WorkerSummaryResponse> workers = shiftAttendanceRepository
				.findApprovedByShiftSessionIdWithWorkerOrderByWorkerName(shiftId)
				.stream()
				.map(this::toWorkerSummary)
				.toList();

		BigDecimal totalSalary = workers.stream()
				.map(WorkerSummaryResponse::salary)
				.reduce(BigDecimal.ZERO, BigDecimal::add)
				.setScale(2, RoundingMode.HALF_UP);

		return new ShiftSummaryResponse(
				shiftSession.getId(),
				shiftSession.getStatus(),
				workers.size(),
				totalSalary,
				workers
		);
	}

	/**
	 * Maps one approved attendance row to a worker summary row.
	 *
	 * @param attendance approved attendance with worker already fetched
	 * @return worker summary response
	 */
	private WorkerSummaryResponse toWorkerSummary(ShiftAttendance attendance) {
		if (attendance.getWorkedMinutes() == null || attendance.getCalculatedSalary() == null) {
			throw new ShiftStateConflictException("Approved attendance has incomplete salary calculation");
		}

		return new WorkerSummaryResponse(
				attendance.getId(),
				attendance.getWorker().getId(),
				attendance.getWorker().getFirstName(),
				attendance.getWorker().getLastName(),
				attendance.getWorkedMinutes(),
				attendance.getHourlyRate(),
				attendance.getCalculatedSalary().setScale(2, RoundingMode.HALF_UP)
		);
	}

	/**
	 * Verifies that the principal may manage or read the shift.
	 *
	 * @param shiftSession shift being accessed
	 * @param principal authenticated foreman or admin principal
	 */
	private void validateShiftAccess(ShiftSession shiftSession, AuthenticatedUserPrincipal principal) {
		if (principal.role() == Role.ADMIN) {
			return;
		}
		if (principal.role() == Role.FOREMAN
				&& Objects.equals(shiftSession.getCreatedBy().getId(), principal.id())) {
			return;
		}
		throw new ForbiddenException();
	}

	/**
	 * Returns the default company used by the MVP, creating it if needed.
	 *
	 * @return default company entity
	 */
	private Company getOrCreateDefaultCompany() {
		return companyRepository.findFirstByName(DEFAULT_COMPANY_NAME)
				.orElseGet(() -> {
					Company company = new Company();
					company.setName(DEFAULT_COMPANY_NAME);
					return companyRepository.save(company);
				});
	}

	/**
	 * Generates a join code that is not already used by another shift.
	 *
	 * @return unique join code
	 */
	private String generateUniqueJoinCode() {
		for (int attempt = 0; attempt < JOIN_CODE_MAX_ATTEMPTS; attempt++) {
			String joinCode = generateJoinCode();
			if (!shiftSessionRepository.existsByJoinCode(joinCode)) {
				return joinCode;
			}
		}
		throw new IllegalStateException("Failed to generate unique join code");
	}

	/**
	 * Generates one random six-character join code candidate.
	 *
	 * @return join code candidate
	 */
	private String generateJoinCode() {
		StringBuilder joinCode = new StringBuilder(JOIN_CODE_LENGTH);
		for (int index = 0; index < JOIN_CODE_LENGTH; index++) {
			joinCode.append(JOIN_CODE_CHARS[secureRandom.nextInt(JOIN_CODE_CHARS.length)]);
		}
		return joinCode.toString();
	}

	/**
	 * Validates that the planned end is after the planned start when both are provided.
	 *
	 * @param plannedStartTime planned start time from the request
	 * @param plannedEndTime planned end time from the request
	 */
	private void validatePlannedTimeOrder(LocalDateTime plannedStartTime, LocalDateTime plannedEndTime) {
		if (plannedStartTime != null && plannedEndTime != null && !plannedEndTime.isAfter(plannedStartTime)) {
			throw new BadRequestException("plannedEndTime must be after plannedStartTime");
		}
	}

	/**
	 * Converts local request timestamps to UTC offset timestamps for persistence.
	 *
	 * @param value request timestamp value
	 * @return UTC offset timestamp, or null
	 */
	private OffsetDateTime toUtcOffsetDateTime(LocalDateTime value) {
		return value == null ? null : value.atOffset(ZoneOffset.UTC);
	}

	/**
	 * Trims optional text values and stores blank text as null.
	 *
	 * @param value optional request text
	 * @return trimmed value, or null when blank
	 */
	private String trimToNull(String value) {
		if (value == null || value.isBlank()) {
			return null;
		}
		return value.trim();
	}
}
