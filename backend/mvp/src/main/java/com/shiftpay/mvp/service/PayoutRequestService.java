package com.shiftpay.mvp.service;

import com.shiftpay.mvp.dto.PayrollRoundingResult;
import com.shiftpay.mvp.dto.PayoutAttendanceResponse;
import com.shiftpay.mvp.dto.PayoutRequestItemResponse;
import com.shiftpay.mvp.dto.PayoutRequestPreviewItem;
import com.shiftpay.mvp.dto.PayoutRequestPreviewResponse;
import com.shiftpay.mvp.dto.PayoutRequestResponse;
import com.shiftpay.mvp.dto.PayoutSelectionRequest;
import com.shiftpay.mvp.entity.AttendanceStatus;
import com.shiftpay.mvp.entity.Company;
import com.shiftpay.mvp.entity.PaymentStatus;
import com.shiftpay.mvp.entity.PayCalculation;
import com.shiftpay.mvp.entity.PayoutRequest;
import com.shiftpay.mvp.entity.PayoutRequestItem;
import com.shiftpay.mvp.entity.PayoutRequestStatus;
import com.shiftpay.mvp.entity.Role;
import com.shiftpay.mvp.entity.ShiftAttendance;
import com.shiftpay.mvp.entity.ShiftSession;
import com.shiftpay.mvp.entity.ShiftStatus;
import com.shiftpay.mvp.entity.User;
import com.shiftpay.mvp.exception.AttendanceNotFoundException;
import com.shiftpay.mvp.exception.BadRequestException;
import com.shiftpay.mvp.exception.ForbiddenException;
import com.shiftpay.mvp.exception.PayoutRequestConflictException;
import com.shiftpay.mvp.exception.PayoutRequestNotFoundException;
import com.shiftpay.mvp.repository.PayoutRequestItemRepository;
import com.shiftpay.mvp.repository.PayoutRequestRepository;
import com.shiftpay.mvp.repository.PayCalculationRepository;
import com.shiftpay.mvp.repository.ShiftAttendanceRepository;
import com.shiftpay.mvp.repository.UserRepository;
import com.shiftpay.mvp.security.AuthenticatedUserPrincipal;
import com.shiftpay.mvp.security.JwtAuthenticationException;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.OffsetDateTime;
import java.time.ZoneOffset;
import java.util.HashSet;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.Set;
import java.util.function.Function;
import java.util.stream.Collectors;

/**
 * Business service for worker payout request preview, creation, listing, and foreman approval.
 */
@Service
public class PayoutRequestService {

	private final PayrollRoundingService payrollRoundingService;
	private final PayoutRequestItemRepository payoutRequestItemRepository;
	private final PayoutRequestRepository payoutRequestRepository;
	private final PayCalculationRepository payCalculationRepository;
	private final ShiftAttendanceRepository shiftAttendanceRepository;
	private final UserRepository userRepository;

	/**
	 * Creates the service with payroll repositories and rounding rules.
	 *
	 * @param payrollRoundingService payroll rounding calculator
	 * @param payoutRequestItemRepository payout request item repository
	 * @param payoutRequestRepository payout request repository
	 * @param payCalculationRepository pay calculation snapshot repository
	 * @param shiftAttendanceRepository attendance repository
	 * @param userRepository user repository
	 */
	public PayoutRequestService(
			PayrollRoundingService payrollRoundingService,
			PayoutRequestItemRepository payoutRequestItemRepository,
			PayoutRequestRepository payoutRequestRepository,
			PayCalculationRepository payCalculationRepository,
			ShiftAttendanceRepository shiftAttendanceRepository,
			UserRepository userRepository
	) {
		this.payrollRoundingService = payrollRoundingService;
		this.payoutRequestItemRepository = payoutRequestItemRepository;
		this.payoutRequestRepository = payoutRequestRepository;
		this.payCalculationRepository = payCalculationRepository;
		this.shiftAttendanceRepository = shiftAttendanceRepository;
		this.userRepository = userRepository;
	}

