package com.shiftpay.mvp.service;

import com.shiftpay.mvp.dto.ConfirmMyEmailChangeRequest;
import com.shiftpay.mvp.dto.LoginResponse;
import com.shiftpay.mvp.dto.PendingEmailChangeResponse;
import com.shiftpay.mvp.dto.StartMyEmailChangeRequest;
import com.shiftpay.mvp.dto.UserResponse;
import com.shiftpay.mvp.entity.PendingEmailChange;
import com.shiftpay.mvp.entity.Role;
import com.shiftpay.mvp.entity.User;
import com.shiftpay.mvp.exception.ApiErrorException;
import com.shiftpay.mvp.exception.ForbiddenException;
import com.shiftpay.mvp.repository.PendingEmailChangeRepository;
import com.shiftpay.mvp.repository.UserRepository;
import com.shiftpay.mvp.security.AuthenticatedUserPrincipal;
import com.shiftpay.mvp.security.JwtAuthenticationException;
import com.shiftpay.mvp.security.JwtService;
import org.springframework.http.HttpStatus;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.security.SecureRandom;
import java.time.Clock;
import java.time.Duration;
import java.time.Instant;
import java.util.Locale;
import java.util.Optional;

@Service
public class EmailChangeService {

	private static final Duration PENDING_LIFETIME = Duration.ofMinutes(30);
	private static final Duration CODE_LIFETIME = Duration.ofMinutes(10);
	private static final Duration RESEND_COOLDOWN = Duration.ofSeconds(60);
	private static final int MAX_RESENDS = 3;
	private static final int MAX_ATTEMPTS = 5;

	private final UserRepository userRepository;
	private final PendingEmailChangeRepository pendingRepository;
	private final PasswordEncoder passwordEncoder;
	private final JwtService jwtService;
	private final CredentialRateLimitService rateLimitService;
	private final EmailChangeDelivery delivery;
	private final EmailIdentityLockService emailIdentityLockService;
	private final Clock clock;
	private final SecureRandom secureRandom = new SecureRandom();

	public EmailChangeService(
			UserRepository userRepository,
			PendingEmailChangeRepository pendingRepository,
			PasswordEncoder passwordEncoder,
			JwtService jwtService,
			CredentialRateLimitService rateLimitService,
			EmailChangeDelivery delivery,
			EmailIdentityLockService emailIdentityLockService,
			Clock clock
	) {
		this.userRepository = userRepository;
		this.pendingRepository = pendingRepository;
		this.passwordEncoder = passwordEncoder;
		this.jwtService = jwtService;
		this.rateLimitService = rateLimitService;
		this.delivery = delivery;
		this.emailIdentityLockService = emailIdentityLockService;
		this.clock = clock;
	}

	@Transactional(noRollbackFor = ApiErrorException.class)
	public PendingEmailChangeResponse start(
			StartMyEmailChangeRequest request,
			AuthenticatedUserPrincipal principal
	) {
		User user = lockedUser(principal.id());
		validateRole(user);
		Instant now = clock.instant();
		Optional<PendingEmailChange> existing = pendingRepository.findByUserIdForUpdate(user.getId());
		if (existing.isPresent() && !isExpired(existing.get(), now)) {
			throw error(HttpStatus.CONFLICT, "EMAIL_CHANGE_ALREADY_PENDING", "Email change is already pending");
		}

		verifyCurrentPassword(user, request.currentPassword(), now);
		String newEmail = EmailNormalizer.normalize(request.newEmail());
		if (newEmail.equals(user.getEmail())) {
			throw error(HttpStatus.BAD_REQUEST, "EMAIL_UNCHANGED", "New email must differ from the current email");
		}
		emailIdentityLockService.acquire(newEmail);
		if (userRepository.existsByEmail(newEmail)) {
			throw error(HttpStatus.CONFLICT, "EMAIL_ALREADY_IN_USE", "Email is already in use");
		}
		rateLimitService.assertEmailStartAllowed(user, now);
		rateLimitService.assertTargetDeliveryAllowed(newEmail, now);

		String code = existing
				.map(change -> newCode(change.getVerificationCodeHash()))
				.orElseGet(this::newCode);
		Instant expiresAt = now.plus(PENDING_LIFETIME);
		Instant codeExpiresAt = earlier(now.plus(CODE_LIFETIME), expiresAt);
		if (!deliver(newEmail, code, codeExpiresAt)) {
			throw error(HttpStatus.SERVICE_UNAVAILABLE, "EMAIL_DELIVERY_UNAVAILABLE",
					"Email delivery is unavailable");
		}

		// Reuse an expired row in place. Deleting it and inserting a replacement in the
		// same persistence context lets Hibernate execute the insert first, violating
		// the one-row-per-user constraint on PostgreSQL. No expired-row fields are
		// changed until delivery succeeds, so a delivery failure still leaves no active
		// pending change.
		PendingEmailChange change = existing.orElseGet(PendingEmailChange::new);
		if (existing.isEmpty()) {
			change.setUser(user);
		}
		change.setNormalizedNewEmail(newEmail);
		change.setVerificationCodeHash(passwordEncoder.encode(code));
		change.setExpiresAt(expiresAt);
		change.setCodeExpiresAt(codeExpiresAt);
		change.setResendAvailableAt(now.plus(RESEND_COOLDOWN));
		change.setResendCount(0);
		change.setFailedAttemptCount(0);
		pendingRepository.save(change);
		rateLimitService.recordAcceptedStart(user, newEmail, now);
		return PendingEmailChangeResponse.from(change);
	}

