package com.shiftpay.mvp;

import com.shiftpay.mvp.dto.ConfirmMyEmailChangeRequest;
import com.shiftpay.mvp.dto.StartMyEmailChangeRequest;
import com.shiftpay.mvp.entity.CredentialSecurityEvent;
import com.shiftpay.mvp.entity.CredentialSecurityEventType;
import com.shiftpay.mvp.entity.PendingEmailChange;
import com.shiftpay.mvp.entity.Role;
import com.shiftpay.mvp.entity.User;
import com.shiftpay.mvp.exception.ApiErrorException;
import com.shiftpay.mvp.repository.CredentialSecurityEventRepository;
import com.shiftpay.mvp.repository.EmailIdentityLockRepository;
import com.shiftpay.mvp.repository.PendingEmailChangeRepository;
import com.shiftpay.mvp.repository.UserRepository;
import com.shiftpay.mvp.security.AuthenticatedUserPrincipal;
import com.shiftpay.mvp.service.EmailChangeDelivery;
import com.shiftpay.mvp.service.EmailChangeService;
import com.shiftpay.mvp.service.EmailIdentityLockInitializer;
import org.flywaydb.core.Flyway;
import org.flywaydb.core.api.MigrationVersion;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.context.TestConfiguration;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Import;
import org.springframework.context.annotation.Primary;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.datasource.DriverManagerDataSource;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.test.context.DynamicPropertyRegistry;
import org.springframework.test.context.DynamicPropertySource;
import org.springframework.transaction.PlatformTransactionManager;
import org.springframework.transaction.support.TransactionTemplate;
import org.testcontainers.junit.jupiter.Container;
import org.testcontainers.junit.jupiter.Testcontainers;
import org.testcontainers.postgresql.PostgreSQLContainer;

import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.List;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.Callable;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.Future;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.TimeoutException;
import java.util.concurrent.atomic.AtomicBoolean;
import java.util.concurrent.atomic.AtomicInteger;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.assertj.core.api.Assertions.within;

@Testcontainers
@SpringBootTest
@Import(PostgreSqlIntegrationTests.DeliveryConfiguration.class)
class PostgreSqlIntegrationTests {

	@Container
	static final PostgreSQLContainer POSTGRES = new PostgreSQLContainer("postgres:16-alpine")
			.withDatabaseName("shiftpay_gate")
			.withUsername("shiftpay")
			.withPassword("shiftpay");

	@DynamicPropertySource
	static void postgresProperties(DynamicPropertyRegistry registry) {
		registry.add("spring.datasource.url", POSTGRES::getJdbcUrl);
		registry.add("spring.datasource.username", POSTGRES::getUsername);
		registry.add("spring.datasource.password", POSTGRES::getPassword);
		registry.add("spring.datasource.driver-class-name", POSTGRES::getDriverClassName);
		registry.add("spring.flyway.user", POSTGRES::getUsername);
		registry.add("spring.flyway.password", POSTGRES::getPassword);
	}

	@Autowired JdbcTemplate jdbcTemplate;
	@Autowired UserRepository userRepository;
	@Autowired PendingEmailChangeRepository pendingRepository;
	@Autowired CredentialSecurityEventRepository eventRepository;
	@Autowired EmailIdentityLockRepository identityLockRepository;
	@Autowired EmailIdentityLockInitializer identityLockInitializer;
	@Autowired EmailChangeService emailChangeService;
	@Autowired PasswordEncoder passwordEncoder;
	@Autowired PlatformTransactionManager transactionManager;
	@Autowired CapturingDelivery delivery;

	@BeforeEach
	void cleanApplicationSchema() {
		TestDataCleaner.clean(jdbcTemplate);
		delivery.accept.set(true);
		delivery.acceptedDeliveries.set(0);
		delivery.deliveredCodes.clear();
	}

	@Test
	void cleanPostgreSqlMigratesFromV1ThroughV15() {
		String schema = "clean_v1_to_v15";
		Flyway flyway = flyway(schema, null);

		assertThat(flyway.migrate().migrationsExecuted).isEqualTo(15);
		JdbcTemplate isolated = isolatedJdbc(schema);
		assertThat(isolated.queryForObject(
				"select version from flyway_schema_history where success order by installed_rank desc limit 1",
				String.class)).isEqualTo("15");
		assertThat(isolated.queryForObject(
				"select count(*) from information_schema.columns where table_schema = ? and table_name = 'users' and column_name = 'credential_version'",
				Long.class, schema)).isEqualTo(1);
	}

