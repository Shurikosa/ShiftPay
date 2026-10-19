package com.shiftpay.mvp.controller;

import com.shiftpay.mvp.dto.ConfirmMyEmailChangeRequest;
import com.shiftpay.mvp.dto.ApiErrorResponse;
import com.shiftpay.mvp.dto.LoginResponse;
import com.shiftpay.mvp.dto.PendingEmailChangeResponse;
import com.shiftpay.mvp.dto.StartMyEmailChangeRequest;
import com.shiftpay.mvp.dto.UpdateMyNameRequest;
import com.shiftpay.mvp.dto.UpdateMyPasswordRequest;
import com.shiftpay.mvp.dto.UserResponse;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.headers.Header;
import io.swagger.v3.oas.annotations.media.Content;
import io.swagger.v3.oas.annotations.media.Schema;
import io.swagger.v3.oas.annotations.responses.ApiResponse;
import io.swagger.v3.oas.annotations.responses.ApiResponses;
import com.shiftpay.mvp.security.AuthenticatedUserPrincipal;
import com.shiftpay.mvp.service.EmailChangeService;
import com.shiftpay.mvp.service.UserService;
import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

/**
 * Handles authenticated user profile endpoints under {@code /api/v1/users}.
 *
 * <p>The current-user endpoint calls {@link UserService} and returns public user data without password hashes.</p>
 */
@RestController
@RequestMapping("/api/v1/users")
public class UserController {

	private final UserService userService;
	private final EmailChangeService emailChangeService;

	/**
	 * Creates the controller with the user service.
	 *
	 * @param userService service used for current-user lookup
	 */
	public UserController(UserService userService, EmailChangeService emailChangeService) {
		this.userService = userService;
		this.emailChangeService = emailChangeService;
	}

	/**
	 * Handles {@code GET /api/v1/users/me}.
	 *
	 * @param principal authenticated user principal
	 * @return current user's public profile data
	 */
	@GetMapping("/me")
	public UserResponse getCurrentUser(@AuthenticationPrincipal AuthenticatedUserPrincipal principal) {
		return userService.getCurrentUser(principal);
	}

	@PutMapping(value = "/me", consumes = MediaType.APPLICATION_JSON_VALUE, produces = MediaType.APPLICATION_JSON_VALUE)
	@Operation(summary = "Update the authenticated user's complete name")
	@ApiResponses({
			@ApiResponse(responseCode = "200", description = "Name updated",
					content = @Content(schema = @Schema(implementation = UserResponse.class))),
			@ApiResponse(responseCode = "400", description = "Invalid or incomplete name",
					content = @Content(schema = @Schema(implementation = ApiErrorResponse.class))),
			@ApiResponse(responseCode = "401", description = "Missing, invalid, expired, or revoked session",
					content = @Content(schema = @Schema(implementation = ApiErrorResponse.class))),
			@ApiResponse(responseCode = "403", description = "Role cannot update own settings",
					content = @Content(schema = @Schema(implementation = ApiErrorResponse.class)))
	})
	public UserResponse updateMyName(
			@Valid @RequestBody UpdateMyNameRequest request,
			@AuthenticationPrincipal AuthenticatedUserPrincipal principal
	) {
		return userService.updateMyName(request, principal);
	}

