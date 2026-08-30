package com.shiftpay.mvp.controller;

import com.shiftpay.mvp.dto.MyShiftHistoryResponse;
import com.shiftpay.mvp.dto.PayoutAttendanceResponse;
import com.shiftpay.mvp.dto.PayoutRequestPreviewResponse;
import com.shiftpay.mvp.dto.PayoutRequestResponse;
import com.shiftpay.mvp.dto.PayoutSelectionRequest;
import com.shiftpay.mvp.dto.ShiftResponse;
import com.shiftpay.mvp.entity.PayoutRequestStatus;
import com.shiftpay.mvp.security.AuthenticatedUserPrincipal;
import com.shiftpay.mvp.service.AttendanceService;
import com.shiftpay.mvp.service.PayoutRequestService;
import com.shiftpay.mvp.service.ShiftSessionService;
import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

/**
 * Handles authenticated current-user convenience endpoints under {@code /api/v1/me}.
 *
 * <p>The shift history endpoint is available to any authenticated role, but {@link AttendanceService} always filters
 * by the current user's own worker-attendance records. The managed-shifts endpoint is for the foreman dashboard and
 * keeps minimal admin compatibility by returning creator-owned shifts only.</p>
 */
@RestController
@RequestMapping("/api/v1/me")
public class MeController {

	private final AttendanceService attendanceService;
	private final PayoutRequestService payoutRequestService;
	private final ShiftSessionService shiftSessionService;

	/**
	 * Creates the controller with services used for personal history and managed shift lookup.
	 *
	 * @param attendanceService service that reads current-user attendance history
	 * @param payoutRequestService service that owns payroll request workflows
	 * @param shiftSessionService service that reads shifts created by the current user
	 */
	public MeController(
			AttendanceService attendanceService,
			PayoutRequestService payoutRequestService,
			ShiftSessionService shiftSessionService
	) {
		this.attendanceService = attendanceService;
		this.payoutRequestService = payoutRequestService;
		this.shiftSessionService = shiftSessionService;
	}

	/**
	 * Handles {@code GET /api/v1/me/shifts}.
	 *
	 * @param principal authenticated user principal for any role
	 * @return current user's worker-attendance shift history
	 */
	@GetMapping("/shifts")
	public List<MyShiftHistoryResponse> getMyShiftHistory(
			@AuthenticationPrincipal AuthenticatedUserPrincipal principal
	) {
		return attendanceService.getMyShiftHistory(principal);
	}

	/**
	 * Handles {@code GET /api/v1/me/managed-shifts}.
	 *
	 * <p>Spring Security allows only FOREMAN and ADMIN. For the MVP both roles receive shifts created by the current
	 * user, keeping full admin listings for the later Vaadin admin UI. ADMIN users cannot create shifts through the
	 * REST/mobile API, so this is normally empty for admins.</p>
	 *
	 * @param principal authenticated foreman or admin principal
	 * @return shifts created by the current user, newest first
	 */
	@GetMapping("/managed-shifts")
	public List<ShiftResponse> getMyManagedShifts(
			@AuthenticationPrincipal AuthenticatedUserPrincipal principal
	) {
		return shiftSessionService.getMyManagedShifts(principal);
	}

	/**
	 * Handles {@code GET /api/v1/me/payable-attendances}.
	 *
	 * @param principal authenticated worker principal
	 * @return payable attendance rows for the current worker
	 */
	@GetMapping("/payable-attendances")
	public List<PayoutAttendanceResponse> getMyPayableAttendances(
			@AuthenticationPrincipal AuthenticatedUserPrincipal principal
	) {
		return payoutRequestService.getMyPayableAttendances(principal);
	}

	/**
	 * Handles {@code POST /api/v1/me/payout-requests/preview}.
	 *
	 * @param request explicit attendance id selection
	 * @param principal authenticated worker principal
	 * @return payout request preview totals and items
	 */
	@PostMapping("/payout-requests/preview")
	public PayoutRequestPreviewResponse previewMyPayoutRequest(
			@Valid @RequestBody PayoutSelectionRequest request,
			@AuthenticationPrincipal AuthenticatedUserPrincipal principal
	) {
		return payoutRequestService.previewMyPayoutRequest(request, principal);
	}

	/**
	 * Handles {@code POST /api/v1/me/payout-requests}.
	 *
	 * @param request explicit attendance id selection
	 * @param principal authenticated worker principal
	 * @return created payout request
	 */
	@PostMapping("/payout-requests")
	@ResponseStatus(HttpStatus.CREATED)
	public PayoutRequestResponse createMyPayoutRequest(
			@Valid @RequestBody PayoutSelectionRequest request,
			@AuthenticationPrincipal AuthenticatedUserPrincipal principal
	) {
		return payoutRequestService.createMyPayoutRequest(request, principal);
	}

	/**
	 * Handles {@code GET /api/v1/me/payout-requests}.
	 *
	 * @param status optional payout request status filter
	 * @param principal authenticated worker principal
	 * @return current worker payout requests
	 */
	@GetMapping("/payout-requests")
	public List<PayoutRequestResponse> getMyPayoutRequests(
			@RequestParam(required = false) PayoutRequestStatus status,
			@AuthenticationPrincipal AuthenticatedUserPrincipal principal
	) {
		return payoutRequestService.getMyPayoutRequests(status, principal);
	}

	/**
	 * Handles {@code GET /api/v1/me/managed-payout-requests}.
	 *
	 * @param status optional payout request status filter, defaults to PENDING
	 * @param principal authenticated foreman principal
	 * @return current foreman's managed payout requests
	 */
	@GetMapping("/managed-payout-requests")
	public List<PayoutRequestResponse> getMyManagedPayoutRequests(
			@RequestParam(required = false) PayoutRequestStatus status,
			@AuthenticationPrincipal AuthenticatedUserPrincipal principal
	) {
		return payoutRequestService.getMyManagedPayoutRequests(status, principal);
	}

	/**
	 * Handles {@code POST /api/v1/me/managed-payout-requests/{requestId}/approve}.
	 *
	 * @param requestId payout request id
	 * @param principal authenticated foreman principal
	 * @return approved payout request
	 */
	@PostMapping("/managed-payout-requests/{requestId}/approve")
	public PayoutRequestResponse approveManagedPayoutRequest(
			@PathVariable Long requestId,
			@AuthenticationPrincipal AuthenticatedUserPrincipal principal
	) {
		return payoutRequestService.approveManagedPayoutRequest(requestId, principal);
	}
}
