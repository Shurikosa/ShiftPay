package com.shiftpay.mvp.controller;

import com.shiftpay.mvp.TestDataCleaner;
import com.shiftpay.mvp.entity.PendingEmailChange;
import com.shiftpay.mvp.entity.Role;
import com.shiftpay.mvp.entity.User;
import com.shiftpay.mvp.repository.PendingEmailChangeRepository;
import com.shiftpay.mvp.repository.UserRepository;
import com.shiftpay.mvp.security.JwtService;
import com.shiftpay.mvp.service.EmailChangeDelivery;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.context.TestConfiguration;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Import;
import org.springframework.context.annotation.Primary;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.MvcResult;

import java.util.Map;
import java.time.Instant;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.atomic.AtomicBoolean;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.header;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@SpringBootTest
@AutoConfigureMockMvc
@Import(OwnSettingsControllerTests.DeliveryTestConfig.class)
class OwnSettingsControllerTests {

	private static final Pattern TOKEN = Pattern.compile("\"accessToken\":\"([^\"]+)\"");
	private static final String USERS_ME = "/api/v1/users/me";

	@Autowired MockMvc mockMvc;
	@Autowired JdbcTemplate jdbcTemplate;
	@Autowired UserRepository userRepository;
	@Autowired PendingEmailChangeRepository pendingRepository;
	@Autowired PasswordEncoder passwordEncoder;
	@Autowired JwtService jwtService;
	@Autowired CapturingDelivery delivery;

	@BeforeEach
	void setUp() {
		TestDataCleaner.clean(jdbcTemplate);
		delivery.accept.set(true);
		delivery.codes.clear();
	}

	@Test
	void nameUpdateIsCompleteTrimmedAndRejectsMassAssignment() throws Exception {
		String token = registerAndLogin("worker@example.com", Role.WORKER);

		mockMvc.perform(put(USERS_ME)
					.header(HttpHeaders.AUTHORIZATION, bearer(token))
					.contentType(MediaType.APPLICATION_JSON)
					.content("""
							{"firstName":"  Jane  ","lastName":" Worker "}
							"""))
				.andExpect(status().isOk())
				.andExpect(jsonPath("$.firstName").value("Jane"))
				.andExpect(jsonPath("$.lastName").value("Worker"));

		mockMvc.perform(put(USERS_ME)
					.header(HttpHeaders.AUTHORIZATION, bearer(token))
					.contentType(MediaType.APPLICATION_JSON)
					.content("""
							{"firstName":"Mallory","lastName":"Worker","email":"stolen@example.com"}
							"""))
				.andExpect(status().isBadRequest());

		User stored = userRepository.findByEmail("worker@example.com").orElseThrow();
		assertThat(stored.getFirstName()).isEqualTo("Jane");
		assertThat(stored.getEmail()).isEqualTo("worker@example.com");
	}

	@Test
	void adminCannotUseOwnSettingsMutations() throws Exception {
		User admin = createUser("admin@example.com", Role.ADMIN);
		String token = jwtService.generateAccessToken(admin);

		mockMvc.perform(put(USERS_ME)
					.header(HttpHeaders.AUTHORIZATION, bearer(token))
					.contentType(MediaType.APPLICATION_JSON)
					.content("{\"firstName\":\"Admin\",\"lastName\":\"Changed\"}"))
				.andExpect(status().isForbidden());
		mockMvc.perform(put(USERS_ME + "/password")
					.header(HttpHeaders.AUTHORIZATION, bearer(token))
					.contentType(MediaType.APPLICATION_JSON)
					.content("{\"currentPassword\":\"password123\",\"newPassword\":\"password456\"}"))
				.andExpect(status().isForbidden());
	}

