package com.shiftpay.mvp.controller;

import com.shiftpay.mvp.dto.LoginRequest;
import com.shiftpay.mvp.dto.LoginResponse;
import com.shiftpay.mvp.dto.RegisterRequest;
import com.shiftpay.mvp.dto.RequestPasswordResetRequest;
import com.shiftpay.mvp.dto.RequestPasswordResetResponse;
import com.shiftpay.mvp.dto.ConfirmPasswordResetRequest;
import com.shiftpay.mvp.dto.UserResponse;
import com.shiftpay.mvp.service.AuthService;
import com.shiftpay.mvp.service.PasswordResetService;
import com.shiftpay.mvp.service.PasswordResetClientIpResolver;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

import java.util.concurrent.locks.LockSupport;

/**
 * Handles public authentication endpoints under {@code /api/v1/auth}.
 *
 * <p>Registration and login are intentionally unauthenticated. The controller validates request DTOs and delegates
 * password hashing, credential checks, and token creation to {@link AuthService}.</p>
 */
@RestController
@RequestMapping("/api/v1/auth")
public class AuthController {

	private final AuthService authService;
	private final PasswordResetService passwordResetService;
	private final PasswordResetClientIpResolver clientIpResolver;

	/**
	 * Creates the controller with the authentication service.
	 *
	 * @param authService service used for registration and login
	 */
	public AuthController(AuthService authService, PasswordResetService passwordResetService,
			PasswordResetClientIpResolver clientIpResolver) {
		this.authService = authService;
		this.passwordResetService = passwordResetService;
		this.clientIpResolver = clientIpResolver;
	}

	/**
	 * Handles {@code POST /api/v1/auth/register}.
	 *
	 * @param request public registration request
	 * @return public user response for the created account
	 */
	@PostMapping("/register")
	@ResponseStatus(HttpStatus.CREATED)
	public UserResponse register(@Valid @RequestBody RegisterRequest request) {
		return authService.register(request);
	}

	/**
	 * Handles {@code POST /api/v1/auth/login}.
	 *
	 * @param request login request with email and password
	 * @return access token and public user data
	 */
	@PostMapping("/login")
	public LoginResponse login(@Valid @RequestBody LoginRequest request) {
		return authService.login(request);
	}

	@PostMapping("/password-reset/request")
	@ResponseStatus(HttpStatus.ACCEPTED)
	public RequestPasswordResetResponse requestPasswordReset(
			@Valid @RequestBody RequestPasswordResetRequest request, HttpServletRequest httpRequest) {
		long began = System.nanoTime();
		RequestPasswordResetResponse response =
				passwordResetService.request(request.email(), clientIpResolver.resolve(httpRequest));
		// Keep normal real and dummy lookups in the same response-time envelope.
		long remaining = 120_000_000L - (System.nanoTime() - began);
		if (remaining > 0 && !Thread.currentThread().isInterrupted()) {
			LockSupport.parkNanos(remaining);
		}
		return response;
	}

	@PostMapping("/password-reset/confirm")
	@ResponseStatus(HttpStatus.NO_CONTENT)
	public void confirmPasswordReset(@Valid @RequestBody ConfirmPasswordResetRequest request) {
		passwordResetService.confirm(request);
	}
}
