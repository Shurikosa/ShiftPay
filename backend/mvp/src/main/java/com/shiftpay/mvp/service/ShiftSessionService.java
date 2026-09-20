package com.shiftpay.mvp.service;

import com.shiftpay.mvp.dto.CreateShiftRequest;
import com.shiftpay.mvp.dto.PayCalculationResponse;
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
import com.shiftpay.mvp.entity.PauseScope;
import com.shiftpay.mvp.entity.PayCalculation;
import com.shiftpay.mvp.entity.PaymentStatus;
import com.shiftpay.mvp.entity.PaySegment;
import com.shiftpay.mvp.entity.PayPolicyVersion;
import com.shiftpay.mvp.entity.Role;
import com.shiftpay.mvp.entity.ShiftAttendance;
import com.shiftpay.mvp.entity.ShiftPauseInterval;
import com.shiftpay.mvp.entity.ShiftSession;
import com.shiftpay.mvp.entity.ShiftStatus;
import com.shiftpay.mvp.entity.User;
import com.shiftpay.mvp.exception.CompanyConflictException;
import com.shiftpay.mvp.exception.BadRequestException;
import com.shiftpay.mvp.exception.ForbiddenException;
import com.shiftpay.mvp.exception.PayPolicyRequiredException;
import com.shiftpay.mvp.exception.ShortShiftRequiresDecisionException;
import com.shiftpay.mvp.exception.ShiftNotFoundException;
import com.shiftpay.mvp.exception.ShiftStateConflictException;
import com.shiftpay.mvp.repository.PayCalculationRepository;
import com.shiftpay.mvp.repository.PayPolicyVersionRepository;
import com.shiftpay.mvp.repository.ShiftAttendanceRepository;
import com.shiftpay.mvp.repository.ShiftPauseIntervalRepository;
import com.shiftpay.mvp.repository.ShiftSessionRepository;
import com.shiftpay.mvp.repository.UserRepository;
import com.shiftpay.mvp.security.AuthenticatedUserPrincipal;
import com.shiftpay.mvp.security.JwtAuthenticationException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.security.SecureRandom;
import java.time.Clock;
import java.time.Duration;
import java.time.Instant;
import java.time.OffsetDateTime;
import java.time.ZoneId;
import java.time.ZoneOffset;
import java.time.format.DateTimeFormatter;
import java.util.ArrayList;
import java.util.Comparator;
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
	private final PayCalculationRepository payCalculationRepository;
	private final PayPolicyVersionRepository payPolicyVersionRepository;
	private final PauseCalculationService pauseCalculationService;
	private final PauseViewFactory pauseViewFactory;
	private final PayPolicyService payPolicyService;
	private final PremiumPayCalculationService premiumPayCalculationService;
	private final SalaryCalculationService salaryCalculationService;
	private final Clock clock;
	private final SecureRandom secureRandom;

	/**
	 * Creates the service with repositories, salary service, and secure join code generation.
	 *
	 * @param shiftAttendanceRepository attendance repository used for close and summary data
	 * @param shiftPauseIntervalRepository pause repository used for pause state and salary deductions
	 * @param shiftSessionRepository shift repository used for lifecycle persistence and locks
	 * @param userRepository user repository used to resolve the authenticated creator
	 * @param payCalculationRepository premium pay snapshot repository
	 * @param payPolicyVersionRepository pay policy version repository
	 * @param pauseCalculationService service used to calculate union pause minutes
	 * @param pauseViewFactory factory used to build mobile pause state fragments
	 * @param payPolicyService service used to freeze current policy at shift start
	 * @param premiumPayCalculationService premium calculation service used for worker close payroll
	 * @param salaryCalculationService salary calculation service used on close
	 * @param clock UTC application clock for lifecycle timestamps
	 */
	public ShiftSessionService(
			ShiftAttendanceRepository shiftAttendanceRepository,
			ShiftPauseIntervalRepository shiftPauseIntervalRepository,
			ShiftSessionRepository shiftSessionRepository,
			UserRepository userRepository,
			PayCalculationRepository payCalculationRepository,
			PayPolicyVersionRepository payPolicyVersionRepository,
			PauseCalculationService pauseCalculationService,
			PauseViewFactory pauseViewFactory,
			PayPolicyService payPolicyService,
			PremiumPayCalculationService premiumPayCalculationService,
			SalaryCalculationService salaryCalculationService,
			Clock clock
	) {
		this.shiftAttendanceRepository = shiftAttendanceRepository;
		this.shiftPauseIntervalRepository = shiftPauseIntervalRepository;
		this.shiftSessionRepository = shiftSessionRepository;
		this.userRepository = userRepository;
		this.payCalculationRepository = payCalculationRepository;
		this.payPolicyVersionRepository = payPolicyVersionRepository;
		this.pauseCalculationService = pauseCalculationService;
		this.pauseViewFactory = pauseViewFactory;
		this.payPolicyService = payPolicyService;
		this.premiumPayCalculationService = premiumPayCalculationService;
		this.salaryCalculationService = salaryCalculationService;
		this.clock = clock;
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
		if (company.getCurrencyLabel() == null) {
			throw new CompanyConflictException("Company currency label must be configured before creating a shift");
		}
		BigDecimal defaultHourlyRate = request.defaultHourlyRate() == null
				? company.getDefaultWorkerHourlyRate()
				: request.defaultHourlyRate();
		if (defaultHourlyRate == null) {
			throw new BadRequestException("defaultHourlyRate: must not be null");
		}
		BigDecimal foremanHourlyRate = request.foremanHourlyRate() == null
				? company.getDefaultForemanHourlyRate()
				: request.foremanHourlyRate();
		if (foremanHourlyRate == null) {
			throw new BadRequestException("foremanHourlyRate: must not be null");
		}

		ShiftSession shiftSession = new ShiftSession();
		shiftSession.setCompany(company);
		shiftSession.setTitle(generateTitle(nowUtc(), company));
		shiftSession.setLocation(trimToNull(request.location()));
		shiftSession.setJoinCode(generateUniqueJoinCode());
		shiftSession.setStatus(ShiftStatus.OPEN);
		shiftSession.setDefaultBreakMinutes(request.defaultBreakMinutes() == null ? 0 : request.defaultBreakMinutes());
		shiftSession.setDefaultHourlyRate(defaultHourlyRate);
		shiftSession.setForemanHourlyRate(foremanHourlyRate);
		shiftSession.setCurrencyLabel(company.getCurrencyLabel());
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

		PayPolicyVersion payPolicyVersion = payPolicyService.resolveCurrentPolicyForShiftStart(shiftSession.getCompany());
		shiftSession.setPayPolicyVersion(payPolicyVersion);
		shiftSession.setStatus(ShiftStatus.ACTIVE);
		shiftSession.setActualStartTime(nowUtc());
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

		OffsetDateTime discardedAt = nowUtc();
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

		OffsetDateTime actualEndTime = nowUtc();
		long durationMinutes = salaryCalculationService.calculateDurationMinutes(
				shiftSession.getActualStartTime(),
				actualEndTime
		);
		boolean shouldSaveShortShift = request != null && request.shouldSaveShortShift();
		if (isShortShift(durationMinutes) && !shouldSaveShortShift) {
			throw new ShortShiftRequiresDecisionException(durationMinutes, SHORT_SHIFT_MINIMUM_MINUTES);
		}
		PayPolicyVersion frozenPolicyVersion = resolveFrozenPolicyVersionForClose(shiftSession);
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
				int pauseMinutes = pauseCalculationService.calculateEffectivePauseMinutes(
						pauseIntervals,
						attendance.getWorker().getId(),
						workerPayableStart,
						actualEndTime
				);
				PayCalculation payCalculation = calculateWorkerPay(
						shiftSession,
						attendance,
						workerPayableStart,
						actualEndTime,
						pauseIntervals,
						frozenPolicyVersion
				);
				attendance.setPauseMinutes(pauseMinutes);
				attendance.setWorkedMinutes(Math.toIntExact(wholeMinutes(payCalculation.getTotalRawSeconds())));
				attendance.setCalculatedSalary(payCalculation.getTotalAmount().setScale(2, RoundingMode.HALF_UP));
				attendance.setPaymentStatus(PaymentStatus.UNPAID);
				attendance.setPaidAt(null);
			}
			else {
				deletePayCalculation(attendance);
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

		boolean includePrivateForemanFields = shouldIncludePrivateForemanFields(shiftSession, principal);
		List<ShiftAttendance> attendanceRows = shiftAttendanceRepository
				.findApprovedByShiftSessionIdWithWorkerOrderByWorkerName(shiftId);
		loadPayCalculations(attendanceRows);
		List<WorkerSummaryResponse> workers = attendanceRows.stream()
				.map((attendance) -> toWorkerSummary(attendance, includePrivateForemanFields))
				.toList();

		BigDecimal totalSalary = workers.stream()
				.map(WorkerSummaryResponse::salary)
				.reduce(BigDecimal.ZERO, BigDecimal::add)
				.setScale(2, RoundingMode.HALF_UP);
		BigDecimal totalBaseAmount = attendanceRows.stream()
				.map((attendance) -> calculationAmount(attendance, CalculationAmountType.BASE))
				.reduce(BigDecimal.ZERO, BigDecimal::add)
				.setScale(8, RoundingMode.HALF_UP);
		BigDecimal totalPremiumAmount = attendanceRows.stream()
				.map((attendance) -> calculationAmount(attendance, CalculationAmountType.PREMIUM))
				.reduce(BigDecimal.ZERO, BigDecimal::add)
				.setScale(8, RoundingMode.HALF_UP);

		return new ShiftSummaryResponse(
				shiftSession.getId(),
				shiftSession.getStatus(),
				shiftSession.getCurrencyLabel(),
				workers.size(),
				totalSalary,
				totalBaseAmount,
				totalPremiumAmount,
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
	 * @param includePayCalculation whether to expose the worker breakdown
	 * @return worker summary response
	 */
	private WorkerSummaryResponse toWorkerSummary(ShiftAttendance attendance, boolean includePayCalculation) {
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
				attendance.getCalculatedSalary().setScale(2, RoundingMode.HALF_UP),
				includePayCalculation ? PayCalculationResponse.from(attendance.getPayCalculation()) : null
		);
	}

	private BigDecimal calculationAmount(ShiftAttendance attendance, CalculationAmountType amountType) {
		PayCalculation payCalculation = attendance.getPayCalculation();
		if (payCalculation == null) {
			return amountType == CalculationAmountType.BASE
					? attendance.getCalculatedSalary().setScale(8)
					: BigDecimal.ZERO.setScale(8);
		}
		return switch (amountType) {
			case BASE -> payCalculation.getTotalBaseAmount();
			case PREMIUM -> payCalculation.getTotalPremiumAmount();
		};
	}

	private PayPolicyVersion resolveFrozenPolicyVersionForClose(ShiftSession shiftSession) {
		if (shiftSession.getPayPolicyVersion() == null) {
			throw new PayPolicyRequiredException("Frozen pay policy is required before closing a shift");
		}
		return payPolicyVersionRepository.findByIdWithCompanyAndRules(shiftSession.getPayPolicyVersion().getId())
				.orElseThrow(() -> new PayPolicyRequiredException("Frozen pay policy is required before closing a shift"));
	}

	private PayCalculation calculateWorkerPay(
			ShiftSession shiftSession,
			ShiftAttendance attendance,
			OffsetDateTime workerPayableStart,
			OffsetDateTime actualEndTime,
			List<ShiftPauseInterval> pauseIntervals,
			PayPolicyVersion frozenPolicyVersion
	) {
		deletePayCalculation(attendance);
		List<PayableInterval> payableIntervals = workerPayableIntervals(
				attendance,
				workerPayableStart,
				actualEndTime,
				pauseIntervals
		);
		List<PremiumPayableInterval> previousIntervals = previousFinalizedIntervals(
				shiftSession,
				attendance,
				actualEndTime
		);

		PayCalculation calculation = new PayCalculation();
		calculation.setAttendance(attendance);
		calculation.setShiftSession(shiftSession);
		calculation.setPayPolicyVersion(frozenPolicyVersion);

		BigDecimal totalRawSeconds = zeroSeconds();
		BigDecimal totalRawMinutesExact = zeroMinutes();
		List<PremiumPayableInterval> currentCompletedIntervals = new ArrayList<>();

		for (int index = 0; index < payableIntervals.size(); index++) {
			PayableInterval payableInterval = payableIntervals.get(index);
			PremiumPayableInterval currentInterval = PremiumPayableInterval.current(
					attendance.getWorker().getId(),
					shiftSession.getCompany().getId(),
					stableIntervalId(attendance.getId(), index),
					shiftSession.getActualStartTime().toInstant(),
					workerPayableStart.toInstant(),
					payableInterval.start(),
					payableInterval.end()
			);
			List<PremiumPayableInterval> contextIntervals = new ArrayList<>(previousIntervals);
			contextIntervals.addAll(currentCompletedIntervals);
			PremiumPayCalculationResult result = premiumPayCalculationService.calculate(
					payableInterval.start(),
					payableInterval.end(),
					attendance.getHourlyRate(),
					frozenPolicyVersion,
					PremiumPayCalculationContext.of(contextIntervals, currentInterval)
			);

			totalRawSeconds = totalRawSeconds.add(result.totalRawSeconds());
			totalRawMinutesExact = totalRawMinutesExact.add(result.totalRawMinutesExact());
			result.segments()
					.stream()
					.map((segment) -> toEntity(segment, calculation))
					.forEach(calculation.getSegments()::add);
			currentCompletedIntervals.add(PremiumPayableInterval.previousFinalized(
					attendance.getWorker().getId(),
					shiftSession.getCompany().getId(),
					stableIntervalId(attendance.getId(), index),
					shiftSession.getActualStartTime().toInstant(),
					workerPayableStart.toInstant(),
					payableInterval.start(),
					payableInterval.end()
			));
		}

		calculation.setTotalRawSeconds(totalRawSeconds.setScale(9, RoundingMode.HALF_UP));
		calculation.setTotalRawMinutesExact(totalRawMinutesExact.setScale(8, RoundingMode.HALF_UP));
		BigDecimal totalBaseAmount = sumSegmentAmounts(calculation, PaySegment::getBaseAmount);
		BigDecimal totalPremiumAmount = sumSegmentAmounts(calculation, PaySegment::getPremiumAmount);
		BigDecimal totalAmount = sumSegmentAmounts(calculation, PaySegment::getTotalAmount);
		if (totalAmount.compareTo(totalBaseAmount.add(totalPremiumAmount).setScale(8, RoundingMode.HALF_UP)) != 0) {
			throw new IllegalStateException("Persisted pay segment audit amounts do not balance");
		}
		calculation.setTotalBaseAmount(totalBaseAmount);
		calculation.setTotalPremiumAmount(totalPremiumAmount);
		calculation.setTotalAmount(totalAmount);
		PayCalculation savedCalculation = payCalculationRepository.saveAndFlush(calculation);
		attendance.setPayCalculation(savedCalculation);
		return savedCalculation;
	}

	private List<PayableInterval> workerPayableIntervals(
			ShiftAttendance attendance,
			OffsetDateTime workerPayableStart,
			OffsetDateTime actualEndTime,
			List<ShiftPauseInterval> pauseIntervals
	) {
		if (workerPayableStart == null || actualEndTime == null || !actualEndTime.isAfter(workerPayableStart)) {
			return List.of();
		}
		List<PayableInterval> intervals = removePauseIntervals(
				List.of(new PayableInterval(workerPayableStart.toInstant(), actualEndTime.toInstant())),
				pauseIntervals,
				attendance.getWorker().getId(),
				workerPayableStart,
				actualEndTime
		);
		return deductStaticBreak(intervals, attendance.getBreakMinutes()).stream()
				.sorted(Comparator.comparing(PayableInterval::start).thenComparing(PayableInterval::end))
				.toList();
	}

	private List<PayableInterval> removePauseIntervals(
			List<PayableInterval> payableIntervals,
			List<ShiftPauseInterval> pauseIntervals,
			Long workerId,
			OffsetDateTime windowStart,
			OffsetDateTime windowEnd
	) {
		List<PayableInterval> pauseRanges = pauseIntervals.stream()
				.filter((pauseInterval) -> pauseAppliesToWorker(pauseInterval, workerId))
				.map((pauseInterval) -> clipPause(pauseInterval, windowStart, windowEnd))
				.filter(Objects::nonNull)
				.sorted(Comparator.comparing(PayableInterval::start).thenComparing(PayableInterval::end))
				.toList();
		if (pauseRanges.isEmpty()) {
			return payableIntervals;
		}
		return subtractIntervals(payableIntervals, mergeIntervals(pauseRanges));
	}

	private boolean pauseAppliesToWorker(ShiftPauseInterval pauseInterval, Long workerId) {
		if (pauseInterval.getScope() == PauseScope.ALL) {
			return true;
		}
		return pauseInterval.getUser() != null && Objects.equals(pauseInterval.getUser().getId(), workerId);
	}

	private PayableInterval clipPause(
			ShiftPauseInterval pauseInterval,
			OffsetDateTime windowStart,
			OffsetDateTime windowEnd
	) {
		OffsetDateTime start = max(pauseInterval.getStartedAt(), windowStart);
		OffsetDateTime end = min(pauseInterval.getEndedAt() == null ? windowEnd : pauseInterval.getEndedAt(), windowEnd);
		if (!end.isAfter(start)) {
			return null;
		}
		return new PayableInterval(start.toInstant(), end.toInstant());
	}

	private List<PayableInterval> subtractIntervals(
			List<PayableInterval> sourceIntervals,
			List<PayableInterval> subtractIntervals
	) {
		List<PayableInterval> remaining = sourceIntervals;
		for (PayableInterval subtractInterval : subtractIntervals) {
			List<PayableInterval> next = new ArrayList<>();
			for (PayableInterval sourceInterval : remaining) {
				next.addAll(subtract(sourceInterval, subtractInterval));
			}
			remaining = next;
		}
		return remaining;
	}

	private List<PayableInterval> subtract(PayableInterval source, PayableInterval deduction) {
		if (!deduction.end().isAfter(source.start()) || !deduction.start().isBefore(source.end())) {
			return List.of(source);
		}
		List<PayableInterval> remaining = new ArrayList<>();
		Instant leftEnd = min(source.end(), deduction.start());
		if (leftEnd.isAfter(source.start())) {
			remaining.add(new PayableInterval(source.start(), leftEnd));
		}
		Instant rightStart = max(source.start(), deduction.end());
		if (source.end().isAfter(rightStart)) {
			remaining.add(new PayableInterval(rightStart, source.end()));
		}
		return remaining;
	}

	private List<PayableInterval> mergeIntervals(List<PayableInterval> intervals) {
		List<PayableInterval> merged = new ArrayList<>();
		for (PayableInterval interval : intervals) {
			if (merged.isEmpty()) {
				merged.add(interval);
				continue;
			}
			PayableInterval last = merged.getLast();
			if (!interval.start().isAfter(last.end())) {
				merged.set(merged.size() - 1, new PayableInterval(last.start(), max(last.end(), interval.end())));
			}
			else {
				merged.add(interval);
			}
		}
		return merged;
	}

	private List<PayableInterval> deductStaticBreak(List<PayableInterval> intervals, Integer breakMinutes) {
		long remainingBreakSeconds = Math.multiplyExact(Math.max(0, breakMinutes == null ? 0 : breakMinutes), 60L);
		if (remainingBreakSeconds == 0 || intervals.isEmpty()) {
			return intervals;
		}
		List<PayableInterval> adjusted = new ArrayList<>();
		for (PayableInterval interval : intervals) {
			if (remainingBreakSeconds <= 0) {
				adjusted.add(interval);
				continue;
			}
			long intervalSeconds = secondsBetween(interval.start(), interval.end());
			if (remainingBreakSeconds >= intervalSeconds) {
				remainingBreakSeconds -= intervalSeconds;
			}
			else {
				adjusted.add(new PayableInterval(interval.start().plusSeconds(remainingBreakSeconds), interval.end()));
				remainingBreakSeconds = 0;
			}
		}
		return adjusted;
	}

	private List<PremiumPayableInterval> previousFinalizedIntervals(
			ShiftSession shiftSession,
			ShiftAttendance attendance,
			OffsetDateTime actualEndTime
	) {
		return shiftAttendanceRepository.findPreviousFinalizedForOvertimeContext(
						attendance.getWorker().getId(),
						shiftSession.getCompany().getId(),
						attendance.getId(),
						actualEndTime
				)
				.stream()
				.flatMap((previousAttendance) -> previousFinalizedIntervals(previousAttendance).stream())
				.sorted(Comparator.comparing(PremiumPayableInterval::start)
						.thenComparing(PremiumPayableInterval::stableId))
				.toList();
	}

	private List<PremiumPayableInterval> previousFinalizedIntervals(ShiftAttendance previousAttendance) {
		if (previousAttendance.getPayCalculation() != null && !previousAttendance.getPayCalculation().getSegments().isEmpty()) {
			List<PaySegment> segments = previousAttendance.getPayCalculation().getSegments()
					.stream()
					.sorted(Comparator.comparing(PaySegment::getStart).thenComparing(PaySegment::getId))
					.toList();
			List<PremiumPayableInterval> intervals = new ArrayList<>();
			for (int index = 0; index < segments.size(); index++) {
				PaySegment segment = segments.get(index);
				intervals.add(PremiumPayableInterval.previousFinalized(
							previousAttendance.getWorker().getId(),
							previousAttendance.getShiftSession().getCompany().getId(),
							stableIntervalId(previousAttendance.getId(), index),
							toInstant(previousAttendance.getShiftSession().getActualStartTime()),
							toInstant(workerPayableStart(previousAttendance.getShiftSession(), previousAttendance)),
							segment.getStart().toInstant(),
							segment.getEnd().toInstant()
				));
			}
			return intervals;
		}
		OffsetDateTime previousStart = workerPayableStart(previousAttendance.getShiftSession(), previousAttendance);
		OffsetDateTime previousEnd = previousAttendance.getShiftSession().getActualEndTime();
		if (previousStart == null || previousEnd == null || !previousEnd.isAfter(previousStart)) {
			return List.of();
		}
		List<PayableInterval> payableIntervals = workerPayableIntervals(
				previousAttendance,
				previousStart,
				previousEnd,
				shiftPauseIntervalRepository.findAllByShiftSessionId(previousAttendance.getShiftSession().getId())
		);
		List<PremiumPayableInterval> intervals = new ArrayList<>();
		for (int index = 0; index < payableIntervals.size(); index++) {
			PayableInterval payableInterval = payableIntervals.get(index);
			intervals.add(PremiumPayableInterval.previousFinalized(
					previousAttendance.getWorker().getId(),
					previousAttendance.getShiftSession().getCompany().getId(),
					stableIntervalId(previousAttendance.getId(), index),
					toInstant(previousAttendance.getShiftSession().getActualStartTime()),
					toInstant(previousStart),
					payableInterval.start(),
					payableInterval.end()
			));
		}
		return intervals;
	}

	private PaySegment toEntity(PremiumPaySegment segment, PayCalculation calculation) {
		PaySegment entity = new PaySegment();
		entity.setPayCalculation(calculation);
		entity.setStart(OffsetDateTime.ofInstant(segment.start(), ZoneOffset.UTC));
		entity.setEnd(OffsetDateTime.ofInstant(segment.end(), ZoneOffset.UTC));
		entity.setPayableSeconds(segment.payableSeconds());
		entity.setPayableMinutes(segment.payableMinutes());
		entity.setPayableMinutesExact(segment.payableMinutesExact());
		entity.setBaseHourlyRate(segment.baseHourlyRate());
		entity.setAppliedRulesSnapshot(AppliedPremiumRulesJson.write(segment.appliedRules()));
		entity.setStackingStrategy(segment.stackingStrategy());
		entity.setEffectivePremiumPercent(segment.effectivePremiumPercent());
		entity.setEffectiveHourlyRate(segment.effectiveHourlyRate());
		entity.setBaseAmount(toAuditAmount(segment.baseAmount()));
		entity.setPremiumAmount(toAuditAmount(segment.premiumAmount()));
		entity.setTotalAmount(toAuditAmount(segment.totalAmount()));
		return entity;
	}

	private void clearPayrollForDiscardedShift(ShiftSession shiftSession) {
		shiftSession.setForemanWorkedMinutes(null);
		shiftSession.setForemanPauseMinutes(null);
		shiftSession.setForemanCalculatedSalary(null);
		for (ShiftAttendance attendance : shiftAttendanceRepository.findAllByShiftSessionIdForUpdate(shiftSession.getId())) {
			deletePayCalculation(attendance);
			attendance.setPayableStartTime(null);
			attendance.setPauseMinutes(null);
			attendance.setWorkedMinutes(null);
			attendance.setCalculatedSalary(null);
			attendance.setPaymentStatus(PaymentStatus.UNPAID);
			attendance.setPaidAt(null);
		}
	}

	private void deletePayCalculation(ShiftAttendance attendance) {
		if (attendance.getId() != null) {
			payCalculationRepository.deleteByAttendanceId(attendance.getId());
			attendance.setPayCalculation(null);
		}
	}

	private void loadPayCalculations(List<ShiftAttendance> attendanceRows) {
		List<Long> attendanceIds = attendanceRows.stream()
				.map(ShiftAttendance::getId)
				.toList();
		if (attendanceIds.isEmpty()) {
			return;
		}
		payCalculationRepository.findAllByAttendanceIdInWithSegments(attendanceIds)
				.forEach((calculation) -> calculation.getAttendance().setPayCalculation(calculation));
	}

	private long stableIntervalId(Long attendanceId, int intervalIndex) {
		long safeAttendanceId = attendanceId == null ? 0L : attendanceId;
		return Math.addExact(Math.multiplyExact(safeAttendanceId, 100_000L), intervalIndex + 1L);
	}

	private long secondsBetween(Instant start, Instant end) {
		return Duration.between(start, end).getSeconds();
	}

	private long wholeMinutes(BigDecimal seconds) {
		return seconds.divideToIntegralValue(BigDecimal.valueOf(60)).longValueExact();
	}

	private BigDecimal sumSegmentAmounts(
			PayCalculation calculation,
			java.util.function.Function<PaySegment, BigDecimal> amount
	) {
		return calculation.getSegments().stream()
				.map(amount)
				.reduce(BigDecimal.ZERO, BigDecimal::add)
				.setScale(8, RoundingMode.HALF_UP);
	}

	private BigDecimal toAuditAmount(BigDecimal amount) {
		return amount.setScale(8, RoundingMode.HALF_UP);
	}

	private BigDecimal zeroSeconds() {
		return BigDecimal.ZERO.setScale(9, RoundingMode.HALF_UP);
	}

	private BigDecimal zeroMinutes() {
		return BigDecimal.ZERO.setScale(8, RoundingMode.HALF_UP);
	}

	private enum CalculationAmountType {

		BASE,
		PREMIUM
	}

	private OffsetDateTime min(OffsetDateTime first, OffsetDateTime second) {
		return first.isBefore(second) ? first : second;
	}

	private OffsetDateTime max(OffsetDateTime first, OffsetDateTime second) {
		return first.isAfter(second) ? first : second;
	}

	private Instant min(Instant first, Instant second) {
		return first.isBefore(second) ? first : second;
	}

	private Instant max(Instant first, Instant second) {
		return first.isAfter(second) ? first : second;
	}

	private Instant toInstant(OffsetDateTime dateTime) {
		return dateTime == null ? null : dateTime.toInstant();
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

	private OffsetDateTime nowUtc() {
		return OffsetDateTime.now(clock).withOffsetSameInstant(ZoneOffset.UTC);
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

	private record PayableInterval(Instant start, Instant end) {

		private PayableInterval {
			Objects.requireNonNull(start, "start");
			Objects.requireNonNull(end, "end");
			if (!end.isAfter(start)) {
				throw new IllegalArgumentException("payable interval end must be after start");
			}
		}
	}
}
