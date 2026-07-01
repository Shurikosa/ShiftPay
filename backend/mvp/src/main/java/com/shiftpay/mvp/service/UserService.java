package com.shiftpay.mvp.service;

import com.shiftpay.mvp.dto.UserResponse;
import com.shiftpay.mvp.repository.UserRepository;
import com.shiftpay.mvp.security.AuthenticatedUserPrincipal;
import com.shiftpay.mvp.security.JwtAuthenticationException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class UserService {

	private final UserRepository userRepository;

	public UserService(UserRepository userRepository) {
		this.userRepository = userRepository;
	}

	@Transactional(readOnly = true)
	public UserResponse getCurrentUser(AuthenticatedUserPrincipal principal) {
		return userRepository.findById(principal.id())
				.map(UserResponse::from)
				.orElseThrow(() -> new JwtAuthenticationException("Authenticated user not found"));
	}
}