	@Test
	void representativeV14DataSurvivesUpgradeToV15() {
		String schema = "upgrade_v14_to_v15";
		Flyway v14 = flyway(schema, MigrationVersion.fromVersion("14"));
		v14.migrate();
		JdbcTemplate isolated = isolatedJdbc(schema);

		Long companyId = isolated.queryForObject("""
				insert into companies (name, join_code, time_zone, currency_label)
				values ('Existing Co', 'EXIST1', 'Europe/Berlin', 'EUR') returning id
				""", Long.class);
		Long userId = isolated.queryForObject("""
				insert into users (email, password_hash, first_name, last_name, role, company_id)
				values ('existing@example.com', 'bcrypt-hash', 'Existing', 'Worker', 'WORKER', ?) returning id
				""", Long.class, companyId);
		Long foremanId = isolated.queryForObject("""
				insert into users (email, password_hash, first_name, last_name, role, company_id)
				values ('existing.foreman@example.com', 'bcrypt-hash', 'Existing', 'Foreman', 'FOREMAN', ?) returning id
				""", Long.class, companyId);
		Long shiftId = isolated.queryForObject("""
				insert into shift_sessions (
					company_id, title, join_code, status, default_break_minutes,
					created_by, default_hourly_rate, foreman_hourly_rate, currency_label)
				values (?, 'Existing shift', 'SHIFT1', 'OPEN', 0, ?, 20.00, 30.00, 'EUR') returning id
				""", Long.class, companyId, foremanId);
		isolated.update("""
				insert into shift_attendance (shift_session_id, worker_id, status, hourly_rate, break_minutes)
				values (?, ?, 'JOINED', 20.00, 0)
				""", shiftId, userId);

		assertThat(flyway(schema, null).migrate().migrationsExecuted).isEqualTo(1);
		assertThat(isolated.queryForObject("select count(*) from users", Long.class)).isEqualTo(2);
		assertThat(isolated.queryForObject("select count(*) from shift_sessions", Long.class)).isEqualTo(1);
		assertThat(isolated.queryForObject("select count(*) from shift_attendance", Long.class)).isEqualTo(1);
		assertThat(isolated.queryForObject(
				"select credential_version from users where id = ?", Long.class, userId)).isZero();
		assertThat(isolated.queryForObject(
				"select count(*) from email_identity_locks where normalized_email = 'existing@example.com'",
				Long.class)).isEqualTo(1);
	}

	@Test
	void directStartReusesExpiredPendingRowWithoutUniqueConstraintFailure() {
		User user = createUser("expired-owner@example.com");
		PendingEmailChange expired = pending(user, "old-target@example.com", "111111");
		expired.setExpiresAt(Instant.now().minusSeconds(30));
		expired.setCodeExpiresAt(Instant.now().minusSeconds(60));
		expired.setResendAvailableAt(Instant.now().minusSeconds(90));
		expired.setResendCount(3);
		expired.setFailedAttemptCount(5);
		expired = pendingRepository.saveAndFlush(expired);
		Long expiredId = expired.getId();
		Instant startedAfter = Instant.now();

		var response = emailChangeService.start(
				new StartMyEmailChangeRequest("password123", "replacement@example.com"),
				principal(user));

		List<PendingEmailChange> stored = pendingRepository.findAll();
		assertThat(stored).hasSize(1);
		PendingEmailChange restarted = stored.getFirst();
		assertThat(restarted.getId()).isEqualTo(expiredId);
		assertThat(restarted.getNormalizedNewEmail()).isEqualTo("replacement@example.com");
		assertThat(restarted.getResendCount()).isZero();
		assertThat(restarted.getFailedAttemptCount()).isZero();
		assertThat(restarted.getExpiresAt()).isAfter(startedAfter.plusSeconds(29 * 60));
		assertThat(restarted.getCodeExpiresAt()).isAfter(startedAfter.plusSeconds(9 * 60));
		assertThat(restarted.getResendAvailableAt()).isAfterOrEqualTo(startedAfter.plusSeconds(60));
		assertThat(response.resendsRemaining()).isEqualTo(3);
		assertThat(response.attemptsRemaining()).isEqualTo(5);
		assertThat(response.expiresAt()).isCloseTo(restarted.getExpiresAt(), within(1, ChronoUnit.MICROS));
		assertThat(response.codeExpiresAt()).isCloseTo(restarted.getCodeExpiresAt(), within(1, ChronoUnit.MICROS));
		assertThat(response.resendAvailableAt())
				.isCloseTo(restarted.getResendAvailableAt(), within(1, ChronoUnit.MICROS));

		String deliveredCode = delivery.deliveredCodes.get("replacement@example.com");
		assertThat(deliveredCode).matches("[0-9]{6}");
		assertThat(passwordEncoder.matches(deliveredCode, restarted.getVerificationCodeHash())).isTrue();
		assertThat(passwordEncoder.matches("111111", restarted.getVerificationCodeHash())).isFalse();

		assertThatThrownBy(() -> emailChangeService.resend(principal(user)))
				.isInstanceOfSatisfying(ApiErrorException.class, exception -> {
					assertThat(exception.getCode()).isEqualTo("EMAIL_CHANGE_RATE_LIMITED");
					assertThat(exception.getRetryAfterSeconds()).isPositive();
				});

		restarted.setResendAvailableAt(Instant.now().minusSeconds(1));
		pendingRepository.saveAndFlush(restarted);
		var resendResponse = emailChangeService.resend(principal(user));
		assertThat(resendResponse.resendsRemaining()).isEqualTo(2);
		assertThat(delivery.acceptedDeliveries.get()).isEqualTo(2);
		String resentCode = delivery.deliveredCodes.get("replacement@example.com");
		PendingEmailChange afterResend = pendingRepository.findAll().getFirst();
		assertThat(resentCode).isNotEqualTo(deliveredCode);
		assertThat(passwordEncoder.matches(resentCode, afterResend.getVerificationCodeHash())).isTrue();
		assertThat(passwordEncoder.matches(deliveredCode, afterResend.getVerificationCodeHash())).isFalse();
	}

