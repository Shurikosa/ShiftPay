package com.shiftpay.mvp.service;

import com.shiftpay.mvp.dto.ConfirmPasswordResetRequest;
import com.shiftpay.mvp.dto.RequestPasswordResetResponse;
import com.shiftpay.mvp.entity.Role;
import com.shiftpay.mvp.entity.User;
import com.shiftpay.mvp.exception.ApiErrorException;
import com.shiftpay.mvp.repository.UserRepository;
import org.springframework.beans.factory.annotation.Value;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.HttpStatus;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.PlatformTransactionManager;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.transaction.support.TransactionSynchronization;
import org.springframework.transaction.support.TransactionSynchronizationManager;
import org.springframework.transaction.support.TransactionTemplate;

import javax.crypto.Mac;
import javax.crypto.spec.SecretKeySpec;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.SecureRandom;
import java.sql.Timestamp;
import java.time.Clock;
import java.time.Duration;
import java.time.Instant;
import java.util.HexFormat;
import java.util.List;
import java.util.Locale;
import java.util.UUID;
import java.util.concurrent.Executor;

@Service
public class PasswordResetService {
	private static final Logger LOGGER = LoggerFactory.getLogger(PasswordResetService.class);
	private static final Duration CODE_LIFETIME = Duration.ofMinutes(10);
	private static final Duration TOMBSTONE_LIFETIME = Duration.ofHours(24);
	private static final String RESPONSE_MESSAGE = "If this address can be recovered, check your email for a code.";
	private final JdbcTemplate jdbc;
	private final UserRepository users;
	private final PasswordEncoder passwords;
	private final PasswordResetDelivery delivery;
	private final EmailIdentityLockService locks;
	private final Executor passwordResetExecutor;
	private final Clock clock;
	private final byte[] digestKey;
	private final TransactionTemplate confirmationTransaction;
	private final SecureRandom random = new SecureRandom();

	public PasswordResetService(JdbcTemplate jdbc, UserRepository users, PasswordEncoder passwords,
			PasswordResetDelivery delivery, EmailIdentityLockService locks, Executor passwordResetExecutor,
			Clock clock, PlatformTransactionManager transactionManager,
			@Value("${shiftpay.password-reset.digest-secret}") String digestSecret) {
		this.jdbc = jdbc;
		this.users = users;
		this.passwords = passwords;
		this.delivery = delivery;
		this.locks = locks;
		this.passwordResetExecutor = passwordResetExecutor;
		this.clock = clock;
		this.digestKey = digestSecret.getBytes(StandardCharsets.UTF_8);
		this.confirmationTransaction = new TransactionTemplate(transactionManager);
	}

	@Transactional(noRollbackFor = ApiErrorException.class)
	public RequestPasswordResetResponse request(String email, String clientIp) {
		String normalized = EmailNormalizer.normalize(email);
		String addressDigest = digest("address", normalized);
		String ipDigest = digest("ip", clientIp);
		// Lock IP first, then address. The order is identical for every request.
		locks.acquire("reset-ip:" + ipDigest);
		locks.acquire("reset:" + addressDigest);
		purge(clock.instant());
		Instant now = clock.instant();
		long retrySeconds = longestActiveLimit(addressDigest, ipDigest, now);
		if (retrySeconds > 0) {
			throw new ApiErrorException(HttpStatus.TOO_MANY_REQUESTS, "PASSWORD_RESET_RATE_LIMITED",
					"Please try again later.", retrySeconds, null);
		}

		jdbc.update("update password_reset_requests set terminal_at = ? where address_digest = ? and terminal_at is null",
				Timestamp.from(now), addressDigest);
		UUID requestId = UUID.randomUUID();
		String code = String.format(Locale.ROOT, "%06d", random.nextInt(1_000_000));
		String codeDigest = digest("code", requestId + ":" + code);
		User account = users.findByEmail(normalized).filter(user ->
				user.getRole() == Role.WORKER || user.getRole() == Role.FOREMAN).orElse(null);
		Long userId = account == null ? null : account.getId();
		Long version = account == null ? null : account.getCredentialVersion();
		Instant expiresAt = now.plus(CODE_LIFETIME);
		jdbc.update("insert into password_reset_requests "
				+ "(request_id, address_digest, user_id, credential_version, code_digest, expires_at, failed_attempts) "
				+ "values (?, ?, ?, ?, ?, ?, 0)", requestId, addressDigest, userId, version, codeDigest,
				Timestamp.from(expiresAt));
		jdbc.update("insert into password_reset_events (address_digest, ip_digest, occurred_at) values (?, ?, ?)",
				addressDigest, ipDigest, Timestamp.from(now));
		final boolean eligible = userId != null;
		TransactionSynchronizationManager.registerSynchronization(new TransactionSynchronization() {
			@Override
			public void afterCommit() {
				try {
					passwordResetExecutor.execute(() -> {
						boolean accepted = false;
						try {
							if (eligible) {
								accepted = delivery.deliver(new PasswordResetDelivery.Message(normalized, code, expiresAt));
							}
						}
						catch (RuntimeException ignored) {
							// Provider exceptions are deliberately redacted.
						}
						if (eligible) {
							if (accepted) {
								jdbc.update("update password_reset_requests set delivery_accepted = true "
										+ "where request_id = ? and terminal_at is null", requestId);
							}
							else {
								LOGGER.warn("Password reset delivery failed");
								invalidateDelivery(requestId);
							}
						}
					});
				}
				catch (RuntimeException ignored) {
					LOGGER.warn("Password reset delivery handoff failed");
					// delivery_accepted remains false, so the request is unusable with dummy behavior.
				}
			}
		});
		return new RequestPasswordResetResponse(requestId, RESPONSE_MESSAGE);
	}

