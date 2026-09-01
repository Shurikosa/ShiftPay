package com.shiftpay.mvp.service;

import com.shiftpay.mvp.dto.CreateShiftRequest;
import com.shiftpay.mvp.dto.PauseStateResponse;
import com.shiftpay.mvp.dto.ShiftCloseRequest;
import com.shiftpay.mvp.dto.ShiftCloseResponse;
import com.shiftpay.mvp.dto.ShiftCreateResponse;
import com.shiftpay.mvp.dto.ShiftResponse;
import com.shiftpay.mvp.dto.ShiftStartResponse;
import com.shiftpay.mvp.dto.ShiftSummaryResponse;
import com.shiftpay.mvp.dto.WorkerSummaryResponse;
import com.shiftpay.mvp.entity.AttendanceStatus;
import com.shiftpay.mvp.entity.Company;
import com.shiftpay.mvp.entity.PaymentStatus;
import com.shiftpay.mvp.entity.Role;
import com.shiftpay.mvp.entity.ShiftAttendance;
import com.shiftpay.mvp.entity.ShiftPauseInterval;
import com.shiftpay.mvp.entity.ShiftSession;
import com.shiftpay.mvp.entity.ShiftStatus;
import com.shiftpay.mvp.entity.User;
import com.shiftpay.mvp.exception.CompanyConflictException;
import com.shiftpay.mvp.exception.ForbiddenException;
import com.shiftpay.mvp.exception.ShortShiftRequiresDecisionException;
import com.shiftpay.mvp.exception.ShiftNotFoundException;
import com.shiftpay.mvp.exception.ShiftStateConflictException;
import com.shiftpay.mvp.repository.ShiftAttendanceRepository;
import com.shiftpay.mvp.repository.ShiftPauseIntervalRepository;
import com.shiftpay.mvp.repository.ShiftSessionRepository;
import com.shiftpay.mvp.repository.UserRepository;
import com.shiftpay.mvp.security.AuthenticatedUserPrincipal;
import com.shiftpay.mvp.security.JwtAuthenticationException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.security.SecureRandom;
import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.OffsetDateTime;
import java.time.ZoneId;
import java.time.ZoneOffset;
import java.time.format.DateTimeFormatter;
import java.util.List;
import java.util.Locale;
import java.util.Objects;

/**
 * Business service for shift lifecycle and closed-shift salary summaries.
 *
 * <p>It creates shifts, starts, cancels, and closes them with pessimistic locks, calculates salary for approved attendance on
 * close, reads managed-shift lists for the current creator, and reads persisted summary data without recalculating
 * salary. Foreman ownership and admin read access are enforced here in addition to route-level role checks.</p>
 */
@Service
public class ShiftSessionService {

	private static final ZoneId TITLE_ZONE = ZoneId.of("Europe/Berlin");
	private static final DateTimeFormatter TITLE_FORMATTER = DateTimeFormatter.ofPattern(
			"EEEE HH:mm",
			Locale.ENGLISH
	);
	private static final char[] JOIN_CODE_CHARS = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789".toCharArray();
	private static final int SHORT_SHIFT_MINIMUM_MINUTES = 15;
	private static final String SHORT_SHIFT_DISCARD_REASON = "SHORT_SHIFT_NOT_SAVED";
	private static final int JOIN_CODE_LENGTH = 6;
	private static final int JOIN_CODE_MAX_ATTEMPTS = 20;

	private final ShiftAttendanceRepository shiftAttendanceRepository;
	private final ShiftPauseIntervalRepository shiftPauseIntervalRepository;
	private final ShiftSessionRepository shiftSessionRepository;
	private final UserRepository userRepository;
	private final PauseCalculationService pauseCalculationService;
	private final PauseViewFactory pauseViewFactory;
	private final SalaryCalculationService salaryCalculationService;
	private final SecureRandom secureRandom;

