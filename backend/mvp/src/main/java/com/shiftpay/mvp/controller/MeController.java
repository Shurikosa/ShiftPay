package com.shiftpay.mvp.controller;

import com.shiftpay.mvp.dto.MyShiftHistoryResponse;
import com.shiftpay.mvp.security.AuthenticatedUserPrincipal;
import com.shiftpay.mvp.service.AttendanceService;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

@RestController
@RequestMapping("/api/v1/me")
public class MeController {

	private final AttendanceService attendanceService;

	public MeController(AttendanceService attendanceService) {
		this.attendanceService = attendanceService;
	}

	@GetMapping("/shifts")
	public List<MyShiftHistoryResponse> getMyShiftHistory(
			@AuthenticationPrincipal AuthenticatedUserPrincipal principal
	) {
		return attendanceService.getMyShiftHistory(principal);
	}
}