	@Transactional(propagation = Propagation.NOT_SUPPORTED)
	public void confirm(ConfirmPasswordResetRequest request) {
		awaitPendingDeliveryForCorrectCode(request);
		// Keep the provider wait outside the database transaction. The locked transaction below
		// rechecks every condition, including expiry and delivery outcome.
		ApiErrorException error = confirmationTransaction.execute(status -> {
			try {
				confirmLocked(request);
				return null;
			}
			catch (ApiErrorException exception) {
				// Failed-attempt and terminal-state writes must commit with their documented error.
				return exception;
			}
		});
		if (error != null) throw error;
	}

	private void confirmLocked(ConfirmPasswordResetRequest request) {
		purge(clock.instant());
		List<ResetRow> rows = jdbc.query("select address_digest, user_id, credential_version, code_digest, "
				+ "delivery_accepted, expires_at, failed_attempts, terminal_at from password_reset_requests "
				+ "where request_id = ? for update", (rs, rowNum) -> new ResetRow(
					rs.getString("address_digest"), (Long) rs.getObject("user_id"),
					(Long) rs.getObject("credential_version"), rs.getString("code_digest"),
					rs.getBoolean("delivery_accepted"), rs.getTimestamp("expires_at").toInstant(),
					rs.getInt("failed_attempts"),
					rs.getTimestamp("terminal_at") == null ? null : rs.getTimestamp("terminal_at").toInstant()),
				request.requestId());
		if (rows.isEmpty()) {
			throw invalid(null);
		}
		ResetRow row = rows.getFirst();
		Instant now = clock.instant();
		if (row.terminalAt() != null) {
			throw expired();
		}
		if (!now.isBefore(row.expiresAt())) {
			terminal(request.requestId(), row.expiresAt());
			throw expired();
		}
		String code = request.code();
		boolean correct = code != null && code.matches("[0-9]{6}")
				&& MessageDigest.isEqual(row.codeDigest().getBytes(StandardCharsets.US_ASCII),
					digest("code", request.requestId() + ":" + code).getBytes(StandardCharsets.US_ASCII));
		if (!correct || row.userId() == null || !row.deliveryAccepted()) {
			int remaining = 4 - row.failedAttempts();
			jdbc.update("update password_reset_requests set failed_attempts = ? where request_id = ?",
					row.failedAttempts() + 1, request.requestId());
			if (remaining == 0) {
				terminal(request.requestId(), now);
				throw new ApiErrorException(HttpStatus.CONFLICT, "PASSWORD_RESET_ATTEMPTS_EXHAUSTED",
						"Password reset attempts exhausted", null, 0);
			}
			throw invalid(remaining);
		}

		User user = users.findCredentialByIdForUpdate(row.userId()).orElse(null);
		Instant afterUserLock = clock.instant();
		if (!afterUserLock.isBefore(row.expiresAt())) {
			terminal(request.requestId(), row.expiresAt());
			throw expired();
		}
		if (user == null || (user.getRole() != Role.WORKER && user.getRole() != Role.FOREMAN)
				|| user.getCredentialVersion() != row.credentialVersion()
				|| !digest("address", EmailNormalizer.normalize(user.getEmail())).equals(row.addressDigest())) {
			terminal(request.requestId(), now);
			throw expired();
		}
		if (passwords.matches(request.newPassword(), user.getPasswordHash())) {
			throw new ApiErrorException(HttpStatus.BAD_REQUEST, "PASSWORD_UNCHANGED",
					"New password must differ from the current password");
		}
		user.setPasswordHash(passwords.encode(request.newPassword()));
		user.setCredentialVersion(user.getCredentialVersion() + 1);
		users.flush();
		terminal(request.requestId(), now);
	}

