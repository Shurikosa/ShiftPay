package com.shiftpay.mvp.controller;

import com.shiftpay.mvp.TestDataCleaner;
import com.shiftpay.mvp.entity.Role;
import com.shiftpay.mvp.entity.User;
import com.shiftpay.mvp.repository.UserRepository;
import com.shiftpay.mvp.security.JwtService;
import com.shiftpay.mvp.service.PasswordResetDelivery;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.context.TestConfiguration;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Import;
import org.springframework.context.annotation.Primary;
import org.springframework.http.MediaType;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.MvcResult;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.json.JsonMapper;

import java.sql.Timestamp;
import java.time.Instant;
import java.util.Map;
import java.util.ArrayList;
import java.util.Collections;
import java.util.List;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.Future;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.TimeoutException;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@SpringBootTest
@AutoConfigureMockMvc
@Import(PasswordResetControllerTests.DeliveryConfiguration.class)
class PasswordResetControllerTests {
	private static final String REQUEST = "/api/v1/auth/password-reset/request";
	private static final String CONFIRM = "/api/v1/auth/password-reset/confirm";
	private final JsonMapper json = JsonMapper.shared();

	@Autowired MockMvc mvc;
	@Autowired JdbcTemplate jdbc;
	@Autowired UserRepository users;
	@Autowired PasswordEncoder passwords;
	@Autowired JwtService jwt;
	@Autowired CapturingDelivery delivery;

	@BeforeEach
	void clean() {
		TestDataCleaner.clean(jdbc);
		delivery.codes.clear();
		delivery.accept = true;
		delivery.entered = null;
		delivery.release = null;
		delivery.exposeBeforeRelease = false;
	}

	@Test
	void eligibleUnknownAndAdminHaveSameResponseAndDummyLifecycle() throws Exception {
		create("worker@example.com", Role.WORKER);
		create("admin@example.com", Role.ADMIN);
		JsonNode worker = request(" Worker@Example.com ");
		JsonNode unknown = request("unknown@example.com");
		JsonNode admin = request("admin@example.com");
		assertThat(worker.get("message").asText()).isEqualTo(unknown.get("message").asText())
				.isEqualTo(admin.get("message").asText());
		assertThat(worker.get("requestId").asText()).isNotEqualTo(unknown.get("requestId").asText());
		awaitCode("worker@example.com");
		assertThat(delivery.codes).containsOnlyKeys("worker@example.com");
		assertThat(jdbc.queryForObject("select count(*) from password_reset_requests", Integer.class)).isEqualTo(3);
		assertThat(jdbc.queryForObject("select count(*) from password_reset_requests where user_id is null", Integer.class))
				.isEqualTo(2);
		for (JsonNode id : new JsonNode[] {unknown.get("requestId"), admin.get("requestId")}) {
			for (int attempt = 4; attempt >= 1; attempt--) {
				mvc.perform(post(CONFIRM).contentType(MediaType.APPLICATION_JSON)
						.content(confirm(id.asText(), "000000", "new-password-456")))
						.andExpect(status().isBadRequest())
						.andExpect(jsonPath("$.code").value("PASSWORD_RESET_CODE_INVALID"))
						.andExpect(jsonPath("$.attemptsRemaining").value(attempt));
			}
			mvc.perform(post(CONFIRM).contentType(MediaType.APPLICATION_JSON)
					.content(confirm(id.asText(), "000000", "new-password-456")))
					.andExpect(status().isConflict())
					.andExpect(jsonPath("$.code").value("PASSWORD_RESET_ATTEMPTS_EXHAUSTED"))
					.andExpect(jsonPath("$.attemptsRemaining").value(0));
			mvc.perform(post(CONFIRM).contentType(MediaType.APPLICATION_JSON)
					.content(confirm(id.asText(), "000000", "new-password-456")))
					.andExpect(status().isGone())
					.andExpect(jsonPath("$.code").value("PASSWORD_RESET_REQUEST_EXPIRED"));
		}
	}