	/**
	 * Creates the service with repositories, salary service, and secure join code generation.
	 *
	 * @param shiftAttendanceRepository attendance repository used for close and summary data
	 * @param shiftPauseIntervalRepository pause repository used for pause state and salary deductions
	 * @param shiftSessionRepository shift repository used for lifecycle persistence and locks
	 * @param userRepository user repository used to resolve the authenticated creator
	 * @param pauseCalculationService service used to calculate union pause minutes
	 * @param pauseViewFactory factory used to build mobile pause state fragments
	 * @param salaryCalculationService salary calculation service used on close
	 */
	public ShiftSessionService(
			ShiftAttendanceRepository shiftAttendanceRepository,
			ShiftPauseIntervalRepository shiftPauseIntervalRepository,
			ShiftSessionRepository shiftSessionRepository,
			UserRepository userRepository,
			PauseCalculationService pauseCalculationService,
			PauseViewFactory pauseViewFactory,
			SalaryCalculationService salaryCalculationService
	) {
		this.shiftAttendanceRepository = shiftAttendanceRepository;
		this.shiftPauseIntervalRepository = shiftPauseIntervalRepository;
		this.shiftSessionRepository = shiftSessionRepository;
		this.userRepository = userRepository;
		this.pauseCalculationService = pauseCalculationService;
		this.pauseViewFactory = pauseViewFactory;
		this.salaryCalculationService = salaryCalculationService;
		this.secureRandom = new SecureRandom();
	}

	/**
	 * Creates an OPEN shift for a foreman.
	 *
	 * <p>The method requires the creator to have a company, generates the MVP title and a unique join code, stores
	 * default worker and foreman rates, and records the creator. Planned times are no longer accepted by the mobile
	 * contract; actual times are set only by start and close.</p>
	 *
	 * @param request shift creation request
	 * @param principal authenticated foreman principal
	 * @return created shift response
	 */
	@Transactional
	public ShiftCreateResponse createShift(CreateShiftRequest request, AuthenticatedUserPrincipal principal) {
		User createdBy = userRepository.findWithCompanyById(principal.id())
				.orElseThrow(() -> new JwtAuthenticationException("Authenticated user not found"));
		Company company = createdBy.getCompany();
		if (company == null) {
			throw new CompanyConflictException("Foreman must create a company before creating shifts");
		}

		ShiftSession shiftSession = new ShiftSession();
		shiftSession.setCompany(company);
		shiftSession.setTitle(generateTitle(OffsetDateTime.now(ZoneOffset.UTC), company));
		shiftSession.setLocation(trimToNull(request.location()));
		shiftSession.setJoinCode(generateUniqueJoinCode());
		shiftSession.setStatus(ShiftStatus.OPEN);
		shiftSession.setDefaultBreakMinutes(request.defaultBreakMinutes() == null ? 0 : request.defaultBreakMinutes());
		shiftSession.setDefaultHourlyRate(request.defaultHourlyRate());
		shiftSession.setForemanHourlyRate(request.foremanHourlyRate());
		shiftSession.setCreatedBy(createdBy);

		return ShiftCreateResponse.from(
				shiftSessionRepository.save(shiftSession),
				shouldIncludePrivateForemanFields(shiftSession, principal)
		);
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
		ShiftSession shiftSession = shiftSessionRepository.findByIdWithCompanyAndCreatedBy(shiftId)
				.orElseThrow(ShiftNotFoundException::new);

		validateShiftAccess(shiftSession, principal);
		boolean includePrivateForemanFields = shouldIncludePrivateForemanFields(shiftSession, principal);
		PauseStateResponse pauseState = pauseViewFactory.forUser(
				shiftSession,
				shiftPauseIntervalRepository.findAllByShiftSessionId(shiftId),
				includePrivateForemanFields ? principal.id() : null,
				includePrivateForemanFields ? shiftSession.getForemanPauseMinutes() : null
		);
		return ShiftResponse.from(
				shiftSession,
				includePrivateForemanFields,
				pauseState
		);
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
		List<ShiftSession> shiftSessions = shiftSessionRepository.findManagedShiftsByCreatedById(principal.id());
		List<Long> shiftIds = shiftSessions.stream().map(ShiftSession::getId).toList();
		List<ShiftPauseInterval> pauseIntervals = shiftIds.isEmpty()
				? List.of()
				: shiftPauseIntervalRepository.findAllByShiftSessionIdIn(shiftIds);
		return shiftSessions.stream()
				.map((shiftSession) -> {
					boolean includePrivateForemanFields = shouldIncludePrivateForemanFields(shiftSession, principal);
					List<ShiftPauseInterval> intervals = pauseIntervals.stream()
							.filter((pauseInterval) -> Objects.equals(
									pauseInterval.getShiftSession().getId(),
									shiftSession.getId()
							))
							.toList();
					return ShiftResponse.from(
							shiftSession,
							includePrivateForemanFields,
							pauseViewFactory.forUser(
									shiftSession,
									intervals,
									includePrivateForemanFields ? principal.id() : null,
									includePrivateForemanFields ? shiftSession.getForemanPauseMinutes() : null
							)
					);
				})
				.toList();
	}

