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

/**
 * Handles shift session endpoints under {@code /api/v1/shifts}.
 *
 * <p>Foremen and admins use this controller to create, read, start, close, and summarize shifts. Role and ownership
 * rules are enforced by Spring Security and {@link ShiftSessionService}.</p>
 */
@RestController
@RequestMapping("/api/v1/shifts")
public class ShiftSessionController {

	private final ShiftSessionService shiftSessionService;

	/**
	 * Creates the controller with the shift session business service.
	 *
	 * @param shiftSessionService service used for shift lifecycle and summary operations
	 */
	public ShiftSessionController(ShiftSessionService shiftSessionService) {
		this.shiftSessionService = shiftSessionService;
	}

	/**
	 * Handles {@code POST /api/v1/shifts}.
	 *
	 * @param request shift creation request
	 * @param principal authenticated foreman or admin principal
	 * @return created shift response with generated join code
	 */
	@PostMapping
	@ResponseStatus(HttpStatus.CREATED)
	public ShiftCreateResponse createShift(
			@Valid @RequestBody CreateShiftRequest request,
			@AuthenticationPrincipal AuthenticatedUserPrincipal principal
	) {
		return shiftSessionService.createShift(request, principal);
	}

	/**
	 * Handles {@code GET /api/v1/shifts/{shiftId}}.
	 *
	 * @param shiftId shift id from the URL
	 * @param principal authenticated foreman or admin principal
	 * @return shift details response
	 */
	@GetMapping("/{shiftId}")
	public ShiftResponse getShift(
			@PathVariable Long shiftId,
			@AuthenticationPrincipal AuthenticatedUserPrincipal principal
	) {
		return shiftSessionService.getShift(shiftId, principal);
	}

	/**
	 * Handles {@code POST /api/v1/shifts/{shiftId}/start}.
	 *
	 * @param shiftId shift id from the URL
	 * @param principal authenticated foreman or admin principal
	 * @return shift start response with actual start time
	 */
	@PostMapping("/{shiftId}/start")
	public ShiftStartResponse startShift(
			@PathVariable Long shiftId,
			@AuthenticationPrincipal AuthenticatedUserPrincipal principal
	) {
		return shiftSessionService.startShift(shiftId, principal);
	}

	/**
	 * Handles {@code GET /api/v1/shifts/{shiftId}/summary}.
	 *
	 * @param shiftId shift id from the URL
	 * @param principal authenticated foreman or admin principal
	 * @return closed shift salary summary
	 */
	@GetMapping("/{shiftId}/summary")
	public ShiftSummaryResponse getShiftSummary(
			@PathVariable Long shiftId,
			@AuthenticationPrincipal AuthenticatedUserPrincipal principal
	) {
		return shiftSessionService.getShiftSummary(shiftId, principal);
	}

	/**
	 * Handles {@code POST /api/v1/shifts/{shiftId}/close}.
	 *
	 * @param shiftId shift id from the URL
	 * @param principal authenticated foreman or admin principal
	 * @return shift close response with actual end time
	 */
	@PostMapping("/{shiftId}/close")
	public ShiftCloseResponse closeShift(
			@PathVariable Long shiftId,
			@AuthenticationPrincipal AuthenticatedUserPrincipal principal
	) {
		return shiftSessionService.closeShift(shiftId, principal);
	}
}