	@Test
	void successRevokesOldJwtAndReplayFails() throws Exception {
		User user = create("worker@example.com", Role.WORKER);
		String oldToken = jwt.generateAccessToken(user);
		String id = request(user.getEmail()).get("requestId").asText();
		String code = awaitCode(user.getEmail());
		mvc.perform(post(CONFIRM).contentType(MediaType.APPLICATION_JSON)
				.content(confirm(id, code, "new-password-456")))
				.andExpect(status().isNoContent())
				.andExpect(result -> assertThat(result.getResponse().getContentAsString()).isEmpty());
		User updated = users.findById(user.getId()).orElseThrow();
		assertThat(updated.getCredentialVersion()).isEqualTo(1);
		assertThat(passwords.matches("new-password-456", updated.getPasswordHash())).isTrue();
		mvc.perform(get("/api/v1/users/me").header("Authorization", "Bearer " + oldToken))
				.andExpect(status().isUnauthorized()).andExpect(jsonPath("$.code").value("SESSION_REVOKED"));
		mvc.perform(post(CONFIRM).contentType(MediaType.APPLICATION_JSON)
				.content(confirm(id, code, "another-password-456")))
				.andExpect(status().isGone());
	}

	@Test
	void malformedSyntaxDoesNotConsumeAndIncorrectCodeDoes() throws Exception {
		create("worker@example.com", Role.WORKER);
		String id = request("worker@example.com").get("requestId").asText();
		mvc.perform(post(CONFIRM).contentType(MediaType.APPLICATION_JSON)
				.content(confirm(id, "", "short")))
				.andExpect(status().isBadRequest());
		assertThat(failures(id)).isZero();
		mvc.perform(post(CONFIRM).contentType(MediaType.APPLICATION_JSON)
				.content(confirm(id, null, "new-password-456")))
				.andExpect(status().isBadRequest())
				.andExpect(jsonPath("$.attemptsRemaining").value(4));
		assertThat(failures(id)).isEqualTo(1);
		mvc.perform(post(CONFIRM).contentType(MediaType.APPLICATION_JSON)
				.content("{\"requestId\":\"" + id + "\",\"code\":\"123456\",\"newPassword\":\"new-password-456\",\"extra\":1}"))
				.andExpect(status().isBadRequest());
		assertThat(failures(id)).isEqualTo(1);
	}

	@Test
	void numericJsonCodeCannotConfirmAsStringCode() throws Exception {
		create("worker@example.com", Role.WORKER);
		String id = request("worker@example.com").get("requestId").asText();
		String code = awaitCode("worker@example.com");
		mvc.perform(post(CONFIRM).contentType(MediaType.APPLICATION_JSON)
				.content("{\"requestId\":\"" + id + "\",\"code\":" + Integer.parseInt(code)
						+ ",\"newPassword\":\"new-password-456\"}"))
				.andExpect(status().isBadRequest())
				.andExpect(jsonPath("$.code").value("PASSWORD_RESET_CODE_INVALID"))
				.andExpect(jsonPath("$.attemptsRemaining").value(4));
		mvc.perform(post(CONFIRM).contentType(MediaType.APPLICATION_JSON)
				.content("{\"requestId\":\"" + id + "\",\"code\":\"" + code
						+ "\",\"newPassword\":123456789}"))
				.andExpect(status().isBadRequest())
				.andExpect(jsonPath("$.code").doesNotExist());
		assertThat(failures(id)).isEqualTo(1);
	}

	@Test
	void requestCooldownDoesNotInvalidateAndExpiryPrecedesCode() throws Exception {
		create("worker@example.com", Role.WORKER);
		String id = request("worker@example.com").get("requestId").asText();
		MvcResult limited = mvc.perform(post(REQUEST).contentType(MediaType.APPLICATION_JSON)
				.content("{\"email\":\"worker@example.com\"}"))
				.andExpect(status().isTooManyRequests())
				.andExpect(jsonPath("$.code").value("PASSWORD_RESET_RATE_LIMITED"))
				.andReturn();
		assertThat(Integer.parseInt(limited.getResponse().getHeader("Retry-After"))).isBetween(1, 60);
		assertThat(jdbc.queryForObject("select count(*) from password_reset_requests", Integer.class)).isEqualTo(1);
		jdbc.update("update password_reset_requests set expires_at = ? where request_id = ?",
				Timestamp.from(Instant.now().minusSeconds(1)), java.util.UUID.fromString(id));
		mvc.perform(post(CONFIRM).contentType(MediaType.APPLICATION_JSON)
				.content(confirm(id, awaitCode("worker@example.com"), "new-password-456")))
				.andExpect(status().isGone());
		assertThat(failures(id)).isZero();
	}