	@Test
	void failedDeliveryLeavesExpiredPendingInactiveAndRecordsNoAcceptedEvents() {
		User user = createUser("failed-delivery-owner@example.com");
		PendingEmailChange expired = pending(user, "old-failed-target@example.com", "222222");
		expired.setExpiresAt(Instant.now().minusSeconds(30));
		expired.setCodeExpiresAt(Instant.now().minusSeconds(60));
		expired.setResendAvailableAt(Instant.now().minusSeconds(90));
		expired.setResendCount(3);
		expired.setFailedAttemptCount(5);
		expired = pendingRepository.saveAndFlush(expired);
		Long expiredId = expired.getId();
		String oldHash = expired.getVerificationCodeHash();
		Instant oldExpiresAt = expired.getExpiresAt();
		Instant oldCodeExpiresAt = expired.getCodeExpiresAt();
		Instant oldResendAvailableAt = expired.getResendAvailableAt();
		delivery.accept.set(false);

		assertThatThrownBy(() -> emailChangeService.start(
				new StartMyEmailChangeRequest("password123", "undeliverable@example.com"),
				principal(user)))
				.isInstanceOfSatisfying(ApiErrorException.class, exception -> {
					assertThat(exception.getStatus().value()).isEqualTo(503);
					assertThat(exception.getCode()).isEqualTo("EMAIL_DELIVERY_UNAVAILABLE");
				});

		List<PendingEmailChange> stored = pendingRepository.findAll();
		assertThat(stored).hasSize(1);
		PendingEmailChange unchanged = stored.getFirst();
		assertThat(unchanged.getId()).isEqualTo(expiredId);
		assertThat(unchanged.getNormalizedNewEmail()).isEqualTo("old-failed-target@example.com");
		assertThat(unchanged.getVerificationCodeHash()).isEqualTo(oldHash);
		assertThat(unchanged.getExpiresAt())
				.isCloseTo(oldExpiresAt, within(1, ChronoUnit.MICROS))
				.isBefore(Instant.now());
		assertThat(unchanged.getCodeExpiresAt()).isCloseTo(oldCodeExpiresAt, within(1, ChronoUnit.MICROS));
		assertThat(unchanged.getResendAvailableAt())
				.isCloseTo(oldResendAvailableAt, within(1, ChronoUnit.MICROS));
		assertThat(unchanged.getResendCount()).isEqualTo(3);
		assertThat(unchanged.getFailedAttemptCount()).isEqualTo(5);
		assertThat(delivery.acceptedDeliveries.get()).isZero();
		assertThat(delivery.deliveredCodes).isEmpty();
		assertThat(eventRepository.findAll()).noneMatch(event ->
				event.getEventType() == CredentialSecurityEventType.EMAIL_CHANGE_START
						|| event.getEventType() == CredentialSecurityEventType.EMAIL_VERIFICATION_DELIVERY);
	}