	@Transactional
	public Optional<PendingEmailChangeResponse> status(AuthenticatedUserPrincipal principal) {
		User user = lockedUser(principal.id());
		validateRole(user);
		Optional<PendingEmailChange> pending = pendingRepository.findByUserIdForUpdate(user.getId());
		if (pending.isEmpty()) {
			return Optional.empty();
		}
		if (isExpired(pending.get(), clock.instant())) {
			pendingRepository.delete(pending.get());
			return Optional.empty();
		}
		return pending.map(PendingEmailChangeResponse::from);
	}

	@Transactional(noRollbackFor = ApiErrorException.class)
	public LoginResponse confirm(
			ConfirmMyEmailChangeRequest request,
			AuthenticatedUserPrincipal principal
	) {
		User user = lockedUser(principal.id());
		validateRole(user);
		if (user.getCredentialVersion() != principal.credentialVersion()) {
			throw error(HttpStatus.CONFLICT, "CREDENTIAL_VERSION_CONFLICT", "Credentials changed concurrently");
		}
		Instant now = clock.instant();
		PendingEmailChange change = activePendingForMutation(user, now);
		if (!now.isBefore(change.getCodeExpiresAt())) {
			throw error(HttpStatus.GONE, "EMAIL_VERIFICATION_CODE_EXPIRED", "Email verification code expired");
		}

		String code = request == null ? null : request.code();
		boolean validFormat = code != null && code.matches("[0-9]{6}");
		boolean matches = validFormat && passwordEncoder.matches(code, change.getVerificationCodeHash());
		if (!matches) {
			change.setFailedAttemptCount(change.getFailedAttemptCount() + 1);
			int remaining = Math.max(0, MAX_ATTEMPTS - change.getFailedAttemptCount());
			if (remaining == 0) {
				pendingRepository.delete(change);
				throw new ApiErrorException(HttpStatus.CONFLICT, "EMAIL_VERIFICATION_ATTEMPTS_EXHAUSTED",
						"Email verification attempts exhausted", null, 0);
			}
			throw new ApiErrorException(HttpStatus.BAD_REQUEST, "INVALID_EMAIL_VERIFICATION_CODE",
					"Invalid email verification code", null, remaining);
		}

		emailIdentityLockService.acquire(change.getNormalizedNewEmail());
		if (userRepository.existsByEmail(change.getNormalizedNewEmail())) {
			pendingRepository.delete(change);
			throw error(HttpStatus.CONFLICT, "EMAIL_ALREADY_IN_USE", "Email is already in use");
		}
		user.setEmail(change.getNormalizedNewEmail());
		user.setCredentialVersion(user.getCredentialVersion() + 1);
		pendingRepository.delete(change);
		userRepository.flush();
		return new LoginResponse(jwtService.generateAccessToken(user), "Bearer", UserResponse.from(user));
	}

