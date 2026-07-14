package com.shiftpay.mvp.controller;

import com.shiftpay.mvp.dto.UserResponse;
import com.shiftpay.mvp.security.AuthenticatedUserPrincipal;
import com.shiftpay.mvp.service.UserService;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.GetMapping;
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

	/**
	 * Creates the controller with the user service.
	 *
	 * @param userService service used for current-user lookup
	 */
	public UserController(UserService userService) {
		this.userService = userService;
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
}