	@Test
	void requiresNewIdentityInitializationSurvivesOuterRollback() {
		TransactionTemplate transaction = new TransactionTemplate(transactionManager);

		assertThatThrownBy(() -> transaction.executeWithoutResult(status -> {
			identityLockInitializer.insertIfMissing("requires-new@example.com");
			throw new IllegalStateException("force outer rollback");
		})).isInstanceOf(IllegalStateException.class);

		assertThat(identityLockRepository.existsById("requires-new@example.com")).isTrue();
	}

	@Test
	void postgresPessimisticIdentityLockBlocksAConcurrentHolder() throws Exception {
		String target = "locked@example.com";
		identityLockInitializer.insertIfMissing(target);
		TransactionTemplate transaction = new TransactionTemplate(transactionManager);
		CountDownLatch firstLocked = new CountDownLatch(1);
		CountDownLatch releaseFirst = new CountDownLatch(1);

		try (ExecutorService executor = Executors.newFixedThreadPool(2)) {
			Future<?> first = executor.submit(() -> transaction.executeWithoutResult(status -> {
				identityLockRepository.findByEmailForUpdate(target).orElseThrow();
				firstLocked.countDown();
				await(releaseFirst);
			}));
			assertThat(firstLocked.await(5, TimeUnit.SECONDS)).isTrue();
			Future<?> second = executor.submit(() -> transaction.executeWithoutResult(status ->
					identityLockRepository.findByEmailForUpdate(target).orElseThrow()));

			assertThatThrownBy(() -> second.get(300, TimeUnit.MILLISECONDS))
					.isInstanceOf(TimeoutException.class);
			releaseFirst.countDown();
			first.get(5, TimeUnit.SECONDS);
			second.get(5, TimeUnit.SECONDS);
		}
		finally {
			releaseFirst.countDown();
		}
	}

	@Test
	void twoAccountsConcurrentlyClaimingOneNormalizedEmailHaveOneWinner() throws Exception {
		String target = "shared@example.com";
		User first = createUser("first@example.com");
		User second = createUser("second@example.com");
		pendingRepository.saveAndFlush(pending(first, target, "111111"));
		pendingRepository.saveAndFlush(pending(second, target, "222222"));
		identityLockInitializer.insertIfMissing(target);

		List<Outcome> outcomes = runConcurrently(
				() -> emailChangeService.confirm(new ConfirmMyEmailChangeRequest("111111"), principal(first)),
				() -> emailChangeService.confirm(new ConfirmMyEmailChangeRequest("222222"), principal(second)));

		assertThat(outcomes).filteredOn(Outcome::success).hasSize(1);
		assertThat(outcomes).filteredOn(outcome -> "EMAIL_ALREADY_IN_USE".equals(outcome.errorCode())).hasSize(1);
		assertThat(userRepository.findAll()).filteredOn(user -> target.equals(user.getEmail())).hasSize(1);
		assertThat(userRepository.findAll()).filteredOn(user -> user.getCredentialVersion() == 1).hasSize(1);
	}

	@Test
	void concurrentDeliveriesCannotBothPassTheFifthTargetLimit() throws Exception {
		String target = "limited@example.com";
		User eventOwner = createUser("event-owner@example.com");
		for (int index = 0; index < 4; index++) {
			CredentialSecurityEvent event = new CredentialSecurityEvent();
			event.setUser(eventOwner);
			event.setEventType(CredentialSecurityEventType.EMAIL_VERIFICATION_DELIVERY);
			event.setNormalizedTargetEmail(target);
			event.setOccurredAt(Instant.now().minusSeconds(index));
			eventRepository.save(event);
		}
		eventRepository.flush();
		User first = createUser("limit-first@example.com");
		User second = createUser("limit-second@example.com");
		identityLockInitializer.insertIfMissing(target);

		List<Outcome> outcomes = runConcurrently(
				() -> emailChangeService.start(new StartMyEmailChangeRequest("password123", target), principal(first)),
				() -> emailChangeService.start(new StartMyEmailChangeRequest("password123", target), principal(second)));

		assertThat(outcomes).filteredOn(Outcome::success).hasSize(1);
		assertThat(outcomes).filteredOn(outcome -> "EMAIL_CHANGE_RATE_LIMITED".equals(outcome.errorCode())).hasSize(1);
		assertThat(delivery.acceptedDeliveries.get()).isEqualTo(1);
		assertThat(eventRepository.countByNormalizedTargetEmailAndEventTypeAndOccurredAtGreaterThanEqual(
				target, CredentialSecurityEventType.EMAIL_VERIFICATION_DELIVERY, Instant.now().minusSeconds(86_400)))
				.isEqualTo(5);
		assertThat(pendingRepository.findAll()).hasSize(1);
	}

