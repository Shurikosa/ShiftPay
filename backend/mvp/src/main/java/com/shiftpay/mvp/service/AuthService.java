package com.shiftpay.mvp.service;

import com.shiftpay.mvp.dto.LoginRequest;
import com.shiftpay.mvp.dto.LoginResponse;
import com.shiftpay.mvp.dto.RegisterRequest;
import com.shiftpay.mvp.dto.UserResponse;
import com.shiftpay.mvp.entity.Role;
import com.shiftpay.mvp.entity.User;
import com.shiftpay.mvp.exception.BadRequestException;
import com.shiftpay.mvp.exception.DuplicateEmailException;
import com.shiftpay.mvp.exception.InvalidCredentialsException;
import com.shiftpay.mvp.repository.UserRepository;
import com.shiftpay.mvp.security.JwtService;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.Locale;

@Service
public class AuthService {

	private final UserRepository userRepository;
	private final PasswordEncoder passwordEncoder;
	private final JwtService jwtService;

	public AuthService(UserRepository userRepository, PasswordEncoder passwordEncoder, JwtService jwtService) {
		this.userRepository = userRepository;
		this.passwordEncoder = passwordEncoder;
		this.jwtService = jwtService;
	}

	@Transactional
	public UserResponse register(RegisterRequest request) {
		validatePublicRegistrationRole(request.role());

		String normalizedEmail = normalizeEmail(request.email());
		if (userRepository.existsByEmail(normalizedEmail)) {
			throw new DuplicateEmailException(normalizedEmail);
		}

		User user = new User();
		user.setEmail(normalizedEmail);
		user.setPasswordHash(passwordEncoder.encode(request.password()));
		user.setFirstName(request.firstName().trim());
		user.setLastName(request.lastName().trim());
		user.setRole(request.role());

		return UserResponse.from(userRepository.save(user));
	}

	@Transactional(readOnly = true)
	public LoginResponse login(LoginRequest request) {
		String normalizedEmail = normalizeEmail(request.email());
		User user = userRepository.findByEmail(normalizedEmail)
				.orElseThrow(InvalidCredentialsException::new);

		if (!passwordEncoder.matches(request.password(), user.getPasswordHash())) {
			throw new InvalidCredentialsException();
		}

		return new LoginResponse(jwtService.generateAccessToken(user), "Bearer", UserResponse.from(user));
	}

	private void validatePublicRegistrationRole(Role role) {
		if (role != Role.WORKER && role != Role.FOREMAN) {
			throw new BadRequestException("Public registration supports only WORKER and FOREMAN");
		}
	}

	private String normalizeEmail(String email) {
		return email.trim().toLowerCase(Locale.ROOT);
	}
}