	@Test
	void staleVersionAndEmailAreRejected() throws Exception {
		User user = create("worker@example.com", Role.WORKER);
		String id = request(user.getEmail()).get("requestId").asText();
		String code = awaitCode(user.getEmail());
		user = users.findById(user.getId()).orElseThrow();
		user.setCredentialVersion(1);
		users.saveAndFlush(user);
		mvc.perform(post(CONFIRM).contentType(MediaType.APPLICATION_JSON)
				.content(confirm(id, code, "new-password-456")))
				.andExpect(status().isGone());
		assertThat(passwords.matches("password123", users.findById(user.getId()).orElseThrow().getPasswordHash()))
				.isTrue();
	}

	@Test
	void acceptedResendSupersedesAndThrottledResendPreservesOldRequest() throws Exception {
		create("worker@example.com", Role.WORKER);
		String first = request("worker@example.com").get("requestId").asText();
		mvc.perform(post(REQUEST).contentType(MediaType.APPLICATION_JSON)
				.content("{\"email\":\"worker@example.com\"}"))
				.andExpect(status().isTooManyRequests());
		assertThat(jdbc.queryForObject("select terminal_at from password_reset_requests where request_id = ?",
				Timestamp.class, java.util.UUID.fromString(first))).isNull();
		moveNewestEventBack(61);
		String second = request("worker@example.com").get("requestId").asText();
		assertThat(second).isNotEqualTo(first);
		mvc.perform(post(CONFIRM).contentType(MediaType.APPLICATION_JSON)
				.content(confirm(first, "000000", "new-password-456")))
				.andExpect(status().isGone());
		assertThat(failures(second)).isZero();
	}

	@Test
	void deliveryFailureIsOpaqueAndMakesRequestUnusable() throws Exception {
		create("worker@example.com", Role.WORKER);
		delivery.accept = false;
		String id = request("worker@example.com").get("requestId").asText();
		for (int attempt = 0; attempt < 100; attempt++) {
			Long owner = jdbc.queryForObject(
					"select user_id from password_reset_requests where request_id = ?", Long.class,
					java.util.UUID.fromString(id));
			if (owner == null) break;
			Thread.sleep(10);
		}
		mvc.perform(post(CONFIRM).contentType(MediaType.APPLICATION_JSON)
				.content(confirm(id, "000000", "new-password-456")))
				.andExpect(status().isBadRequest())
				.andExpect(jsonPath("$.code").value("PASSWORD_RESET_CODE_INVALID"))
				.andExpect(jsonPath("$.attemptsRemaining").value(4));
		String unknown = request("unknown@example.com").get("requestId").asText();
		mvc.perform(post(CONFIRM).contentType(MediaType.APPLICATION_JSON)
				.content(confirm(unknown, "000000", "new-password-456")))
				.andExpect(status().isBadRequest())
				.andExpect(jsonPath("$.attemptsRemaining").value(4));
		assertThat(delivery.codes).isEmpty();
	}

	@Test
	void responseDoesNotWaitForProviderDelivery() throws Exception {
		create("worker@example.com", Role.WORKER);
		delivery.entered = new CountDownLatch(1);
		delivery.release = new CountDownLatch(1);
		try {
			long began = System.nanoTime();
			request("worker@example.com");
			long elapsedMillis = TimeUnit.NANOSECONDS.toMillis(System.nanoTime() - began);
			assertThat(delivery.entered.await(1, TimeUnit.SECONDS)).isTrue();
			assertThat(elapsedMillis).isLessThan(1000);
			assertThat(delivery.codes).isEmpty();
		}
		finally {
			delivery.release.countDown();
		}
		awaitCode("worker@example.com");
	}