	/**
	 * Lists payable attendance records for the current worker.
	 *
	 * @param principal authenticated worker principal
	 * @return payable attendance rows with backend payroll rounding
	 */
	@Transactional(readOnly = true)
	public List<PayoutAttendanceResponse> getMyPayableAttendances(AuthenticatedUserPrincipal principal) {
		User worker = loadCurrentUserWithCompany(principal);
		Company company = requireCompany(worker);
		return shiftAttendanceRepository.findPayableByWorkerIdAndCompanyId(worker.getId(), company.getId())
				.stream()
				.map((attendance) -> PayoutAttendanceResponse.from(
						attendance,
						roundingFor(attendance)
				))
				.toList();
	}

	/**
	 * Previews a payout request without persistence or attendance status mutation.
	 *
	 * @param request selected attendance ids
	 * @param principal authenticated worker principal
	 * @return backend-calculated preview totals and items
	 */
	@Transactional(readOnly = true)
	public PayoutRequestPreviewResponse previewMyPayoutRequest(
			PayoutSelectionRequest request,
			AuthenticatedUserPrincipal principal
	) {
		User worker = loadCurrentUserWithCompany(principal);
		List<ShiftAttendance> attendanceRows = loadSelectedAttendanceForWorker(request, worker, false);
		return buildPreviewResponse(validateAndBuildPreview(attendanceRows, request.attendanceIds(), worker));
	}

	/**
	 * Creates a pending payout request and moves selected attendance to PAYMENT_REQUESTED.
	 *
	 * @param request selected attendance ids
	 * @param principal authenticated worker principal
	 * @return persisted payout request response
	 */
	@Transactional
	public PayoutRequestResponse createMyPayoutRequest(
			PayoutSelectionRequest request,
			AuthenticatedUserPrincipal principal
	) {
		User worker = loadCurrentUserWithCompany(principal);
		List<ShiftAttendance> attendanceRows = loadSelectedAttendanceForWorker(request, worker, true);
		List<PayoutRequestPreviewItem> previewItems = validateAndBuildPreview(
				attendanceRows,
				request.attendanceIds(),
				worker
		);
		ShiftAttendance firstAttendance = previewItems.getFirst().attendance();
		User managerForeman = firstAttendance.getShiftSession().getCreatedBy();
		OffsetDateTime requestedAt = OffsetDateTime.now(ZoneOffset.UTC);
		PayoutRequestPreviewResponse previewResponse = buildPreviewResponse(previewItems);

		PayoutRequest payoutRequest = new PayoutRequest();
		payoutRequest.setCompany(worker.getCompany());
		payoutRequest.setWorker(worker);
		payoutRequest.setManagerForeman(managerForeman);
		payoutRequest.setStatus(PayoutRequestStatus.PENDING);
		payoutRequest.setRequestedAt(requestedAt);
		payoutRequest.setCurrencyLabel(previewResponse.currencyLabel());
		applyTotals(payoutRequest, previewResponse);

		for (PayoutRequestPreviewItem previewItem : previewItems) {
			ShiftAttendance attendance = previewItem.attendance();
			attendance.setPaymentStatus(PaymentStatus.PAYMENT_REQUESTED);
			attendance.setPaidAt(null);
			payoutRequest.addItem(buildItem(previewItem));
		}

		try {
			PayoutRequest savedRequest = payoutRequestRepository.saveAndFlush(payoutRequest);
			return toResponse(savedRequest, savedRequest.getItems());
		}
		catch (DataIntegrityViolationException exception) {
			throw new PayoutRequestConflictException(
					"Attendance is already included in a pending payout request"
			);
		}
	}

	/**
	 * Lists payout requests created by the current worker.
	 *
	 * @param status optional request status filter
	 * @param principal authenticated worker principal
	 * @return worker payout request history
	 */
	@Transactional(readOnly = true)
	public List<PayoutRequestResponse> getMyPayoutRequests(
			PayoutRequestStatus status,
			AuthenticatedUserPrincipal principal
	) {
		List<PayoutRequest> requests = payoutRequestRepository.findByWorkerIdWithDetails(principal.id(), status);
		return toResponses(requests);
	}