	private Flyway flyway(String schema, MigrationVersion target) {
		var configuration = Flyway.configure()
				.dataSource(POSTGRES.getJdbcUrl(), POSTGRES.getUsername(), POSTGRES.getPassword())
				.schemas(schema)
				.defaultSchema(schema)
				.placeholders(Map.of("default_timezone", "Europe/Berlin"));
		if (target != null) {
			configuration.target(target);
		}
		return configuration.load();
	}

	private JdbcTemplate isolatedJdbc(String schema) {
		DriverManagerDataSource dataSource = new DriverManagerDataSource();
		dataSource.setDriverClassName(POSTGRES.getDriverClassName());
		String separator = POSTGRES.getJdbcUrl().contains("?") ? "&" : "?";
		dataSource.setUrl(POSTGRES.getJdbcUrl() + separator + "currentSchema=" + schema);
		dataSource.setUsername(POSTGRES.getUsername());
		dataSource.setPassword(POSTGRES.getPassword());
		return new JdbcTemplate(dataSource);
	}

	private User createUser(String email) {
		User user = new User();
		user.setEmail(email);
		user.setPasswordHash(passwordEncoder.encode("password123"));
		user.setFirstName("Postgres");
		user.setLastName("Gate");
		user.setRole(Role.WORKER);
		return userRepository.saveAndFlush(user);
	}

	private PendingEmailChange pending(User user, String target, String code) {
		PendingEmailChange pending = new PendingEmailChange();
		pending.setUser(user);
		pending.setNormalizedNewEmail(target);
		pending.setVerificationCodeHash(passwordEncoder.encode(code));
		pending.setCodeExpiresAt(Instant.now().plusSeconds(600));
		pending.setExpiresAt(Instant.now().plusSeconds(1_800));
		pending.setResendAvailableAt(Instant.now().plusSeconds(60));
		return pending;
	}

	private AuthenticatedUserPrincipal principal(User user) {
		return new AuthenticatedUserPrincipal(user.getId(), user.getEmail(), user.getRole(), user.getCredentialVersion());
	}

	private List<Outcome> runConcurrently(Callable<?> firstMutation, Callable<?> secondMutation) throws Exception {
		CountDownLatch ready = new CountDownLatch(2);
		CountDownLatch start = new CountDownLatch(1);
		try (ExecutorService executor = Executors.newFixedThreadPool(2)) {
			Future<Outcome> first = executor.submit(() -> outcome(firstMutation, ready, start));
			Future<Outcome> second = executor.submit(() -> outcome(secondMutation, ready, start));
			assertThat(ready.await(5, TimeUnit.SECONDS)).isTrue();
			start.countDown();
			return List.of(first.get(15, TimeUnit.SECONDS), second.get(15, TimeUnit.SECONDS));
		}
	}

	private Outcome outcome(Callable<?> mutation, CountDownLatch ready, CountDownLatch start) throws Exception {
		ready.countDown();
		start.await(5, TimeUnit.SECONDS);
		try {
			mutation.call();
			return new Outcome(true, null);
		}
		catch (ApiErrorException exception) {
			return new Outcome(false, exception.getCode());
		}
	}

	private void await(CountDownLatch latch) {
		try {
			if (!latch.await(5, TimeUnit.SECONDS)) {
				throw new IllegalStateException("Timed out waiting for concurrent PostgreSQL test");
			}
		}
		catch (InterruptedException exception) {
			Thread.currentThread().interrupt();
			throw new IllegalStateException("Interrupted during concurrent PostgreSQL test", exception);
		}
	}

	private record Outcome(boolean success, String errorCode) { }

	@TestConfiguration
	static class DeliveryConfiguration {

		@Bean
		@Primary
		CapturingDelivery postgresGateDelivery() {
			return new CapturingDelivery();
		}
	}

	static final class CapturingDelivery implements EmailChangeDelivery {
		private final AtomicBoolean accept = new AtomicBoolean(true);
		private final AtomicInteger acceptedDeliveries = new AtomicInteger();
		private final Map<String, String> deliveredCodes = new ConcurrentHashMap<>();

		@Override
		public boolean deliver(VerificationMessage message) {
			if (!accept.get()) {
				return false;
			}
			deliveredCodes.put(message.recipient(), message.code());
			acceptedDeliveries.incrementAndGet();
			return true;
		}
	}
}