	@Test
	void correctCodeWhileDeliveryPendingDoesNotSpendFinalAttempt() throws Exception {
		User user = create("pending@example.com", Role.WORKER);
		delivery.entered = new CountDownLatch(1);
		delivery.release = new CountDownLatch(1);
		delivery.exposeBeforeRelease = true;
		String id = request(user.getEmail()).get("requestId").asText();
		String code = awaitCode(user.getEmail());
		assertThat(delivery.entered.await(1, TimeUnit.SECONDS)).isTrue();
		jdbc.update("update password_reset_requests set failed_attempts = 4 where request_id = ?",
				java.util.UUID.fromString(id));
		ExecutorService executor = Executors.newSingleThreadExecutor();
		try {
			Future<MvcResult> confirmation = executor.submit(() -> mvc.perform(post(CONFIRM)
					.contentType(MediaType.APPLICATION_JSON)
					.content(confirm(id, code, "new-password-456"))).andReturn());
			try {
				assertThat(confirmation.get(200, TimeUnit.MILLISECONDS)).isNull();
			}
			catch (TimeoutException expected) {
				// The documented confirmation result waits for delivery to settle.
			}
			assertThat(failures(id)).isEqualTo(4);
			delivery.release.countDown();
			assertThat(confirmation.get(5, TimeUnit.SECONDS).getResponse().getStatus()).isEqualTo(204);
		}
		finally {
			delivery.release.countDown();
			executor.shutdownNow();
		}
		assertThat(failures(id)).isEqualTo(4);
		assertThat(users.findById(user.getId()).orElseThrow().getCredentialVersion()).isEqualTo(1);
	}

	@Test
	void correctCodeConcurrentWithDeliveryFailureKeepsDummyErrorBehavior() throws Exception {
		User user = create("failed-pending@example.com", Role.WORKER);
		delivery.entered = new CountDownLatch(1);
		delivery.release = new CountDownLatch(1);
		delivery.exposeBeforeRelease = true;
		delivery.accept = false;
		String id = request(user.getEmail()).get("requestId").asText();
		String code = awaitCode(user.getEmail());
		ExecutorService executor = Executors.newSingleThreadExecutor();
		try {
			Future<MvcResult> confirmation = executor.submit(() -> mvc.perform(post(CONFIRM)
					.contentType(MediaType.APPLICATION_JSON)
					.content(confirm(id, code, "new-password-456"))).andReturn());
			try {
				assertThat(confirmation.get(200, TimeUnit.MILLISECONDS)).isNull();
			}
			catch (TimeoutException expected) {
				// No attempt is spent while the provider outcome is pending.
			}
			assertThat(failures(id)).isZero();
			delivery.release.countDown();
			MvcResult failed = confirmation.get(5, TimeUnit.SECONDS);
			assertThat(failed.getResponse().getStatus()).isEqualTo(400);
			assertThat(json.readTree(failed.getResponse().getContentAsString()).get("code").asText())
					.isEqualTo("PASSWORD_RESET_CODE_INVALID");
			assertThat(json.readTree(failed.getResponse().getContentAsString()).get("attemptsRemaining").asInt())
					.isEqualTo(4);
		}
		finally {
			delivery.release.countDown();
			executor.shutdownNow();
		}
		assertThat(failures(id)).isEqualTo(1);
		assertThat(passwords.matches("password123", users.findById(user.getId()).orElseThrow().getPasswordHash()))
				.isTrue();
	}

	@Test
	void eligibleAndUnknownAcceptedRequestsShareTimingEnvelope() throws Exception {
		for (int index = 0; index < 4; index++) create("eligible" + index + "@example.com", Role.WORKER);
		List<Long> eligibleMillis = new ArrayList<>();
		List<Long> unknownMillis = new ArrayList<>();
		for (int index = 0; index < 4; index++) {
			long began = System.nanoTime();
			request("eligible" + index + "@example.com");
			eligibleMillis.add(TimeUnit.NANOSECONDS.toMillis(System.nanoTime() - began));
			began = System.nanoTime();
			request("unknown" + index + "@example.com");
			unknownMillis.add(TimeUnit.NANOSECONDS.toMillis(System.nanoTime() - began));
		}
		Collections.sort(eligibleMillis);
		Collections.sort(unknownMillis);
		assertThat(Math.abs(eligibleMillis.get(2) - unknownMillis.get(2))).isLessThan(100L);
	}