	/**
	 * Lists payout requests for the current foreman's company and managed shifts.
	 *
	 * @param status optional request status filter, defaults to PENDING
	 * @param principal authenticated foreman principal
	 * @return managed payout request list
	 */
	@Transactional(readOnly = true)
	public List<PayoutRequestResponse> getMyManagedPayoutRequests(
			PayoutRequestStatus status,
			AuthenticatedUserPrincipal principal
	) {
		User foreman = loadCurrentUserWithCompany(principal);
		Company company = requireCompany(foreman);
		PayoutRequestStatus effectiveStatus = status == null ? PayoutRequestStatus.PENDING : status;
		List<PayoutRequest> requests = payoutRequestRepository.findManagedByForemanIdAndCompanyIdWithDetails(
				foreman.getId(),
				company.getId(),
				effectiveStatus
		);
		return toResponses(requests);
	}

	/**
	 * Approves a pending payout request and marks selected attendance as paid.
	 *
	 * @param requestId payout request id
	 * @param principal authenticated foreman principal
	 * @return approved payout request response
	 */
	@Transactional
	public PayoutRequestResponse approveManagedPayoutRequest(
			Long requestId,
			AuthenticatedUserPrincipal principal
	) {
		User foreman = loadCurrentUserWithCompany(principal);
		Company company = requireCompany(foreman);
		PayoutRequest payoutRequest = payoutRequestRepository.findByIdForUpdate(requestId)
				.orElseThrow(PayoutRequestNotFoundException::new);

		if (!Objects.equals(payoutRequest.getCompany().getId(), company.getId())
				|| !Objects.equals(payoutRequest.getManagerForeman().getId(), foreman.getId())) {
			throw new ForbiddenException();
		}
		if (payoutRequest.getStatus() != PayoutRequestStatus.PENDING) {
			throw new PayoutRequestConflictException(
					"Payout request can only be approved when status is PENDING"
			);
		}

		List<PayoutRequestItem> items = payoutRequestItemRepository.findAllByPayoutRequestIdWithDetails(requestId);
		List<Long> attendanceIds = items.stream()
				.map((item) -> item.getAttendance().getId())
				.toList();
		Map<Long, ShiftAttendance> lockedAttendanceById = mapById(
				shiftAttendanceRepository.findAllByIdInForUpdate(attendanceIds)
		);
		if (lockedAttendanceById.size() != attendanceIds.size()) {
			throw new PayoutRequestConflictException("Payout request attendance is no longer payment requested");
		}

		OffsetDateTime approvedAt = OffsetDateTime.now(ZoneOffset.UTC);
		for (PayoutRequestItem item : items) {
			ShiftAttendance attendance = lockedAttendanceById.get(item.getAttendance().getId());
			validateApprovalItem(attendance, payoutRequest, foreman);
			attendance.setPaymentStatus(PaymentStatus.PAID);
			attendance.setPaidAt(approvedAt);
			item.setPaidAt(approvedAt);
		}

		payoutRequest.setStatus(PayoutRequestStatus.APPROVED);
		payoutRequest.setApprovedBy(foreman);
		payoutRequest.setApprovedAt(approvedAt);
		payoutRequest.setPaidAt(approvedAt);
		return toResponse(payoutRequest, items);
	}

	private User loadCurrentUserWithCompany(AuthenticatedUserPrincipal principal) {
		User user = userRepository.findWithCompanyById(principal.id())
				.orElseThrow(() -> new JwtAuthenticationException("Authenticated user not found"));
		if (user.getRole() != principal.role()) {
			throw new JwtAuthenticationException("Authenticated user role changed");
		}
		return user;
	}

	private Company requireCompany(User user) {
		if (user.getCompany() == null) {
			throw new ForbiddenException("User must belong to a company");
		}
		return user.getCompany();
	}

	private List<ShiftAttendance> loadSelectedAttendanceForWorker(
			PayoutSelectionRequest request,
			User worker,
			boolean forUpdate
	) {
		validateAttendanceIds(request);
		if (forUpdate) {
			List<ShiftAttendance> lockedAttendances = shiftAttendanceRepository.findSelectedByIdsAndWorkerIdForUpdate(
					request.attendanceIds(),
					worker.getId()
			);
			if (lockedAttendances.size() != request.attendanceIds().size()) {
				throw new AttendanceNotFoundException();
			}
			List<ShiftAttendance> attendanceDetails = shiftAttendanceRepository.findAllByIdInWithPayoutDetails(
					request.attendanceIds()
			);
			if (attendanceDetails.size() != request.attendanceIds().size()) {
				throw new AttendanceNotFoundException();
			}
			return attendanceDetails;
		}
		return shiftAttendanceRepository.findSelectedByIdsAndWorkerIdWithDetails(
				request.attendanceIds(),
				worker.getId()
		);
	}