	/**
	 * Starts an OPEN shift and records the actual start time in UTC.
	 *
	 * <p>The shift row is locked so concurrent joins, approvals, starts, and closes see a consistent lifecycle state.</p>
	 *
	 * @param shiftId shift session id
	 * @param principal authenticated owner foreman principal
	 * @return start response with actual start time
	 */
	@Transactional
	public ShiftStartResponse startShift(Long shiftId, AuthenticatedUserPrincipal principal) {
		ShiftSession shiftSession = shiftSessionRepository.findByIdForUpdate(shiftId)
				.orElseThrow(ShiftNotFoundException::new);

		validateShiftAccess(shiftSession, principal);
		validateForemanCompanyConsistency(shiftSession, principal);
		if (shiftSession.getStatus() != ShiftStatus.OPEN) {
			throw new ShiftStateConflictException("Shift can only be started when status is OPEN");
		}

		shiftSession.setStatus(ShiftStatus.ACTIVE);
		shiftSession.setActualStartTime(OffsetDateTime.now(ZoneOffset.UTC));
		return ShiftStartResponse.from(shiftSession);
	}

	/**
	 * Cancels an OPEN shift before it starts.
	 *
	 * <p>The shift row is locked so cancel serializes with start, close, join, and approval. Cancelling never writes
	 * actual times or salary fields.</p>
	 *
	 * @param shiftId shift session id
	 * @param principal authenticated owner foreman principal
	 * @return cancelled shift response
	 */
	@Transactional
	public ShiftResponse cancelShift(Long shiftId, AuthenticatedUserPrincipal principal) {
		ShiftSession shiftSession = shiftSessionRepository.findByIdForUpdate(shiftId)
				.orElseThrow(ShiftNotFoundException::new);

		validateOwnerForemanAccess(shiftSession, principal);
		validateForemanCompanyConsistency(shiftSession, principal);
		if (shiftSession.getStatus() != ShiftStatus.OPEN) {
			throw new ShiftStateConflictException("Shift can only be cancelled before it starts");
		}

		shiftSession.setStatus(ShiftStatus.CANCELLED);
		return ShiftResponse.from(shiftSession, shouldIncludePrivateForemanFields(shiftSession, principal));
	}