	@Transactional(noRollbackFor = ApiErrorException.class)
	public PendingEmailChangeResponse resend(AuthenticatedUserPrincipal principal) {
		User user = lockedUser(principal.id());
		validateRole(user);
		Instant now = clock.instant();
		PendingEmailChange change = activePendingForMutation(user, now);
		if (change.getResendCount() >= MAX_RESENDS) {
			throw error(HttpStatus.CONFLICT, "EMAIL_VERIFICATION_RESENDS_EXHAUSTED",
					"Email verification resends exhausted");
		}
		if (now.isBefore(change.getResendAvailableAt())) {
			throw new ApiErrorException(HttpStatus.TOO_MANY_REQUESTS, "EMAIL_CHANGE_RATE_LIMITED",
					"Email verification resend is not available yet",
					retryAfter(change.getResendAvailableAt(), now), null);
		}
		emailIdentityLockService.acquire(change.getNormalizedNewEmail());
		rateLimitService.assertTargetDeliveryAllowed(change.getNormalizedNewEmail(), now);

		String code = newCode(change.getVerificationCodeHash());
		Instant codeExpiresAt = earlier(now.plus(CODE_LIFETIME), change.getExpiresAt());
		if (!deliver(change.getNormalizedNewEmail(), code, codeExpiresAt)) {
			throw error(HttpStatus.SERVICE_UNAVAILABLE, "EMAIL_DELIVERY_UNAVAILABLE",
					"Email delivery is unavailable");
		}
		change.setVerificationCodeHash(passwordEncoder.encode(code));
		change.setCodeExpiresAt(codeExpiresAt);
		change.setResendAvailableAt(now.plus(RESEND_COOLDOWN));
		change.setResendCount(change.getResendCount() + 1);
		rateLimitService.recordAcceptedDelivery(user, change.getNormalizedNewEmail(), now);
		return PendingEmailChangeResponse.from(change);
	}

	@Transactional
	public void cancel(AuthenticatedUserPrincipal principal) {
		User user = lockedUser(principal.id());
		validateRole(user);
		pendingRepository.findByUserIdForUpdate(user.getId()).ifPresent(pendingRepository::delete);
	}

	private PendingEmailChange activePendingForMutation(User user, Instant now) {
		PendingEmailChange change = pendingRepository.findByUserIdForUpdate(user.getId())
				.orElseThrow(() -> error(HttpStatus.GONE, "EMAIL_CHANGE_EXPIRED", "Email change expired"));
		if (isExpired(change, now)) {
			pendingRepository.delete(change);
			throw error(HttpStatus.GONE, "EMAIL_CHANGE_EXPIRED", "Email change expired");
		}
		return change;
	}

	private void verifyCurrentPassword(User user, String password, Instant now) {
		rateLimitService.assertCurrentPasswordAllowed(user, now);
		if (!passwordEncoder.matches(password, user.getPasswordHash())) {
			rateLimitService.recordCurrentPasswordFailure(user, now);
			throw error(HttpStatus.BAD_REQUEST, "CURRENT_PASSWORD_INCORRECT", "Current password is incorrect");
		}
		rateLimitService.clearCurrentPasswordFailures(user);
	}

	private User lockedUser(Long userId) {
		return userRepository.findCredentialByIdForUpdate(userId)
				.orElseThrow(() -> new JwtAuthenticationException("Authenticated user not found"));
	}

	private void validateRole(User user) {
		if (user.getRole() != Role.WORKER && user.getRole() != Role.FOREMAN) {
			throw new ForbiddenException();
		}
	}

	private boolean isExpired(PendingEmailChange change, Instant now) {
		return !now.isBefore(change.getExpiresAt());
	}

	private boolean deliver(String target, String code, Instant codeExpiresAt) {
		try {
			return delivery.deliver(new EmailChangeDelivery.VerificationMessage(target, code, codeExpiresAt));
		}
		catch (RuntimeException exception) {
			return false;
		}
	}

	private String newCode() {
		return String.format(Locale.ROOT, "%06d", secureRandom.nextInt(1_000_000));
	}

	private String newCode(String previousCodeHash) {
		String code;
		do {
			code = newCode();
		}
		while (passwordEncoder.matches(code, previousCodeHash));
		return code;
	}

	private Instant earlier(Instant first, Instant second) {
		return first.isBefore(second) ? first : second;
	}

	private long retryAfter(Instant availableAt, Instant now) {
		long millis = Math.max(1, Duration.between(now, availableAt).toMillis());
		return Math.max(1, (millis + 999) / 1000);
	}

	private ApiErrorException error(HttpStatus status, String code, String message) {
		return new ApiErrorException(status, code, message);
	}
}
