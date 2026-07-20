package com.shiftpay.mvp.controller;

import com.shiftpay.mvp.dto.ApproveAttendanceRequest;
import com.shiftpay.mvp.dto.ApproveAttendanceResponse;
import com.shiftpay.mvp.dto.AttendanceResponse;
import com.shiftpay.mvp.dto.JoinShiftRequest;
import com.shiftpay.mvp.dto.JoinShiftResponse;
import com.shiftpay.mvp.security.AuthenticatedUserPrincipal;
import com.shiftpay.mvp.service.AttendanceService;
import jakarta.validation.Valid;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

/**
 * Handles shift attendance endpoints under {@code /api/v1/shifts}.
 *
 * <p>Workers can join shifts through this controller. Foremen and admins can list and approve attendance according
 * to the security rules and ownership checks enforced by {@link AttendanceService}.</p>
 */
@RestController
@RequestMapping("/api/v1/shifts")
public class AttendanceController {

	private final AttendanceService attendanceService;

	/**
	 * Creates the controller with the attendance business service.
	 *
	 * @param attendanceService service used for join, list, and approval workflows
	 */
	public AttendanceController(AttendanceService attendanceService) {
		this.attendanceService = attendanceService;
	}

	/**
	 * Handles {@code POST /api/v1/shifts/join} for worker shift joins.
	 *
	 * @param request join code request DTO
	 * @param principal authenticated worker principal
	 * @return created attendance response with the copied hourly-rate snapshot
	 */
	@PostMapping("/join")
	public JoinShiftResponse joinShift(
			@Valid @RequestBody JoinShiftRequest request,
			@AuthenticationPrincipal AuthenticatedUserPrincipal principal
	) {
		return attendanceService.joinShift(request, principal);
	}

	/**
	 * Handles {@code GET /api/v1/shifts/{shiftId}/attendance} for foreman/admin attendance review.
	 *
	 * @param shiftId shift id from the URL
	 * @param principal authenticated foreman or admin principal
	 * @return attendance rows for the shift
	 */
	@GetMapping("/{shiftId}/attendance")
	public List<AttendanceResponse> getShiftAttendance(
			@PathVariable Long shiftId,
			@AuthenticationPrincipal AuthenticatedUserPrincipal principal
	) {
		return attendanceService.getShiftAttendance(shiftId, principal);
	}

	/**
	 * Handles {@code POST /api/v1/shifts/{shiftId}/attendance/{attendanceId}/approve}.
	 *
	 * @param shiftId shift id from the URL
	 * @param attendanceId attendance id from the URL
	 * @param request optional approval body with an hourly-rate override
	 * @param principal authenticated foreman or admin principal
	 * @return approval response for the updated attendance
	 */
	@PostMapping("/{shiftId}/attendance/{attendanceId}/approve")
	public ApproveAttendanceResponse approveAttendance(
			@PathVariable Long shiftId,
			@PathVariable Long attendanceId,
			@Valid @RequestBody(required = false) ApproveAttendanceRequest request,
			@AuthenticationPrincipal AuthenticatedUserPrincipal principal
	) {
		return attendanceService.approveAttendance(shiftId, attendanceId, request, principal);
	}
}
