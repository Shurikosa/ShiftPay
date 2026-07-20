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

/**
 * Business service for registration and login.
 *
 * <p>It normalizes emails, enforces public registration roles, hashes passwords before storage, verifies credentials,
 * and issues JWT access tokens for successful authentication.</p>
 */
@Service
public class AuthService {

	private final UserRepository userRepository;
	private final PasswordEncoder passwordEncoder;
	private final JwtService jwtService;

	/**
	 * Creates the service with persistence, password hashing, and JWT dependencies.
	 *
	 * @param userRepository user repository
	 * @param passwordEncoder password hashing and verification component
	 * @param jwtService JWT token service
	 */
	public AuthService(UserRepository userRepository, PasswordEncoder passwordEncoder, JwtService jwtService) {
		this.userRepository = userRepository;
		this.passwordEncoder = passwordEncoder;
		this.jwtService = jwtService;
	}

	/**
	 * Registers a new public user account.
	 *
	 * <p>Only WORKER and FOREMAN are accepted through public registration. Email is normalized, duplicate email
	 * conflicts return 409, and the password is stored only as a BCrypt hash.</p>
	 *
	 * @param request registration request
	 * @return public user response for the created account
	 */
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

	/**
	 * Authenticates a user by email and password.
	 *
	 * @param request login request
	 * @return JWT access token and public user data
	 */
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

	/**
	 * Enforces which roles may be created through public registration.
	 *
	 * @param role requested registration role
	 */
	private void validatePublicRegistrationRole(Role role) {
		if (role != Role.WORKER && role != Role.FOREMAN) {
			throw new BadRequestException("Public registration supports only WORKER and FOREMAN");
		}
	}

	/**
	 * Normalizes email addresses for lookup and uniqueness checks.
	 *
	 * @param email request email
	 * @return trimmed lowercase email
	 */
	private String normalizeEmail(String email) {
		return email.trim().toLowerCase(Locale.ROOT);
	}
}