	@Test
	void rollingAddressLimitsAndLongestRetryAfterApplyToUnknownAddress() throws Exception {
		for (int count = 0; count < 3; count++) {
			request("unknown@example.com");
			moveNewestEventBack(61);
		}
		MvcResult hourLimit = mvc.perform(post(REQUEST).contentType(MediaType.APPLICATION_JSON)
				.content("{\"email\":\"unknown@example.com\"}"))
				.andExpect(status().isTooManyRequests()).andReturn();
		assertThat(Integer.parseInt(hourLimit.getResponse().getHeader("Retry-After"))).isBetween(3538, 3540);
		jdbc.update("update password_reset_events set occurred_at = ?",
				Timestamp.from(Instant.now().minusSeconds(3700)));
		for (int count = 0; count < 2; count++) {
			request("unknown@example.com");
			moveNewestEventBack(61);
		}
		MvcResult dayLimit = mvc.perform(post(REQUEST).contentType(MediaType.APPLICATION_JSON)
				.content("{\"email\":\"unknown@example.com\"}"))
				.andExpect(status().isTooManyRequests()).andReturn();
		assertThat(Integer.parseInt(dayLimit.getResponse().getHeader("Retry-After"))).isGreaterThan(82000);
	}

	@Test
	void retryAfterRoundsLongestActiveFractionalLimitUp() throws Exception {
		for (int count = 0; count < 3; count++) {
			request("fractional@example.com");
			moveNewestEventBack(61);
		}
		List<Long> ids = jdbc.query("select id from password_reset_events order by id",
				(rs, rowNum) -> rs.getLong(1));
		Instant now = Instant.now();
		jdbc.update("update password_reset_events set occurred_at = ? where id = ?",
				Timestamp.from(now.minusSeconds(3538).minusMillis(200)), ids.get(0));
		jdbc.update("update password_reset_events set occurred_at = ? where id = ?",
				Timestamp.from(now.minusSeconds(100)), ids.get(1));
		jdbc.update("update password_reset_events set occurred_at = ? where id = ?",
				Timestamp.from(now.minusSeconds(10)), ids.get(2));
		MvcResult limited = mvc.perform(post(REQUEST).contentType(MediaType.APPLICATION_JSON)
				.content("{\"email\":\"fractional@example.com\"}"))
				.andExpect(status().isTooManyRequests()).andReturn();
		assertThat(limited.getResponse().getHeader("Retry-After")).isEqualTo("62");
	}

	@Test
	void ipLimitAppliesAcrossDistinctAddressesAndIgnoresUntrustedForwardedHeader() throws Exception {
		for (int index = 0; index < 20; index++) {
			mvc.perform(post(REQUEST).contentType(MediaType.APPLICATION_JSON)
					.content("{\"email\":\"unknown" + index + "@example.com\"}"))
					.andExpect(status().isAccepted());
		}
		mvc.perform(post(REQUEST).contentType(MediaType.APPLICATION_JSON)
				.content("{\"email\":\"different@example.com\"}")
				.header("X-Forwarded-For", "203.0.113.10"))
				.andExpect(status().isTooManyRequests())
				.andExpect(jsonPath("$.message").value("Please try again later."));
	}

	@Test
	void unchangedPasswordDoesNotConsumeValidCodeAndTombstoneEventuallyBecomesUnknown() throws Exception {
		create("worker@example.com", Role.WORKER);
		String id = request("worker@example.com").get("requestId").asText();
		String code = awaitCode("worker@example.com");
		mvc.perform(post(CONFIRM).contentType(MediaType.APPLICATION_JSON)
				.content(confirm(id, code, "password123")))
				.andExpect(status().isBadRequest())
				.andExpect(jsonPath("$.code").value("PASSWORD_UNCHANGED"));
		assertThat(failures(id)).isZero();
		jdbc.update("update password_reset_requests set terminal_at = ? where request_id = ?",
				Timestamp.from(Instant.now().minusSeconds(24 * 3600 + 1)), java.util.UUID.fromString(id));
		mvc.perform(post(CONFIRM).contentType(MediaType.APPLICATION_JSON)
				.content(confirm(id, code, "new-password-456")))
				.andExpect(status().isBadRequest())
				.andExpect(jsonPath("$.code").value("PASSWORD_RESET_CODE_INVALID"));
	}