	@PostMapping(value = "/me/email-change", consumes = MediaType.APPLICATION_JSON_VALUE,
			produces = MediaType.APPLICATION_JSON_VALUE)
	@Operation(summary = "Start a verified email change")
	@ApiResponses({
			@ApiResponse(responseCode = "202", description = "Verification message accepted",
					content = @Content(schema = @Schema(implementation = PendingEmailChangeResponse.class))),
			@ApiResponse(responseCode = "400", description = "Validation, CURRENT_PASSWORD_INCORRECT, or EMAIL_UNCHANGED",
					content = @Content(schema = @Schema(implementation = ApiErrorResponse.class))),
			@ApiResponse(responseCode = "401", description = "Missing, invalid, expired, or SESSION_REVOKED session",
					content = @Content(schema = @Schema(implementation = ApiErrorResponse.class))),
			@ApiResponse(responseCode = "403", description = "Role cannot change own email",
					content = @Content(schema = @Schema(implementation = ApiErrorResponse.class))),
			@ApiResponse(responseCode = "409", description = "EMAIL_CHANGE_ALREADY_PENDING or EMAIL_ALREADY_IN_USE",
					content = @Content(schema = @Schema(implementation = ApiErrorResponse.class))),
			@ApiResponse(responseCode = "429", description = "EMAIL_CHANGE_RATE_LIMITED or CURRENT_PASSWORD_RATE_LIMITED",
					headers = @Header(name = "Retry-After", description = "Whole seconds before retry",
							schema = @Schema(type = "integer", format = "int64", minimum = "1")),
					content = @Content(schema = @Schema(implementation = ApiErrorResponse.class))),
			@ApiResponse(responseCode = "503", description = "EMAIL_DELIVERY_UNAVAILABLE",
					content = @Content(schema = @Schema(implementation = ApiErrorResponse.class)))
	})
	public ResponseEntity<PendingEmailChangeResponse> startEmailChange(
			@Valid @RequestBody StartMyEmailChangeRequest request,
			@AuthenticationPrincipal AuthenticatedUserPrincipal principal
	) {
		return ResponseEntity.status(HttpStatus.ACCEPTED).body(emailChangeService.start(request, principal));
	}

	@GetMapping(value = "/me/email-change", produces = MediaType.APPLICATION_JSON_VALUE)
	@Operation(summary = "Read active pending email-change metadata")
	@ApiResponses({
			@ApiResponse(responseCode = "200", description = "Active pending email change",
					content = @Content(schema = @Schema(implementation = PendingEmailChangeResponse.class))),
			@ApiResponse(responseCode = "204", description = "No active pending email change"),
			@ApiResponse(responseCode = "401", description = "Missing, invalid, expired, or revoked session",
					content = @Content(schema = @Schema(implementation = ApiErrorResponse.class))),
			@ApiResponse(responseCode = "403", description = "Role cannot change own email",
					content = @Content(schema = @Schema(implementation = ApiErrorResponse.class)))
	})
	public ResponseEntity<PendingEmailChangeResponse> getEmailChange(
			@AuthenticationPrincipal AuthenticatedUserPrincipal principal
	) {
		return emailChangeService.status(principal)
				.map(ResponseEntity::ok)
				.orElseGet(() -> ResponseEntity.noContent().build());
	}

	@PostMapping(value = "/me/email-change/confirm", consumes = MediaType.APPLICATION_JSON_VALUE,
			produces = MediaType.APPLICATION_JSON_VALUE)
	@Operation(summary = "Confirm an email change and replace the current session")
	@ApiResponses({
			@ApiResponse(responseCode = "200", description = "Email changed and replacement session issued",
					content = @Content(schema = @Schema(implementation = LoginResponse.class))),
			@ApiResponse(responseCode = "400", description = "INVALID_EMAIL_VERIFICATION_CODE with attemptsRemaining",
					content = @Content(schema = @Schema(implementation = ApiErrorResponse.class))),
			@ApiResponse(responseCode = "401", description = "Missing, invalid, expired, or SESSION_REVOKED session",
					content = @Content(schema = @Schema(implementation = ApiErrorResponse.class))),
			@ApiResponse(responseCode = "403", description = "Role cannot change own email",
					content = @Content(schema = @Schema(implementation = ApiErrorResponse.class))),
			@ApiResponse(responseCode = "409", description = "EMAIL_VERIFICATION_ATTEMPTS_EXHAUSTED, EMAIL_ALREADY_IN_USE, or CREDENTIAL_VERSION_CONFLICT",
					content = @Content(schema = @Schema(implementation = ApiErrorResponse.class))),
			@ApiResponse(responseCode = "410", description = "EMAIL_VERIFICATION_CODE_EXPIRED or EMAIL_CHANGE_EXPIRED",
					content = @Content(schema = @Schema(implementation = ApiErrorResponse.class)))
	})
	public LoginResponse confirmEmailChange(
			@io.swagger.v3.oas.annotations.parameters.RequestBody(required = true)
			@RequestBody(required = false) ConfirmMyEmailChangeRequest request,
			@AuthenticationPrincipal AuthenticatedUserPrincipal principal
	) {
		return emailChangeService.confirm(request, principal);
	}