	@Test
	void verifiedEmailChangeRotatesSessionAndNeverPersistsPlainCode() throws Exception {
		String oldToken = registerAndLogin("worker@example.com", Role.WORKER);

		mockMvc.perform(post(USERS_ME + "/email-change")
					.header(HttpHeaders.AUTHORIZATION, bearer(oldToken))
					.contentType(MediaType.APPLICATION_JSON)
					.content("""
							{"currentPassword":"password123","newEmail":"New.Worker@Example.com"}
							"""))
				.andExpect(status().isAccepted())
				.andExpect(jsonPath("$.status").value("PENDING"))
				.andExpect(jsonPath("$.newEmail").value("new.worker@example.com"))
				.andExpect(jsonPath("$.resendsRemaining").value(3))
				.andExpect(jsonPath("$.attemptsRemaining").value(5))
				.andExpect(jsonPath("$.code").doesNotExist());

		String code = delivery.codes.get("new.worker@example.com");
		assertThat(code).matches("[0-9]{6}");
		PendingEmailChange persisted = pendingRepository.findAll().getFirst();
		assertThat(persisted.getVerificationCodeHash()).isNotEqualTo(code);
		assertThat(passwordEncoder.matches(code, persisted.getVerificationCodeHash())).isTrue();

		mockMvc.perform(post(USERS_ME + "/email-change/confirm")
					.header(HttpHeaders.AUTHORIZATION, bearer(oldToken))
					.contentType(MediaType.APPLICATION_JSON)
					.content("{\"code\":\"000000\"}"))
				.andExpect(status().isBadRequest())
				.andExpect(jsonPath("$.code").value("INVALID_EMAIL_VERIFICATION_CODE"))
				.andExpect(jsonPath("$.attemptsRemaining").value(4));

		MvcResult confirmed = mockMvc.perform(post(USERS_ME + "/email-change/confirm")
					.header(HttpHeaders.AUTHORIZATION, bearer(oldToken))
					.contentType(MediaType.APPLICATION_JSON)
					.content("{\"code\":\"" + code + "\"}"))
				.andExpect(status().isOk())
				.andExpect(jsonPath("$.user.email").value("new.worker@example.com"))
				.andReturn();
		String replacement = extractToken(confirmed);

		mockMvc.perform(get(USERS_ME).header(HttpHeaders.AUTHORIZATION, bearer(oldToken)))
				.andExpect(status().isUnauthorized())
				.andExpect(jsonPath("$.code").value("SESSION_REVOKED"));
		mockMvc.perform(get(USERS_ME).header(HttpHeaders.AUTHORIZATION, bearer(replacement)))
				.andExpect(status().isOk())
				.andExpect(jsonPath("$.email").value("new.worker@example.com"));
		assertThat(pendingRepository.findAll()).isEmpty();
	}

	@Test
	void passwordChangeRevokesOldTokenAndReturnsWorkingReplacement() throws Exception {
		String oldToken = registerAndLogin("worker@example.com", Role.WORKER);
		MvcResult changed = mockMvc.perform(put(USERS_ME + "/password")
					.header(HttpHeaders.AUTHORIZATION, bearer(oldToken))
					.contentType(MediaType.APPLICATION_JSON)
					.content("""
							{"currentPassword":"password123","newPassword":"new-password-456"}
							"""))
				.andExpect(status().isOk())
				.andExpect(jsonPath("$.user.email").value("worker@example.com"))
				.andReturn();

		mockMvc.perform(get(USERS_ME).header(HttpHeaders.AUTHORIZATION, bearer(oldToken)))
				.andExpect(status().isUnauthorized())
				.andExpect(jsonPath("$.code").value("SESSION_REVOKED"));
		mockMvc.perform(get(USERS_ME).header(HttpHeaders.AUTHORIZATION, bearer(extractToken(changed))))
				.andExpect(status().isOk());
		assertThat(passwordEncoder.matches("new-password-456",
				userRepository.findByEmail("worker@example.com").orElseThrow().getPasswordHash())).isTrue();
	}

	@Test
	void deliveryFailureLeavesNoPendingChangeAndCancelIsIdempotent() throws Exception {
		String token = registerAndLogin("worker@example.com", Role.WORKER);
		delivery.accept.set(false);

		mockMvc.perform(post(USERS_ME + "/email-change")
					.header(HttpHeaders.AUTHORIZATION, bearer(token))
					.contentType(MediaType.APPLICATION_JSON)
					.content("{\"currentPassword\":\"password123\",\"newEmail\":\"new@example.com\"}"))
				.andExpect(status().isServiceUnavailable())
				.andExpect(jsonPath("$.code").value("EMAIL_DELIVERY_UNAVAILABLE"));
		assertThat(pendingRepository.findAll()).isEmpty();

		mockMvc.perform(delete(USERS_ME + "/email-change")
					.header(HttpHeaders.AUTHORIZATION, bearer(token)))
				.andExpect(status().isNoContent());
	}

