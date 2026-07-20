package com.shiftpay.mvp.service;

import com.shiftpay.mvp.dto.UserResponse;
import com.shiftpay.mvp.repository.UserRepository;
import com.shiftpay.mvp.security.AuthenticatedUserPrincipal;
import com.shiftpay.mvp.security.JwtAuthenticationException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * Business service for authenticated user profile lookups.
 *
 * <p>It loads the current user from the database and returns only public user data.</p>
 */
@Service
public class UserService {

	private final UserRepository userRepository;

	/**
	 * Creates the service with the user repository.
	 *
	 * @param userRepository user repository
	 */
	public UserService(UserRepository userRepository) {
		this.userRepository = userRepository;
	}

	/**
	 * Returns the current authenticated user's public profile.
	 *
	 * @param principal authenticated user principal
	 * @return public user response
	 */
	@Transactional(readOnly = true)
	public UserResponse getCurrentUser(AuthenticatedUserPrincipal principal) {
		return userRepository.findById(principal.id())
				.map(UserResponse::from)
				.orElseThrow(() -> new JwtAuthenticationException("Authenticated user not found"));
	}
}