	@PostMapping(value = "/me/email-change/resend", produces = MediaType.APPLICATION_JSON_VALUE)
	@Operation(summary = "Resend the email-change verification code")
	@ApiResponses({
			@ApiResponse(responseCode = "200", description = "Replacement verification message accepted",
					content = @Content(schema = @Schema(implementation = PendingEmailChangeResponse.class))),
			@ApiResponse(responseCode = "401", description = "Missing, invalid, expired, or revoked session",
					content = @Content(schema = @Schema(implementation = ApiErrorResponse.class))),
			@ApiResponse(responseCode = "403", description = "Role cannot change own email",
					content = @Content(schema = @Schema(implementation = ApiErrorResponse.class))),
			@ApiResponse(responseCode = "409", description = "EMAIL_VERIFICATION_RESENDS_EXHAUSTED",
					content = @Content(schema = @Schema(implementation = ApiErrorResponse.class))),
			@ApiResponse(responseCode = "410", description = "EMAIL_CHANGE_EXPIRED",
					content = @Content(schema = @Schema(implementation = ApiErrorResponse.class))),
			@ApiResponse(responseCode = "429", description = "EMAIL_CHANGE_RATE_LIMITED",
					headers = @Header(name = "Retry-After", description = "Whole seconds before retry",
							schema = @Schema(type = "integer", format = "int64", minimum = "1")),
					content = @Content(schema = @Schema(implementation = ApiErrorResponse.class))),
			@ApiResponse(responseCode = "503", description = "EMAIL_DELIVERY_UNAVAILABLE",
					content = @Content(schema = @Schema(implementation = ApiErrorResponse.class)))
	})
	public PendingEmailChangeResponse resendEmailChange(
			@AuthenticationPrincipal AuthenticatedUserPrincipal principal
	) {
		return emailChangeService.resend(principal);
	}

	@DeleteMapping("/me/email-change")
	@Operation(summary = "Cancel a pending email change")
	@ApiResponses({
			@ApiResponse(responseCode = "204", description = "Pending email change absent or cancelled"),
			@ApiResponse(responseCode = "401", description = "Missing, invalid, expired, or revoked session",
					content = @Content(schema = @Schema(implementation = ApiErrorResponse.class))),
			@ApiResponse(responseCode = "403", description = "Role cannot change own email",
					content = @Content(schema = @Schema(implementation = ApiErrorResponse.class)))
	})
	public ResponseEntity<Void> cancelEmailChange(
			@AuthenticationPrincipal AuthenticatedUserPrincipal principal
	) {
		emailChangeService.cancel(principal);
		return ResponseEntity.noContent().build();
	}

	@PutMapping(value = "/me/password", consumes = MediaType.APPLICATION_JSON_VALUE,
			produces = MediaType.APPLICATION_JSON_VALUE)
	@Operation(summary = "Change password and replace the current session")
	@ApiResponses({
			@ApiResponse(responseCode = "200", description = "Password changed and replacement session issued",
					content = @Content(schema = @Schema(implementation = LoginResponse.class))),
			@ApiResponse(responseCode = "400", description = "Validation, CURRENT_PASSWORD_INCORRECT, or PASSWORD_UNCHANGED",
					content = @Content(schema = @Schema(implementation = ApiErrorResponse.class))),
			@ApiResponse(responseCode = "401", description = "Missing, invalid, expired, or SESSION_REVOKED session",
					content = @Content(schema = @Schema(implementation = ApiErrorResponse.class))),
			@ApiResponse(responseCode = "403", description = "Role cannot change own password",
					content = @Content(schema = @Schema(implementation = ApiErrorResponse.class))),
			@ApiResponse(responseCode = "409", description = "CREDENTIAL_VERSION_CONFLICT",
					content = @Content(schema = @Schema(implementation = ApiErrorResponse.class))),
			@ApiResponse(responseCode = "429", description = "CURRENT_PASSWORD_RATE_LIMITED",
					headers = @Header(name = "Retry-After", description = "Whole seconds before retry",
							schema = @Schema(type = "integer", format = "int64", minimum = "1")),
					content = @Content(schema = @Schema(implementation = ApiErrorResponse.class)))
	})
	public LoginResponse updateMyPassword(
			@Valid @RequestBody UpdateMyPasswordRequest request,
			@AuthenticationPrincipal AuthenticatedUserPrincipal principal
	) {
		return userService.updateMyPassword(request, principal);
	}
}