	@Test
	void passwordFailuresSharePersistentThrottleWithEmailStart() throws Exception {
		String token = registerAndLogin("worker@example.com", Role.WORKER);
		for (int attempt = 0; attempt < 5; attempt++) {
			mockMvc.perform(post(USERS_ME + "/email-change")
						.header(HttpHeaders.AUTHORIZATION, bearer(token))
						.contentType(MediaType.APPLICATION_JSON)
						.content("{\"currentPassword\":\"wrong-password\",\"newEmail\":\"new@example.com\"}"))
					.andExpect(status().isBadRequest())
					.andExpect(jsonPath("$.code").value("CURRENT_PASSWORD_INCORRECT"));
		}

		mockMvc.perform(put(USERS_ME + "/password")
					.header(HttpHeaders.AUTHORIZATION, bearer(token))
					.contentType(MediaType.APPLICATION_JSON)
					.content("{\"currentPassword\":\"password123\",\"newPassword\":\"new-password-456\"}"))
				.andExpect(status().isTooManyRequests())
				.andExpect(header().exists(HttpHeaders.RETRY_AFTER))
				.andExpect(jsonPath("$.code").value("CURRENT_PASSWORD_RATE_LIMITED"));
	}

	@Test
	void malformedAndMissingCodesConsumeAttemptsAndTheFifthFailureIsTerminal() throws Exception {
		String token = registerAndLogin("worker@example.com", Role.WORKER);
		startEmailChange(token, "new@example.com");

		mockMvc.perform(post(USERS_ME + "/email-change/confirm")
					.header(HttpHeaders.AUTHORIZATION, bearer(token))
					.contentType(MediaType.APPLICATION_JSON))
				.andExpect(status().isBadRequest())
				.andExpect(jsonPath("$.code").value("INVALID_EMAIL_VERIFICATION_CODE"))
				.andExpect(jsonPath("$.attemptsRemaining").value(4));

		for (int remaining = 3; remaining > 0; remaining--) {
			mockMvc.perform(post(USERS_ME + "/email-change/confirm")
						.header(HttpHeaders.AUTHORIZATION, bearer(token))
						.contentType(MediaType.APPLICATION_JSON)
						.content("{\"code\":\"malformed\"}"))
					.andExpect(status().isBadRequest())
					.andExpect(jsonPath("$.code").value("INVALID_EMAIL_VERIFICATION_CODE"))
					.andExpect(jsonPath("$.attemptsRemaining").value(remaining));
		}

		mockMvc.perform(post(USERS_ME + "/email-change/confirm")
					.header(HttpHeaders.AUTHORIZATION, bearer(token))
					.contentType(MediaType.APPLICATION_JSON)
					.content("{}"))
				.andExpect(status().isConflict())
				.andExpect(header().doesNotExist(HttpHeaders.RETRY_AFTER))
				.andExpect(jsonPath("$.code").value("EMAIL_VERIFICATION_ATTEMPTS_EXHAUSTED"))
				.andExpect(jsonPath("$.attemptsRemaining").value(0));
		assertThat(pendingRepository.findAll()).isEmpty();
	}

	@Test
	void resendInvalidatesTheOldCodePreservesAttemptsAndExhaustionHasNoRetryAfter() throws Exception {
		String token = registerAndLogin("worker@example.com", Role.WORKER);
		startEmailChange(token, "new@example.com");
		String oldCode = delivery.codes.get("new@example.com");

		mockMvc.perform(post(USERS_ME + "/email-change/confirm")
					.header(HttpHeaders.AUTHORIZATION, bearer(token))
					.contentType(MediaType.APPLICATION_JSON)
					.content("{\"code\":\"invalid\"}"))
				.andExpect(status().isBadRequest())
				.andExpect(jsonPath("$.attemptsRemaining").value(4));

		allowResend();
		mockMvc.perform(post(USERS_ME + "/email-change/resend")
					.header(HttpHeaders.AUTHORIZATION, bearer(token)))
				.andExpect(status().isOk())
				.andExpect(jsonPath("$.resendsRemaining").value(2))
				.andExpect(jsonPath("$.attemptsRemaining").value(4));
		assertThat(delivery.codes.get("new@example.com")).isNotEqualTo(oldCode);

		mockMvc.perform(post(USERS_ME + "/email-change/confirm")
					.header(HttpHeaders.AUTHORIZATION, bearer(token))
					.contentType(MediaType.APPLICATION_JSON)
					.content("{\"code\":\"" + oldCode + "\"}"))
				.andExpect(status().isBadRequest())
				.andExpect(jsonPath("$.attemptsRemaining").value(3));

		for (int remaining = 1; remaining >= 0; remaining--) {
			allowResend();
			mockMvc.perform(post(USERS_ME + "/email-change/resend")
						.header(HttpHeaders.AUTHORIZATION, bearer(token)))
					.andExpect(status().isOk())
					.andExpect(jsonPath("$.resendsRemaining").value(remaining))
					.andExpect(jsonPath("$.attemptsRemaining").value(3));
		}

		mockMvc.perform(post(USERS_ME + "/email-change/resend")
					.header(HttpHeaders.AUTHORIZATION, bearer(token)))
				.andExpect(status().isConflict())
				.andExpect(header().doesNotExist(HttpHeaders.RETRY_AFTER))
				.andExpect(jsonPath("$.code").value("EMAIL_VERIFICATION_RESENDS_EXHAUSTED"));
	}