	private void validateAttendanceIds(PayoutSelectionRequest request) {
		if (request.attendanceIds() == null || request.attendanceIds().isEmpty()) {
			throw new BadRequestException("attendanceIds: must not be empty");
		}
		Set<Long> uniqueAttendanceIds = new HashSet<>();
		for (Long attendanceId : request.attendanceIds()) {
			if (attendanceId == null) {
				throw new BadRequestException("attendanceIds: must not contain null values");
			}
			if (!uniqueAttendanceIds.add(attendanceId)) {
				throw new BadRequestException("attendanceIds: must not contain duplicates");
			}
		}
	}

	private List<PayoutRequestPreviewItem> validateAndBuildPreview(
			List<ShiftAttendance> attendanceRows,
			List<Long> requestedAttendanceIds,
			User worker
	) {
		if (attendanceRows.size() != requestedAttendanceIds.size()) {
			throw new AttendanceNotFoundException();
		}
		Map<Long, ShiftAttendance> attendanceById = mapById(attendanceRows);
		List<ShiftAttendance> validatedAttendances = requestedAttendanceIds.stream()
				.map((attendanceId) -> {
					ShiftAttendance attendance = attendanceById.get(attendanceId);
					if (attendance == null) {
						throw new AttendanceNotFoundException();
					}
					validatePayableAttendance(attendance, worker);
					return attendance;
				})
				.toList();
		validateSingleManagerForeman(validatedAttendances);
		validateCommonCurrencyLabel(validatedAttendances);
		Map<Long, PayCalculation> calculationsByAttendanceId = loadPayCalculationsByAttendanceId(validatedAttendances);
		List<PayoutRequestPreviewItem> previewItems = validatedAttendances.stream()
				.map((attendance) -> withPayCalculation(
						attendance,
						calculationsByAttendanceId.get(attendance.getId())
				))
				.map((attendance) -> new PayoutRequestPreviewItem(attendance, roundingFor(attendance)))
				.toList();
		return previewItems;
	}

	private PayrollRoundingResult roundingFor(ShiftAttendance attendance) {
		return payrollRoundingService.calculateFromCalculatedSalary(
				attendance.getWorkedMinutes(),
				attendance.getCalculatedSalary()
		);
	}

	private Map<Long, PayCalculation> loadPayCalculationsByAttendanceId(List<ShiftAttendance> attendances) {
		return payCalculationRepository.findAllByAttendanceIdInWithSegments(
				attendances.stream().map(ShiftAttendance::getId).toList()
		).stream().collect(Collectors.toMap(
				(calculation) -> calculation.getAttendance().getId(),
				Function.identity(),
				(first, ignored) -> first,
				LinkedHashMap::new
		));
	}

	private ShiftAttendance withPayCalculation(ShiftAttendance attendance, PayCalculation calculation) {
		attendance.setPayCalculation(calculation);
		return attendance;
	}

	private void validatePayableAttendance(ShiftAttendance attendance, User worker) {
		ShiftSession shiftSession = attendance.getShiftSession();
		if (!Objects.equals(attendance.getWorker().getId(), worker.getId())) {
			throw new AttendanceNotFoundException();
		}
		if (worker.getCompany() == null
				|| !Objects.equals(shiftSession.getCompany().getId(), worker.getCompany().getId())) {
			throw new AttendanceNotFoundException();
		}
		if (attendance.getPaymentStatus() == PaymentStatus.PAID) {
			throw new PayoutRequestConflictException("Attendance is already paid");
		}
		if (attendance.getPaymentStatus() == PaymentStatus.PAYMENT_REQUESTED) {
			throw new PayoutRequestConflictException(
					"Attendance is already included in a pending payout request"
			);
		}
		if (shiftSession.getStatus() == ShiftStatus.DISCARDED) {
			throw new PayoutRequestConflictException("Attendance is not payable");
		}
		if (attendance.getPaymentStatus() != PaymentStatus.UNPAID
				|| attendance.getStatus() != AttendanceStatus.APPROVED
				|| shiftSession.getStatus() != ShiftStatus.CLOSED
				|| attendance.getWorkedMinutes() == null
				|| attendance.getCalculatedSalary() == null
				|| shiftSession.getActualStartTime() == null
				|| shiftSession.getActualEndTime() == null) {
			throw new PayoutRequestConflictException("Attendance is not payable");
		}
	}