	/**
	 * Discards an ACTIVE short shift after the owner foreman chooses not to save it.
	 *
	 * @param shiftId shift session id
	 * @param principal authenticated owner foreman principal
	 * @return discarded shift response
	 */
	@Transactional
	public ShiftResponse discardShift(Long shiftId, AuthenticatedUserPrincipal principal) {
		ShiftSession shiftSession = shiftSessionRepository.findByIdForUpdate(shiftId)
				.orElseThrow(ShiftNotFoundException::new);

		validateOwnerForemanAccess(shiftSession, principal);
		validateForemanCompanyConsistency(shiftSession, principal);
		if (shiftSession.getStatus() != ShiftStatus.ACTIVE) {
			throw new ShiftStateConflictException("Shift can only be discarded when status is ACTIVE");
		}

		OffsetDateTime discardedAt = OffsetDateTime.now(ZoneOffset.UTC);
		long durationMinutes = salaryCalculationService.calculateDurationMinutes(
				shiftSession.getActualStartTime(),
				discardedAt
		);
		if (!isShortShift(durationMinutes)) {
			throw new ShiftStateConflictException("Only shifts shorter than 15 minutes can be discarded");
		}

		User discardedBy = userRepository.findById(principal.id())
				.orElseThrow(() -> new JwtAuthenticationException("Authenticated user not found"));
		List<ShiftPauseInterval> pauseIntervals = shiftPauseIntervalRepository.findAllByShiftSessionIdForUpdate(shiftId);
		for (ShiftPauseInterval pauseInterval : pauseIntervals) {
			if (pauseInterval.getEndedAt() == null) {
				pauseInterval.setEndedAt(discardedAt);
			}
		}
		clearPayrollForDiscardedShift(shiftSession);
		shiftSession.setStatus(ShiftStatus.DISCARDED);
		shiftSession.setActualEndTime(discardedAt);
		shiftSession.setDiscardedAt(discardedAt);
		shiftSession.setDiscardedBy(discardedBy);
		shiftSession.setDiscardReason(SHORT_SHIFT_DISCARD_REASON);
		return ShiftResponse.from(shiftSession, shouldIncludePrivateForemanFields(shiftSession, principal));
	}

	/**
	 * Closes an ACTIVE shift, records actual end time, and persists salary results.
	 *
	 * <p>The method locks the shift and all attendance rows. Only APPROVED attendance receives worked minutes and
	 * calculated salary; JOINED, REJECTED, and CANCELLED attendance salary fields are cleared. Any salary validation
	 * failure rolls back the transaction so the shift remains ACTIVE.</p>
	 *
	 * @param shiftId shift session id
	 * @param request optional close request with short-shift save decision
	 * @param principal authenticated owner foreman principal
	 * @return close response with actual end time
	 */
	@Transactional
	public ShiftCloseResponse closeShift(
			Long shiftId,
			ShiftCloseRequest request,
			AuthenticatedUserPrincipal principal
	) {
		ShiftSession shiftSession = shiftSessionRepository.findByIdForUpdate(shiftId)
				.orElseThrow(ShiftNotFoundException::new);

		validateShiftAccess(shiftSession, principal);
		validateForemanCompanyConsistency(shiftSession, principal);
		if (shiftSession.getStatus() != ShiftStatus.ACTIVE) {
			throw new ShiftStateConflictException("Shift can only be closed when status is ACTIVE");
		}

		OffsetDateTime actualEndTime = OffsetDateTime.now(ZoneOffset.UTC);
		long durationMinutes = salaryCalculationService.calculateDurationMinutes(
				shiftSession.getActualStartTime(),
				actualEndTime
		);
		boolean shouldSaveShortShift = request != null && request.shouldSaveShortShift();
		if (isShortShift(durationMinutes) && !shouldSaveShortShift) {
			throw new ShortShiftRequiresDecisionException(durationMinutes, SHORT_SHIFT_MINIMUM_MINUTES);
		}
		List<ShiftAttendance> attendanceRows = shiftAttendanceRepository.findAllByShiftSessionIdForUpdate(shiftId);
		List<ShiftPauseInterval> pauseIntervals = shiftPauseIntervalRepository.findAllByShiftSessionIdForUpdate(shiftId);
		for (ShiftPauseInterval pauseInterval : pauseIntervals) {
			if (pauseInterval.getEndedAt() == null) {
				pauseInterval.setEndedAt(actualEndTime);
			}
		}
		int foremanPauseMinutes = pauseCalculationService.calculateEffectivePauseMinutes(
				pauseIntervals,
				shiftSession.getCreatedBy().getId(),
				shiftSession.getActualStartTime(),
				actualEndTime
		);
		SalaryCalculationService.SalaryCalculationResult foremanSalary = salaryCalculationService.calculate(
				durationMinutes,
				shiftSession.getDefaultBreakMinutes(),
				foremanPauseMinutes,
				shiftSession.getForemanHourlyRate(),
				"foremanHourlyRate"
		);

		for (ShiftAttendance attendance : attendanceRows) {
			if (attendance.getStatus() == AttendanceStatus.APPROVED) {
				OffsetDateTime workerPayableStart = workerPayableStart(shiftSession, attendance);
				long workerDurationMinutes = salaryCalculationService.calculateDurationMinutes(
						workerPayableStart,
						actualEndTime
				);
				int pauseMinutes = pauseCalculationService.calculateEffectivePauseMinutes(
						pauseIntervals,
						attendance.getWorker().getId(),
						workerPayableStart,
						actualEndTime
				);
				SalaryCalculationService.SalaryCalculationResult salary = salaryCalculationService.calculate(
						workerDurationMinutes,
						attendance.getBreakMinutes(),
						pauseMinutes,
						attendance.getHourlyRate()
				);
				attendance.setPauseMinutes(pauseMinutes);
				attendance.setWorkedMinutes(salary.workedMinutes());
				attendance.setCalculatedSalary(salary.calculatedSalary());
				attendance.setPaymentStatus(PaymentStatus.UNPAID);
				attendance.setPaidAt(null);
			}
			else {
				attendance.setPauseMinutes(null);
				attendance.setWorkedMinutes(null);
				attendance.setCalculatedSalary(null);
				attendance.setPaymentStatus(PaymentStatus.UNPAID);
				attendance.setPaidAt(null);
			}
		}

		shiftSession.setForemanWorkedMinutes(foremanSalary.workedMinutes());
		shiftSession.setForemanPauseMinutes(foremanPauseMinutes);
		shiftSession.setForemanCalculatedSalary(foremanSalary.calculatedSalary());
		shiftSession.setStatus(ShiftStatus.CLOSED);
		shiftSession.setActualEndTime(actualEndTime);
		return ShiftCloseResponse.from(shiftSession);
	}

