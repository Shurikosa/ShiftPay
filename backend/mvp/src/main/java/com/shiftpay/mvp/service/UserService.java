package com.shiftpay.mvp.service;

import com.shiftpay.mvp.dto.LoginResponse;
import com.shiftpay.mvp.dto.UpdateMyNameRequest;
import com.shiftpay.mvp.dto.UpdateMyPasswordRequest;
import com.shiftpay.mvp.dto.UserResponse;
import com.shiftpay.mvp.entity.Role;
import com.shiftpay.mvp.entity.User;
import com.shiftpay.mvp.exception.ApiErrorException;
import com.shiftpay.mvp.exception.ForbiddenException;
import com.shiftpay.mvp.repository.UserRepository;
import com.shiftpay.mvp.security.AuthenticatedUserPrincipal;
import com.shiftpay.mvp.security.JwtAuthenticationException;
import com.shiftpay.mvp.security.JwtService;
import org.springframework.http.HttpStatus;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Clock;
import java.time.Instant;

/**
 * Business service for authenticated user profile lookups.
 *
 * <p>It loads the current user from the database and returns only public user data.</p>
 */
@Service
public class UserService {

	private final UserRepository userRepository;
	private final PasswordEncoder passwordEncoder;
	private final JwtService jwtService;
	private final CredentialRateLimitService rateLimitService;
	private final Clock clock;

	/**
	 * Creates the service with the user repository.
	 *
	 * @param userRepository user repository
	 */
	public UserService(
			UserRepository userRepository,
			PasswordEncoder passwordEncoder,
			JwtService jwtService,
			CredentialRateLimitService rateLimitService,
			Clock clock
	) {
		this.userRepository = userRepository;
		this.passwordEncoder = passwordEncoder;
		this.jwtService = jwtService;
		this.rateLimitService = rateLimitService;
		this.clock = clock;
	}

	/**
	 * Returns the current authenticated user's public profile.
	 *
	 * @param principal authenticated user principal
	 * @return public user response
	 */
	@Transactional(readOnly = true)
	public UserResponse getCurrentUser(AuthenticatedUserPrincipal principal) {
		return userRepository.findWithCompanyById(principal.id())
				.map(UserResponse::from)
				.orElseThrow(() -> new JwtAuthenticationException("Authenticated user not found"));
	}

	@Transactional
	public UserResponse updateMyName(UpdateMyNameRequest request, AuthenticatedUserPrincipal principal) {
		User user = userRepository.findCredentialByIdForUpdate(principal.id())
				.orElseThrow(() -> new JwtAuthenticationException("Authenticated user not found"));
		validateSelfServiceRole(user);
		user.setFirstName(request.firstName().trim());
		user.setLastName(request.lastName().trim());
		return UserResponse.from(user);
	}

	@Transactional(noRollbackFor = ApiErrorException.class)
	public LoginResponse updateMyPassword(UpdateMyPasswordRequest request, AuthenticatedUserPrincipal principal) {
		User user = userRepository.findCredentialByIdForUpdate(principal.id())
				.orElseThrow(() -> new JwtAuthenticationException("Authenticated user not found"));
		validateSelfServiceRole(user);
		if (user.getCredentialVersion() != principal.credentialVersion()) {
			throw new ApiErrorException(HttpStatus.CONFLICT, "CREDENTIAL_VERSION_CONFLICT",
					"Credentials changed concurrently");
		}

		Instant now = clock.instant();
		rateLimitService.assertCurrentPasswordAllowed(user, now);
		if (!passwordEncoder.matches(request.currentPassword(), user.getPasswordHash())) {
			rateLimitService.recordCurrentPasswordFailure(user, now);
			throw new ApiErrorException(HttpStatus.BAD_REQUEST, "CURRENT_PASSWORD_INCORRECT",
					"Current password is incorrect");
		}
		rateLimitService.clearCurrentPasswordFailures(user);
		if (passwordEncoder.matches(request.newPassword(), user.getPasswordHash())) {
			throw new ApiErrorException(HttpStatus.BAD_REQUEST, "PASSWORD_UNCHANGED",
					"New password must differ from the current password");
		}

		user.setPasswordHash(passwordEncoder.encode(request.newPassword()));
		user.setCredentialVersion(user.getCredentialVersion() + 1);
		userRepository.flush();
		return new LoginResponse(jwtService.generateAccessToken(user), "Bearer", UserResponse.from(user));
	}

	private void validateSelfServiceRole(User user) {
		if (user.getRole() != Role.WORKER && user.getRole() != Role.FOREMAN) {
			throw new ForbiddenException();
		}
	}
}