	private void validateSingleManagerForeman(List<ShiftAttendance> attendances) {
		Long managerForemanId = null;
		for (ShiftAttendance attendance : attendances) {
			Long currentForemanId = attendance.getShiftSession().getCreatedBy().getId();
			if (managerForemanId == null) {
				managerForemanId = currentForemanId;
			}
			else if (!Objects.equals(managerForemanId, currentForemanId)) {
				throw new PayoutRequestConflictException(
						"Payout request items must belong to shifts managed by the same foreman"
				);
			}
		}
	}

	private void validateCommonCurrencyLabel(List<ShiftAttendance> attendances) {
		String currencyLabel = null;
		for (ShiftAttendance attendance : attendances) {
			String currentCurrencyLabel = attendance.getShiftSession().getCurrencyLabel();
			if (currentCurrencyLabel == null) {
				throw new PayoutRequestConflictException(
						"Attendance has no stored currency label and cannot be included in a payout request"
				);
			}
			if (currencyLabel == null) {
				currencyLabel = currentCurrencyLabel;
			}
			else if (!currencyLabel.equals(currentCurrencyLabel)) {
				throw new PayoutRequestConflictException(
						"Payout request items must use the same currency label",
						"MIXED_CURRENCY_LABELS"
				);
			}
		}
	}

	private void applyTotals(PayoutRequest payoutRequest, PayoutRequestPreviewResponse totals) {
		payoutRequest.setRawPayableMinutesTotal(totals.rawPayableMinutes());
		payoutRequest.setPayoutRoundedMinutesTotal(totals.payoutRoundedMinutes());
		payoutRequest.setExactCalculatedAmountTotal(totals.exactCalculatedAmount());
		payoutRequest.setTotalBaseAmount(totals.totalBaseAmount());
		payoutRequest.setTotalPremiumAmount(totals.totalPremiumAmount());
		payoutRequest.setPayoutAmount(totals.payoutAmount());
	}

	private PayoutRequestItem buildItem(PayoutRequestPreviewItem previewItem) {
		ShiftAttendance attendance = previewItem.attendance();
		ShiftSession shiftSession = attendance.getShiftSession();
		PayrollRoundingResult rounding = previewItem.rounding();
		PayoutRequestItem item = new PayoutRequestItem();
		item.setAttendance(attendance);
		item.setShiftSession(shiftSession);
		item.setShiftTitle(shiftSession.getTitle());
		item.setShiftActualStartTime(shiftSession.getActualStartTime());
		item.setShiftActualEndTime(shiftSession.getActualEndTime());
		item.setRawPayableMinutes(rounding.rawPayableMinutes());
		item.setPayoutRoundedMinutes(rounding.payoutRoundedMinutes());
		item.setHourlyRate(attendance.getHourlyRate());
		item.setCalculatedSalary(attendance.getCalculatedSalary());
		item.setTotalBaseAmount(totalBaseAmount(attendance));
		item.setTotalPremiumAmount(totalPremiumAmount(attendance));
		item.setRoundedItemAmountExact(rounding.roundedItemAmountExact());
		item.setPayoutAmount(rounding.payoutAmount());
		return item;
	}

	private void validateApprovalItem(
			ShiftAttendance attendance,
			PayoutRequest payoutRequest,
			User foreman
	) {
		if (attendance == null
				|| attendance.getPaymentStatus() != PaymentStatus.PAYMENT_REQUESTED
				|| !Objects.equals(attendance.getShiftSession().getCompany().getId(), payoutRequest.getCompany().getId())
				|| !Objects.equals(attendance.getShiftSession().getCreatedBy().getId(), foreman.getId())) {
			throw new PayoutRequestConflictException("Payout request attendance is no longer payment requested");
		}
	}

