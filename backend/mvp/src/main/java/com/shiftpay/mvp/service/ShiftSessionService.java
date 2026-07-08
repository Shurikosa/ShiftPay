package com.shiftpay.mvp.service;

import com.shiftpay.mvp.dto.CreateShiftRequest;
import com.shiftpay.mvp.dto.ShiftCloseResponse;
import com.shiftpay.mvp.dto.ShiftCreateResponse;
import com.shiftpay.mvp.dto.ShiftResponse;
import com.shiftpay.mvp.dto.ShiftStartResponse;
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
import java.time.LocalDateTime;
import java.time.OffsetDateTime;
import java.time.ZoneOffset;
import java.util.Objects;

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

	@Transactional(readOnly = true)
	public ShiftResponse getShift(Long shiftId, AuthenticatedUserPrincipal principal) {
		ShiftSession shiftSession = shiftSessionRepository.findById(shiftId)
				.orElseThrow(ShiftNotFoundException::new);

		validateShiftAccess(shiftSession, principal);
		return ShiftResponse.from(shiftSession);
	}

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

	private Company getOrCreateDefaultCompany() {
		return companyRepository.findFirstByName(DEFAULT_COMPANY_NAME)
				.orElseGet(() -> {
					Company company = new Company();
					company.setName(DEFAULT_COMPANY_NAME);
					return companyRepository.save(company);
				});
	}

	private String generateUniqueJoinCode() {
		for (int attempt = 0; attempt < JOIN_CODE_MAX_ATTEMPTS; attempt++) {
			String joinCode = generateJoinCode();
			if (!shiftSessionRepository.existsByJoinCode(joinCode)) {
				return joinCode;
			}
		}
		throw new IllegalStateException("Failed to generate unique join code");
	}

	private String generateJoinCode() {
		StringBuilder joinCode = new StringBuilder(JOIN_CODE_LENGTH);
		for (int index = 0; index < JOIN_CODE_LENGTH; index++) {
			joinCode.append(JOIN_CODE_CHARS[secureRandom.nextInt(JOIN_CODE_CHARS.length)]);
		}
		return joinCode.toString();
	}

	private void validatePlannedTimeOrder(LocalDateTime plannedStartTime, LocalDateTime plannedEndTime) {
		if (plannedStartTime != null && plannedEndTime != null && !plannedEndTime.isAfter(plannedStartTime)) {
			throw new BadRequestException("plannedEndTime must be after plannedStartTime");
		}
	}

	private OffsetDateTime toUtcOffsetDateTime(LocalDateTime value) {
		return value == null ? null : value.atOffset(ZoneOffset.UTC);
	}

	private String trimToNull(String value) {
		if (value == null || value.isBlank()) {
			return null;
		}
		return value.trim();
	}
}