	/**
	 * Closes an ACTIVE shift without a short-shift override.
	 *
	 * @param shiftId shift session id
	 * @param principal authenticated owner foreman principal
	 * @return close response with actual end time
	 */
	public ShiftCloseResponse closeShift(Long shiftId, AuthenticatedUserPrincipal principal) {
		return closeShift(shiftId, null, principal);
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
		ShiftSession shiftSession = shiftSessionRepository.findByIdWithCompanyAndCreatedBy(shiftId)
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
		boolean includePrivateForemanFields = shouldIncludePrivateForemanFields(shiftSession, principal);

		return new ShiftSummaryResponse(
				shiftSession.getId(),
				shiftSession.getStatus(),
				workers.size(),
				totalSalary,
				includePrivateForemanFields ? shiftSession.getForemanWorkedMinutes() : null,
				includePrivateForemanFields ? shiftSession.getForemanPauseMinutes() : null,
				includePrivateForemanFields ? shiftSession.getForemanHourlyRate() : null,
				includePrivateForemanFields ? privateForemanSalary(shiftSession) : null,
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
				attendance.getPauseMinutes(),
				attendance.getHourlyRate(),
				attendance.getCalculatedSalary().setScale(2, RoundingMode.HALF_UP)
		);
	}

	private void clearPayrollForDiscardedShift(ShiftSession shiftSession) {
		shiftSession.setForemanWorkedMinutes(null);
		shiftSession.setForemanPauseMinutes(null);
		shiftSession.setForemanCalculatedSalary(null);
		for (ShiftAttendance attendance : shiftAttendanceRepository.findAllByShiftSessionIdForUpdate(shiftSession.getId())) {
			attendance.setPayableStartTime(null);
			attendance.setPauseMinutes(null);
			attendance.setWorkedMinutes(null);
			attendance.setCalculatedSalary(null);
			attendance.setPaymentStatus(PaymentStatus.UNPAID);
			attendance.setPaidAt(null);
		}
	}