	private PayoutRequestPreviewResponse buildPreviewResponse(List<PayoutRequestPreviewItem> previewItems) {
		String currencyLabel = previewItems.getFirst().attendance().getShiftSession().getCurrencyLabel();
		Integer rawPayableMinutes = previewItems.stream()
				.map((item) -> item.rounding().rawPayableMinutes())
				.reduce(0, Integer::sum);
		Integer payoutRoundedMinutes = previewItems.stream()
				.map((item) -> item.rounding().payoutRoundedMinutes())
				.reduce(0, Integer::sum);
		BigDecimal exactCalculatedAmount = previewItems.stream()
				.map((item) -> item.attendance().getCalculatedSalary())
				.reduce(BigDecimal.ZERO, BigDecimal::add)
				.setScale(2, RoundingMode.HALF_UP);
		BigDecimal totalBaseAmount = previewItems.stream()
				.map((item) -> totalBaseAmount(item.attendance()))
				.reduce(BigDecimal.ZERO, BigDecimal::add)
				.setScale(8, RoundingMode.HALF_UP);
		BigDecimal totalPremiumAmount = previewItems.stream()
				.map((item) -> totalPremiumAmount(item.attendance()))
				.reduce(BigDecimal.ZERO, BigDecimal::add)
				.setScale(8, RoundingMode.HALF_UP);
		BigDecimal payoutAmount = previewItems.stream()
				.map((item) -> item.rounding().payoutAmount())
				.reduce(BigDecimal.ZERO, BigDecimal::add)
				.setScale(0, RoundingMode.UNNECESSARY);
		List<PayoutRequestItemResponse> itemResponses = previewItems.stream()
				.map((item) -> PayoutRequestItemResponse.fromPreview(item, PaymentStatus.UNPAID))
				.toList();
		return new PayoutRequestPreviewResponse(
				currencyLabel,
				rawPayableMinutes,
				payoutRoundedMinutes,
				exactCalculatedAmount,
				totalBaseAmount,
				totalPremiumAmount,
				payoutAmount,
				itemResponses
		);
	}

	private BigDecimal totalBaseAmount(ShiftAttendance attendance) {
		if (attendance.getPayCalculation() != null) {
			return attendance.getPayCalculation().getTotalBaseAmount();
		}
		return attendance.getCalculatedSalary().setScale(8);
	}

	private BigDecimal totalPremiumAmount(ShiftAttendance attendance) {
		if (attendance.getPayCalculation() != null) {
			return attendance.getPayCalculation().getTotalPremiumAmount();
		}
		return BigDecimal.ZERO.setScale(8);
	}

	private List<PayoutRequestResponse> toResponses(List<PayoutRequest> requests) {
		if (requests.isEmpty()) {
			return List.of();
		}
		List<Long> requestIds = requests.stream().map(PayoutRequest::getId).toList();
		Map<Long, List<PayoutRequestItemResponse>> itemResponsesByRequestId = payoutRequestItemRepository
				.findAllByPayoutRequestIdInWithDetails(requestIds)
				.stream()
				.collect(
						java.util.stream.Collectors.groupingBy(
										(item) -> item.getPayoutRequest().getId(),
										LinkedHashMap::new,
										java.util.stream.Collectors.mapping(
										(item) -> PayoutRequestItemResponse.from(
												item,
												item.getPayoutRequest().getStatus()
										),
										java.util.stream.Collectors.toList()
								)
						)
				);
		return requests.stream()
				.map((request) -> PayoutRequestResponse.from(
						request,
						itemResponsesByRequestId.getOrDefault(request.getId(), List.of())
				))
				.toList();
	}

	private PayoutRequestResponse toResponse(PayoutRequest request, List<PayoutRequestItem> items) {
		List<PayoutRequestItemResponse> itemResponses = items.stream()
				.map((item) -> PayoutRequestItemResponse.from(item, request.getStatus()))
				.toList();
		return PayoutRequestResponse.from(request, itemResponses);
	}

	private Map<Long, ShiftAttendance> mapById(List<ShiftAttendance> attendanceRows) {
		Map<Long, ShiftAttendance> attendanceById = new LinkedHashMap<>();
		for (ShiftAttendance attendance : attendanceRows) {
			attendanceById.put(attendance.getId(), attendance);
		}
		return attendanceById;
	}
}
