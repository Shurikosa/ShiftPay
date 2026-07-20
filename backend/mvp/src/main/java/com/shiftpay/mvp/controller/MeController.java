package com.shiftpay.mvp.controller;

import com.shiftpay.mvp.dto.MyShiftHistoryResponse;
import com.shiftpay.mvp.security.AuthenticatedUserPrincipal;
import com.shiftpay.mvp.service.AttendanceService;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

/**
 * Handles authenticated current-user convenience endpoints under {@code /api/v1/me}.
 *
 * <p>The shift history endpoint is available to any authenticated role, but {@link AttendanceService} always filters
 * by the current user's own worker-attendance records.</p>
 */
@RestController
@RequestMapping("/api/v1/me")
public class MeController {

	private final AttendanceService attendanceService;

	/**
	 * Creates the controller with the attendance service used for personal history lookup.
	 *
	 * @param attendanceService service that reads current-user attendance history
	 */
	public MeController(AttendanceService attendanceService) {
		this.attendanceService = attendanceService;
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
}