	@Test
	void failedResendKeepsThePreviousCodeExpiryAndBudgets() throws Exception {
		String token = registerAndLogin("worker@example.com", Role.WORKER);
		startEmailChange(token, "new@example.com");
		String oldCode = delivery.codes.get("new@example.com");
		PendingEmailChange before = pendingRepository.findAll().getFirst();
		Instant oldCodeExpiry = before.getCodeExpiresAt();
		allowResend();
		delivery.accept.set(false);

		mockMvc.perform(post(USERS_ME + "/email-change/resend")
					.header(HttpHeaders.AUTHORIZATION, bearer(token)))
				.andExpect(status().isServiceUnavailable())
				.andExpect(jsonPath("$.code").value("EMAIL_DELIVERY_UNAVAILABLE"));

		PendingEmailChange after = pendingRepository.findAll().getFirst();
		assertThat(after.getResendCount()).isZero();
		assertThat(after.getFailedAttemptCount()).isZero();
		assertThat(after.getCodeExpiresAt()).isEqualTo(oldCodeExpiry);
		assertThat(passwordEncoder.matches(oldCode, after.getVerificationCodeHash())).isTrue();
	}

	@Test
	void codeExpiryDoesNotConsumeAnAttemptAndAbsoluteExpiryRemovesThePendingChange() throws Exception {
		String token = registerAndLogin("worker@example.com", Role.WORKER);
		startEmailChange(token, "new@example.com");
		PendingEmailChange pending = pendingRepository.findAll().getFirst();
		pending.setCodeExpiresAt(Instant.now().minusSeconds(1));
		pending.setExpiresAt(Instant.now().plusSeconds(60));
		pendingRepository.saveAndFlush(pending);

		mockMvc.perform(post(USERS_ME + "/email-change/confirm")
					.header(HttpHeaders.AUTHORIZATION, bearer(token))
					.contentType(MediaType.APPLICATION_JSON)
					.content("{\"code\":\"invalid\"}"))
				.andExpect(status().isGone())
				.andExpect(jsonPath("$.code").value("EMAIL_VERIFICATION_CODE_EXPIRED"));
		assertThat(pendingRepository.findAll().getFirst().getFailedAttemptCount()).isZero();

		pending = pendingRepository.findAll().getFirst();
		pending.setExpiresAt(Instant.now().minusSeconds(1));
		pendingRepository.saveAndFlush(pending);
		mockMvc.perform(post(USERS_ME + "/email-change/confirm")
					.header(HttpHeaders.AUTHORIZATION, bearer(token))
					.contentType(MediaType.APPLICATION_JSON)
					.content("{\"code\":\"invalid\"}"))
				.andExpect(status().isGone())
				.andExpect(jsonPath("$.code").value("EMAIL_CHANGE_EXPIRED"));
		assertThat(pendingRepository.findAll()).isEmpty();
	}

	@Test
	void lateEmailConflictInvalidatesPendingWithoutChangingCredentials() throws Exception {
		String token = registerAndLogin("worker@example.com", Role.WORKER);
		startEmailChange(token, "claimed@example.com");
		String code = delivery.codes.get("claimed@example.com");
		createUser("claimed@example.com", Role.WORKER);

		mockMvc.perform(post(USERS_ME + "/email-change/confirm")
					.header(HttpHeaders.AUTHORIZATION, bearer(token))
					.contentType(MediaType.APPLICATION_JSON)
					.content("{\"code\":\"" + code + "\"}"))
				.andExpect(status().isConflict())
				.andExpect(jsonPath("$.code").value("EMAIL_ALREADY_IN_USE"));

		User original = userRepository.findByEmail("worker@example.com").orElseThrow();
		assertThat(original.getCredentialVersion()).isZero();
		assertThat(pendingRepository.findByUserId(original.getId())).isEmpty();
	}