	/**
	 * A provider may expose the code before its send call returns. Wait without a row lock so its
	 * completion can be recorded; only a correct code for a real pending request enters this path.
	 * Expiry, supersession, and delivery failure still use the normal documented result below.
	 */
	private void awaitPendingDeliveryForCorrectCode(ConfirmPasswordResetRequest request) {
		String code = request.code();
		if (code == null || !code.matches("[0-9]{6}")) return;
		boolean interrupted = false;
		try {
			while (true) {
				List<DeliveryState> rows = jdbc.query("select user_id, code_digest, delivery_accepted, "
						+ "expires_at, terminal_at from password_reset_requests where request_id = ?",
						(rs, rowNum) -> new DeliveryState((Long) rs.getObject("user_id"),
								rs.getString("code_digest"), rs.getBoolean("delivery_accepted"),
								rs.getTimestamp("expires_at").toInstant(), rs.getTimestamp("terminal_at") != null),
						request.requestId());
				if (rows.isEmpty()) return;
				DeliveryState state = rows.getFirst();
				if (state.userId() == null || state.deliveryAccepted() || state.terminal()
						|| !clock.instant().isBefore(state.expiresAt())) return;
				boolean correct = MessageDigest.isEqual(state.codeDigest().getBytes(StandardCharsets.US_ASCII),
						digest("code", request.requestId() + ":" + code).getBytes(StandardCharsets.US_ASCII));
				if (!correct) return;
				try {
					Thread.sleep(25);
				}
				catch (InterruptedException exception) {
					interrupted = true;
				}
			}
		}
		finally {
			if (interrupted) Thread.currentThread().interrupt();
		}
	}

	private long longestActiveLimit(String address, String ip, Instant now) {
		List<Instant> addressEvents = events("address_digest", address, now.minus(Duration.ofHours(24)));
		List<Instant> ipEvents = events("ip_digest", ip, now.minus(Duration.ofHours(1)));
		long retry = 0;
		if (!addressEvents.isEmpty()) {
			retry = Math.max(retry, remaining(addressEvents.getLast().plusSeconds(60), now));
		}
		List<Instant> hour = addressEvents.stream().filter(t -> t.isAfter(now.minus(Duration.ofHours(1)))).toList();
		if (hour.size() >= 3) {
			retry = Math.max(retry, remaining(hour.get(hour.size() - 3).plus(Duration.ofHours(1)), now));
		}
		if (addressEvents.size() >= 5) {
			retry = Math.max(retry, remaining(addressEvents.get(addressEvents.size() - 5).plus(Duration.ofHours(24)), now));
		}
		if (ipEvents.size() >= 20) {
			retry = Math.max(retry, remaining(ipEvents.get(ipEvents.size() - 20).plus(Duration.ofHours(1)), now));
		}
		return retry;
	}

	private List<Instant> events(String column, String key, Instant since) {
		return jdbc.query("select occurred_at from password_reset_events where " + column
				+ " = ? and occurred_at > ? order by occurred_at",
				(rs, rowNum) -> rs.getTimestamp(1).toInstant(), key, Timestamp.from(since));
	}

	private long remaining(Instant until, Instant now) {
		long nanos = Duration.between(now, until).toNanos();
		return nanos <= 0 ? 0 : Math.max(1, (nanos + 999_999_999L) / 1_000_000_000L);
	}

	private void purge(Instant now) {
		jdbc.update("update password_reset_requests set terminal_at = expires_at "
				+ "where terminal_at is null and expires_at <= ?", Timestamp.from(now));
		jdbc.update("delete from password_reset_requests where terminal_at < ?",
				Timestamp.from(now.minus(TOMBSTONE_LIFETIME)));
		jdbc.update("delete from password_reset_events where occurred_at < ?",
				Timestamp.from(now.minus(Duration.ofHours(24))));
	}

	private void terminal(UUID id, Instant at) {
		jdbc.update("update password_reset_requests set terminal_at = ? where request_id = ? and terminal_at is null",
				Timestamp.from(at), id);
	}

	private void invalidateDelivery(UUID id) {
		jdbc.update("update password_reset_requests set user_id = null, credential_version = null "
				+ "where request_id = ? and terminal_at is null", id);
	}

	private ApiErrorException invalid(Integer remaining) {
		return new ApiErrorException(HttpStatus.BAD_REQUEST, "PASSWORD_RESET_CODE_INVALID",
				"Invalid password reset code", null, remaining);
	}

	private ApiErrorException expired() {
		return new ApiErrorException(HttpStatus.GONE, "PASSWORD_RESET_REQUEST_EXPIRED",
				"Password reset request expired");
	}

	private String digest(String purpose, String value) {
		try {
			Mac mac = Mac.getInstance("HmacSHA256");
			mac.init(new SecretKeySpec(digestKey, "HmacSHA256"));
			return HexFormat.of().formatHex(mac.doFinal((purpose + ":" + value).getBytes(StandardCharsets.UTF_8)));
		}
		catch (Exception exception) {
			throw new IllegalStateException("Password reset digest unavailable", exception);
		}
	}

	private record ResetRow(String addressDigest, Long userId, Long credentialVersion, String codeDigest,
			boolean deliveryAccepted,
			Instant expiresAt, int failedAttempts, Instant terminalAt) { }

	private record DeliveryState(Long userId, String codeDigest, boolean deliveryAccepted,
			Instant expiresAt, boolean terminal) { }
}
