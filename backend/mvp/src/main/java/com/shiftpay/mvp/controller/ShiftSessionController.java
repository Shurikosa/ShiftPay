package com.shiftpay.mvp.controller;

import com.shiftpay.mvp.dto.CreateShiftRequest;
import com.shiftpay.mvp.dto.PauseResponse;
import com.shiftpay.mvp.dto.ShiftCloseRequest;
import com.shiftpay.mvp.dto.ShiftCloseResponse;
import com.shiftpay.mvp.dto.ShiftCreateResponse;
import com.shiftpay.mvp.dto.ShiftResponse;
import com.shiftpay.mvp.dto.ShiftStartResponse;
import com.shiftpay.mvp.dto.ShiftSummaryResponse;
import com.shiftpay.mvp.security.AuthenticatedUserPrincipal;
import com.shiftpay.mvp.service.ShiftSessionService;
import com.shiftpay.mvp.service.ShiftPauseService;
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
 * <p>Foremen use this controller to create, start, cancel, and close shifts. Foremen and admins can read supported shift
 * views. Role and ownership rules are enforced by Spring Security and {@link ShiftSessionService}.</p>
 */
@RestController
@RequestMapping("/api/v1/shifts")
public class ShiftSessionController {

	private final ShiftSessionService shiftSessionService;
	private final ShiftPauseService shiftPauseService;

	/**
	 * Creates the controller with the shift session business service.
	 *
	 * @param shiftSessionService service used for shift lifecycle and summary operations
	 */
	public ShiftSessionController(
			ShiftSessionService shiftSessionService,
			ShiftPauseService shiftPauseService
	) {
		this.shiftSessionService = shiftSessionService;
		this.shiftPauseService = shiftPauseService;
	}

	/**
	 * Handles {@code POST /api/v1/shifts}.
	 *
	 * @param request shift creation request
	 * @param principal authenticated foreman principal
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
	 * @param principal authenticated foreman principal
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
	 * Handles {@code POST /api/v1/shifts/{shiftId}/cancel}.
	 *
	 * @param shiftId shift id from the URL
	 * @param principal authenticated owner foreman principal
	 * @return cancelled shift details response
	 */
	@PostMapping("/{shiftId}/cancel")
	public ShiftResponse cancelShift(
			@PathVariable Long shiftId,
			@AuthenticationPrincipal AuthenticatedUserPrincipal principal
	) {
		return shiftSessionService.cancelShift(shiftId, principal);
	}

	/**
	 * Handles {@code POST /api/v1/shifts/{shiftId}/discard}.
	 *
	 * @param shiftId shift id from the URL
	 * @param principal authenticated owner foreman principal
	 * @return discarded shift details response
	 */
	@PostMapping("/{shiftId}/discard")
	public ShiftResponse discardShift(
			@PathVariable Long shiftId,
			@AuthenticationPrincipal AuthenticatedUserPrincipal principal
	) {
		return shiftSessionService.discardShift(shiftId, principal);
	}

	/**
	 * Handles {@code POST /api/v1/shifts/{shiftId}/pauses/me/start}.
	 *
	 * @param shiftId shift id from the URL
	 * @param principal authenticated worker or owner foreman principal
	 * @return started personal pause response
	 */
	@PostMapping("/{shiftId}/pauses/me/start")
	public PauseResponse startMyPause(
			@PathVariable Long shiftId,
			@AuthenticationPrincipal AuthenticatedUserPrincipal principal
	) {
		return shiftPauseService.startMyPause(shiftId, principal);
	}

	/**
	 * Handles {@code POST /api/v1/shifts/{shiftId}/pauses/me/end}.
	 *
	 * @param shiftId shift id from the URL
	 * @param principal authenticated worker or owner foreman principal
	 * @return ended personal pause response
	 */
	@PostMapping("/{shiftId}/pauses/me/end")
	public PauseResponse endMyPause(
			@PathVariable Long shiftId,
			@AuthenticationPrincipal AuthenticatedUserPrincipal principal
	) {
		return shiftPauseService.endMyPause(shiftId, principal);
	}

	/**
	 * Handles {@code POST /api/v1/shifts/{shiftId}/pauses/all/start}.
	 *
	 * @param shiftId shift id from the URL
	 * @param principal authenticated owner foreman principal
	 * @return started all-participant pause response
	 */
	@PostMapping("/{shiftId}/pauses/all/start")
	public PauseResponse startAllPause(
			@PathVariable Long shiftId,
			@AuthenticationPrincipal AuthenticatedUserPrincipal principal
	) {
		return shiftPauseService.startAllPause(shiftId, principal);
	}

	/**
	 * Handles {@code POST /api/v1/shifts/{shiftId}/pauses/all/end}.
	 *
	 * @param shiftId shift id from the URL
	 * @param principal authenticated owner foreman principal
	 * @return ended all-participant pause response
	 */
	@PostMapping("/{shiftId}/pauses/all/end")
	public PauseResponse endAllPause(
			@PathVariable Long shiftId,
			@AuthenticationPrincipal AuthenticatedUserPrincipal principal
	) {
		return shiftPauseService.endAllPause(shiftId, principal);
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
	 * @param principal authenticated foreman principal
	 * @return shift close response with actual end time
	 */
	@PostMapping("/{shiftId}/close")
	public ShiftCloseResponse closeShift(
			@PathVariable Long shiftId,
			@RequestBody(required = false) ShiftCloseRequest request,
			@AuthenticationPrincipal AuthenticatedUserPrincipal principal
	) {
		return shiftSessionService.closeShift(shiftId, request, principal);
	}
}
