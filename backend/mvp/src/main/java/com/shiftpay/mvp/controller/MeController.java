package com.shiftpay.mvp.controller;

import com.shiftpay.mvp.dto.MyShiftHistoryResponse;
import com.shiftpay.mvp.dto.ShiftResponse;
import com.shiftpay.mvp.security.AuthenticatedUserPrincipal;
import com.shiftpay.mvp.service.AttendanceService;
import com.shiftpay.mvp.service.ShiftSessionService;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

/**
 * Handles authenticated current-user convenience endpoints under {@code /api/v1/me}.
 *
 * <p>The shift history endpoint is available to any authenticated role, but {@link AttendanceService} always filters
 * by the current user's own worker-attendance records. The managed-shifts endpoint is for foreman/admin dashboards
 * and delegates creator-owned shift lookup to {@link ShiftSessionService}.</p>
 */
@RestController
@RequestMapping("/api/v1/me")
public class MeController {

	private final AttendanceService attendanceService;
	private final ShiftSessionService shiftSessionService;

	/**
	 * Creates the controller with services used for personal history and managed shift lookup.
	 *
	 * @param attendanceService service that reads current-user attendance history
	 * @param shiftSessionService service that reads shifts created by the current user
	 */
	public MeController(AttendanceService attendanceService, ShiftSessionService shiftSessionService) {
		this.attendanceService = attendanceService;
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
	 * user, keeping full admin listings for the later Vaadin admin UI.</p>
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
}