	@Test
	void acceptedStartLimitIsRollingAndReturnsRetryAfter() throws Exception {
		String token = registerAndLogin("worker@example.com", Role.WORKER);
		for (int start = 0; start < 3; start++) {
			startEmailChange(token, "target" + start + "@example.com");
			mockMvc.perform(delete(USERS_ME + "/email-change")
						.header(HttpHeaders.AUTHORIZATION, bearer(token)))
					.andExpect(status().isNoContent());
		}

		mockMvc.perform(post(USERS_ME + "/email-change")
					.header(HttpHeaders.AUTHORIZATION, bearer(token))
					.contentType(MediaType.APPLICATION_JSON)
					.content("{\"currentPassword\":\"password123\",\"newEmail\":\"fourth@example.com\"}"))
				.andExpect(status().isTooManyRequests())
				.andExpect(header().exists(HttpHeaders.RETRY_AFTER))
				.andExpect(jsonPath("$.code").value("EMAIL_CHANGE_RATE_LIMITED"));
	}

	@Test
	void targetDeliveryLimitCountsTheInitialMessageAcrossUsers() throws Exception {
		String firstToken = registerAndLogin("first@example.com", Role.WORKER);
		User first = userRepository.findByEmail("first@example.com").orElseThrow();
		for (int deliveryNumber = 0; deliveryNumber < 4; deliveryNumber++) {
			jdbcTemplate.update("""
					insert into credential_security_events
					(user_id, event_type, normalized_target_email, occurred_at)
					values (?, 'EMAIL_VERIFICATION_DELIVERY', 'shared@example.com', current_timestamp)
					""", first.getId());
		}
		startEmailChange(firstToken, "shared@example.com");
		mockMvc.perform(delete(USERS_ME + "/email-change")
					.header(HttpHeaders.AUTHORIZATION, bearer(firstToken)))
				.andExpect(status().isNoContent());

		User second = createUser("second@example.com", Role.WORKER);
		String secondToken = jwtService.generateAccessToken(second);
		mockMvc.perform(post(USERS_ME + "/email-change")
					.header(HttpHeaders.AUTHORIZATION, bearer(secondToken))
					.contentType(MediaType.APPLICATION_JSON)
					.content("{\"currentPassword\":\"password123\",\"newEmail\":\"shared@example.com\"}"))
				.andExpect(status().isTooManyRequests())
				.andExpect(header().exists(HttpHeaders.RETRY_AFTER))
				.andExpect(jsonPath("$.code").value("EMAIL_CHANGE_RATE_LIMITED"));
	}

	private void startEmailChange(String token, String email) throws Exception {
		mockMvc.perform(post(USERS_ME + "/email-change")
					.header(HttpHeaders.AUTHORIZATION, bearer(token))
					.contentType(MediaType.APPLICATION_JSON)
					.content("{\"currentPassword\":\"password123\",\"newEmail\":\"" + email + "\"}"))
				.andExpect(status().isAccepted());
	}

	private void allowResend() {
		PendingEmailChange pending = pendingRepository.findAll().getFirst();
		pending.setResendAvailableAt(Instant.now().minusSeconds(1));
		pendingRepository.saveAndFlush(pending);
	}

	private String registerAndLogin(String email, Role role) throws Exception {
		mockMvc.perform(post("/api/v1/auth/register")
					.contentType(MediaType.APPLICATION_JSON)
					.content("""
							{"email":"%s","password":"password123","firstName":"John","lastName":"Worker","role":"%s"}
							""".formatted(email, role)))
				.andExpect(status().isCreated());
		MvcResult result = mockMvc.perform(post("/api/v1/auth/login")
					.contentType(MediaType.APPLICATION_JSON)
					.content("{\"email\":\"%s\",\"password\":\"password123\"}".formatted(email)))
				.andExpect(status().isOk())
				.andReturn();
		return extractToken(result);
	}

	private User createUser(String email, Role role) {
		User user = new User();
		user.setEmail(email);
		user.setPasswordHash(passwordEncoder.encode("password123"));
		user.setFirstName("Admin");
		user.setLastName("User");
		user.setRole(role);
		return userRepository.saveAndFlush(user);
	}

	private String extractToken(MvcResult result) throws Exception {
		Matcher matcher = TOKEN.matcher(result.getResponse().getContentAsString());
		assertThat(matcher.find()).isTrue();
		return matcher.group(1);
	}

	private String bearer(String token) {
		return "Bearer " + token;
	}

	@TestConfiguration(proxyBeanMethods = false)
	static class DeliveryTestConfig {
		@Bean
		@Primary
		CapturingDelivery capturingDelivery() {
			return new CapturingDelivery();
		}
	}

	static final class CapturingDelivery implements EmailChangeDelivery {
		private final AtomicBoolean accept = new AtomicBoolean(true);
		private final Map<String, String> codes = new ConcurrentHashMap<>();

		@Override
		public boolean deliver(VerificationMessage message) {
			if (!accept.get()) {
				return false;
			}
			codes.put(message.recipient(), message.code());
			return true;
		}
	}
}