	private boolean isShortShift(long durationMinutes) {
		return durationMinutes >= 0 && durationMinutes < SHORT_SHIFT_MINIMUM_MINUTES;
	}

	/**
	 * Finds the start of the worker's payable interval for close-time salary calculation.
	 *
	 * <p>Workers approved before the shift began are paid from the shift actual start. Workers approved during an
	 * already active shift are paid from their approval timestamp. A defensive max also prevents persisted timestamps
	 * before actualStartTime from expanding the payable interval.</p>
	 *
	 * @param shiftSession shift being closed
	 * @param attendance approved worker attendance
	 * @return effective worker payable start time
	 */
	private OffsetDateTime workerPayableStart(ShiftSession shiftSession, ShiftAttendance attendance) {
		OffsetDateTime actualStartTime = shiftSession.getActualStartTime();
		OffsetDateTime payableStartTime = attendance.getPayableStartTime();
		if (payableStartTime == null || !payableStartTime.isAfter(actualStartTime)) {
			return actualStartTime;
		}
		return payableStartTime;
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
	 * Verifies that the principal is the foreman who owns the shift.
	 *
	 * @param shiftSession shift being changed
	 * @param principal authenticated foreman principal
	 */
	private void validateOwnerForemanAccess(ShiftSession shiftSession, AuthenticatedUserPrincipal principal) {
		if (principal.role() == Role.FOREMAN
				&& Objects.equals(shiftSession.getCreatedBy().getId(), principal.id())) {
			return;
		}
		throw new ForbiddenException();
	}

	/**
	 * Ensures the owner foreman is still assigned to the company that owns the shift.
	 *
	 * @param shiftSession shift being started or closed
	 * @param principal authenticated caller
	 */
	private void validateForemanCompanyConsistency(
			ShiftSession shiftSession,
			AuthenticatedUserPrincipal principal
	) {
		if (principal.role() != Role.FOREMAN) {
			return;
		}

		User foreman = userRepository.findWithCompanyById(principal.id())
				.orElseThrow(() -> new JwtAuthenticationException("Authenticated user not found"));
		if (foreman.getCompany() == null
				|| !Objects.equals(foreman.getCompany().getId(), shiftSession.getCompany().getId())) {
			throw new ForbiddenException("Foreman must belong to the shift company");
		}
	}

	/**
	 * Checks whether the current REST/mobile caller can see private owner-foreman fields.
	 *
	 * @param shiftSession shift being mapped
	 * @param principal authenticated caller
	 * @return true only for the FOREMAN who owns the shift
	 */
	private boolean shouldIncludePrivateForemanFields(
			ShiftSession shiftSession,
			AuthenticatedUserPrincipal principal
	) {
		return principal.role() == Role.FOREMAN
				&& Objects.equals(shiftSession.getCreatedBy().getId(), principal.id());
	}

	/**
	 * Generates the MVP default shift title in English using Europe/Berlin local time.
	 *
	 * @param now current instant represented as an offset date-time
	 * @param company company assigned to the shift
	 * @return generated shift title
	 */
	private String generateTitle(OffsetDateTime now, Company company) {
		return TITLE_FORMATTER.format(now.atZoneSameInstant(TITLE_ZONE)) + " - " + company.getName();
	}

	/**
	 * Returns persisted private foreman salary with the API money scale.
	 *
	 * @param shiftSession closed shift session
	 * @return persisted foreman salary at scale two, or null if absent
	 */
	private BigDecimal privateForemanSalary(ShiftSession shiftSession) {
		if (shiftSession.getForemanCalculatedSalary() == null) {
			return null;
		}
		return shiftSession.getForemanCalculatedSalary().setScale(2, RoundingMode.HALF_UP);
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
