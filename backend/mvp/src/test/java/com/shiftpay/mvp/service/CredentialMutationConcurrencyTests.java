package com.shiftpay.mvp.service;

import com.shiftpay.mvp.TestDataCleaner;
import com.shiftpay.mvp.dto.LoginResponse;
import com.shiftpay.mvp.dto.ConfirmMyEmailChangeRequest;
import com.shiftpay.mvp.dto.UpdateMyPasswordRequest;
import com.shiftpay.mvp.entity.PendingEmailChange;
import com.shiftpay.mvp.entity.Role;
import com.shiftpay.mvp.entity.User;
import com.shiftpay.mvp.exception.ApiErrorException;
import com.shiftpay.mvp.repository.UserRepository;
import com.shiftpay.mvp.repository.PendingEmailChangeRepository;
import com.shiftpay.mvp.security.AuthenticatedUserPrincipal;
import com.shiftpay.mvp.security.JwtService;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.security.crypto.password.PasswordEncoder;

import java.util.List;
import java.time.Instant;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.Future;

import static org.assertj.core.api.Assertions.assertThat;

@SpringBootTest
class CredentialMutationConcurrencyTests {

	@Autowired UserService userService;
	@Autowired UserRepository userRepository;
	@Autowired PasswordEncoder passwordEncoder;
	@Autowired JdbcTemplate jdbcTemplate;
	@Autowired EmailChangeService emailChangeService;
	@Autowired PendingEmailChangeRepository pendingRepository;
	@Autowired JwtService jwtService;

	@BeforeEach
	void setUp() {
		TestDataCleaner.clean(jdbcTemplate);
	}

	@Test
	void onlyOnePasswordMutationWithTheSameOldVersionCommits() throws Exception {
		User user = new User();
		user.setEmail("worker@example.com");
		user.setPasswordHash(passwordEncoder.encode("password123"));
		user.setFirstName("John");
		user.setLastName("Worker");
		user.setRole(Role.WORKER);
		user = userRepository.saveAndFlush(user);
		AuthenticatedUserPrincipal principal = new AuthenticatedUserPrincipal(
				user.getId(), user.getEmail(), user.getRole(), 0);

		CountDownLatch ready = new CountDownLatch(2);
		CountDownLatch start = new CountDownLatch(1);
		try (ExecutorService executor = Executors.newFixedThreadPool(2)) {
			Future<Outcome> first = executor.submit(() -> mutate(
					() -> userService.updateMyPassword(
							new UpdateMyPasswordRequest("password123", "first-password-456"), principal),
					ready, start));
			Future<Outcome> second = executor.submit(() -> mutate(
					() -> userService.updateMyPassword(
							new UpdateMyPasswordRequest("password123", "second-password-456"), principal),
					ready, start));
			ready.await();
			start.countDown();

			List<Outcome> outcomes = List.of(first.get(), second.get());
			assertThat(outcomes).filteredOn(outcome -> outcome.response() != null).hasSize(1);
			assertThat(outcomes).filteredOn(outcome -> "CREDENTIAL_VERSION_CONFLICT".equals(outcome.errorCode()))
					.hasSize(1);
		}

		User stored = userRepository.findById(user.getId()).orElseThrow();
		assertThat(stored.getCredentialVersion()).isEqualTo(1);
		assertThat(passwordEncoder.matches("first-password-456", stored.getPasswordHash())
				|| passwordEncoder.matches("second-password-456", stored.getPasswordHash())).isTrue();
	}

	@Test
	void concurrentEmailAndPasswordMutationsChangeExactlyOneCredential() throws Exception {
		User user = new User();
		user.setEmail("worker@example.com");
		user.setPasswordHash(passwordEncoder.encode("password123"));
		user.setFirstName("John");
		user.setLastName("Worker");
		user.setRole(Role.WORKER);
		user = userRepository.saveAndFlush(user);

		String code = "483921";
		PendingEmailChange pending = new PendingEmailChange();
		pending.setUser(user);
		pending.setNormalizedNewEmail("new@example.com");
		pending.setVerificationCodeHash(passwordEncoder.encode(code));
		pending.setCodeExpiresAt(Instant.now().plusSeconds(600));
		pending.setExpiresAt(Instant.now().plusSeconds(1800));
		pending.setResendAvailableAt(Instant.now().plusSeconds(60));
		pendingRepository.saveAndFlush(pending);

		AuthenticatedUserPrincipal principal = new AuthenticatedUserPrincipal(
				user.getId(), user.getEmail(), user.getRole(), 0);
		CountDownLatch ready = new CountDownLatch(2);
		CountDownLatch start = new CountDownLatch(1);
		List<Outcome> outcomes;
		try (ExecutorService executor = Executors.newFixedThreadPool(2)) {
			Future<Outcome> password = executor.submit(() -> mutate(
					() -> userService.updateMyPassword(
							new UpdateMyPasswordRequest("password123", "new-password-456"), principal),
					ready, start));
			Future<Outcome> email = executor.submit(() -> mutate(
					() -> emailChangeService.confirm(new ConfirmMyEmailChangeRequest(code), principal),
					ready, start));
			ready.await();
			start.countDown();
			outcomes = List.of(password.get(), email.get());
		}

		Outcome winner = outcomes.stream().filter(outcome -> outcome.response() != null).findFirst().orElseThrow();
		assertThat(outcomes).filteredOn(outcome -> outcome.response() != null).hasSize(1);
		assertThat(outcomes).filteredOn(outcome -> "CREDENTIAL_VERSION_CONFLICT".equals(outcome.errorCode()))
				.hasSize(1);
		assertThat(outcomes).filteredOn(outcome -> outcome.retryAfterSeconds() != null).isEmpty();
		assertThat(jwtService.validateAccessToken(winner.response().accessToken()).credentialVersion()).isEqualTo(1);

		User stored = userRepository.findById(user.getId()).orElseThrow();
		assertThat(stored.getCredentialVersion()).isEqualTo(1);
		if (stored.getEmail().equals("new@example.com")) {
			assertThat(passwordEncoder.matches("password123", stored.getPasswordHash())).isTrue();
			assertThat(pendingRepository.findByUserId(user.getId())).isEmpty();
		}
		else {
			assertThat(stored.getEmail()).isEqualTo("worker@example.com");
			assertThat(passwordEncoder.matches("new-password-456", stored.getPasswordHash())).isTrue();
			PendingEmailChange unchanged = pendingRepository.findByUserId(user.getId()).orElseThrow();
			assertThat(unchanged.getFailedAttemptCount()).isZero();
			assertThat(passwordEncoder.matches(code, unchanged.getVerificationCodeHash())).isTrue();
		}
	}

	private Outcome mutate(
			CredentialMutation mutation,
			CountDownLatch ready,
			CountDownLatch start
	) throws Exception {
		ready.countDown();
		start.await();
		try {
			return new Outcome(mutation.execute(), null, null);
		}
		catch (ApiErrorException exception) {
			return new Outcome(null, exception.getCode(), exception.getRetryAfterSeconds());
		}
	}

	@FunctionalInterface
	private interface CredentialMutation {
		LoginResponse execute();
	}

	private record Outcome(LoginResponse response, String errorCode, Long retryAfterSeconds) { }
}
