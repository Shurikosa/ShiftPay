package com.shiftpay.mvp.controller;

import com.shiftpay.mvp.dto.CreateShiftRequest;
import com.shiftpay.mvp.dto.ShiftCloseResponse;
import com.shiftpay.mvp.dto.ShiftCreateResponse;
import com.shiftpay.mvp.dto.ShiftResponse;
import com.shiftpay.mvp.dto.ShiftStartResponse;
import com.shiftpay.mvp.dto.ShiftSummaryResponse;
import com.shiftpay.mvp.security.AuthenticatedUserPrincipal;
import com.shiftpay.mvp.service.ShiftSessionService;
import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/v1/shifts")
public class ShiftSessionController {

	private final ShiftSessionService shiftSessionService;

	public ShiftSessionController(ShiftSessionService shiftSessionService) {
		this.shiftSessionService = shiftSessionService;
	}

	@PostMapping
	@ResponseStatus(HttpStatus.CREATED)
	public ShiftCreateResponse createShift(
			@Valid @RequestBody CreateShiftRequest request,
			@AuthenticationPrincipal AuthenticatedUserPrincipal principal
	) {
		return shiftSessionService.createShift(request, principal);
	}

	@GetMapping("/{shiftId}")
	public ShiftResponse getShift(
			@PathVariable Long shiftId,
			@AuthenticationPrincipal AuthenticatedUserPrincipal principal
	) {
		return shiftSessionService.getShift(shiftId, principal);
	}

	@PostMapping("/{shiftId}/start")
	public ShiftStartResponse startShift(
			@PathVariable Long shiftId,
			@AuthenticationPrincipal AuthenticatedUserPrincipal principal
	) {
		return shiftSessionService.startShift(shiftId, principal);
	}

	@GetMapping("/{shiftId}/summary")
	public ShiftSummaryResponse getShiftSummary(
			@PathVariable Long shiftId,
			@AuthenticationPrincipal AuthenticatedUserPrincipal principal
	) {
		return shiftSessionService.getShiftSummary(shiftId, principal);
	}

	@PostMapping("/{shiftId}/close")
	public ShiftCloseResponse closeShift(
			@PathVariable Long shiftId,
			@AuthenticationPrincipal AuthenticatedUserPrincipal principal
	) {
		return shiftSessionService.closeShift(shiftId, principal);
	}
}