	@Test
	void changedEmailWithoutVersionIncrementStillMakesCodeStale() throws Exception {
		User user = create("worker@example.com", Role.WORKER);
		String id = request(user.getEmail()).get("requestId").asText();
		String code = awaitCode(user.getEmail());
		user = users.findById(user.getId()).orElseThrow();
		user.setEmail("changed@example.com");
		users.saveAndFlush(user);
		mvc.perform(post(CONFIRM).contentType(MediaType.APPLICATION_JSON)
				.content(confirm(id, code, "new-password-456")))
				.andExpect(status().isGone());
		assertThat(passwords.matches("password123", users.findById(user.getId()).orElseThrow().getPasswordHash()))
				.isTrue();
	}

	@Test
	void becomingAdminAfterIssuanceMakesRequestStale() throws Exception {
		User user = create("worker@example.com", Role.WORKER);
		String id = request(user.getEmail()).get("requestId").asText();
		String code = awaitCode(user.getEmail());
		user = users.findById(user.getId()).orElseThrow();
		user.setRole(Role.ADMIN);
		users.saveAndFlush(user);
		mvc.perform(post(CONFIRM).contentType(MediaType.APPLICATION_JSON)
				.content(confirm(id, code, "new-password-456")))
				.andExpect(status().isGone());
		assertThat(passwords.matches("password123", users.findById(user.getId()).orElseThrow().getPasswordHash()))
				.isTrue();
	}

	private User create(String email, Role role) {
		User user = new User();
		user.setEmail(email);
		user.setPasswordHash(passwords.encode("password123"));
		user.setFirstName("Test");
		user.setLastName("User");
		user.setRole(role);
		return users.saveAndFlush(user);
	}

	private JsonNode request(String email) throws Exception {
		MvcResult result = mvc.perform(post(REQUEST).contentType(MediaType.APPLICATION_JSON)
				.content(json.writeValueAsString(Map.of("email", email))))
				.andExpect(status().isAccepted())
				.andExpect(jsonPath("$.message").value("If this address can be recovered, check your email for a code."))
				.andReturn();
		return json.readTree(result.getResponse().getContentAsString());
	}

	private String awaitCode(String email) throws Exception {
		for (int attempt = 0; attempt < 100; attempt++) {
			String code = delivery.codes.get(email);
			if (code != null) return code;
			Thread.sleep(10);
		}
		throw new AssertionError("Delivery did not reach the test provider");
	}

	private int failures(String id) {
		return jdbc.queryForObject("select failed_attempts from password_reset_requests where request_id = ?",
				Integer.class, java.util.UUID.fromString(id));
	}

	private void moveNewestEventBack(long seconds) {
		Long newest = jdbc.queryForObject("select max(id) from password_reset_events", Long.class);
		jdbc.update("update password_reset_events set occurred_at = ? where id = ?",
				Timestamp.from(Instant.now().minusSeconds(seconds)), newest);
	}

	private String confirm(String id, String code, String password) throws Exception {
		return json.writeValueAsString(Map.of("requestId", id, "code", code == null ? "" : code,
				"newPassword", password));
	}

	@TestConfiguration
	static class DeliveryConfiguration {
		@Bean
		@Primary
		CapturingDelivery passwordResetTestDelivery() {
			return new CapturingDelivery();
		}
	}

	static class CapturingDelivery implements PasswordResetDelivery {
		final Map<String, String> codes = new ConcurrentHashMap<>();
		volatile boolean accept = true;
		volatile CountDownLatch entered;
		volatile CountDownLatch release;
		volatile boolean exposeBeforeRelease;
		@Override
		public boolean deliver(Message message) {
			if (exposeBeforeRelease) codes.put(message.recipient(), message.code());
			if (entered != null) entered.countDown();
			if (release != null) {
				try {
					release.await(5, TimeUnit.SECONDS);
				}
				catch (InterruptedException exception) {
					Thread.currentThread().interrupt();
					return false;
				}
			}
			if (accept) codes.put(message.recipient(), message.code());
			return accept;
		}
	}
}
