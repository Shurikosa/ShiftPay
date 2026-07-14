package com.shiftpay.mvp.controller;

import com.shiftpay.mvp.dto.LoginRequest;
import com.shiftpay.mvp.dto.LoginResponse;
import com.shiftpay.mvp.dto.RegisterRequest;
import com.shiftpay.mvp.dto.UserResponse;
import com.shiftpay.mvp.service.AuthService;
import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

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

	/**
	 * Creates the controller with the authentication service.
	 *
	 * @param authService service used for registration and login
	 */
	public AuthController(AuthService authService) {
		this.authService = authService;
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
}
