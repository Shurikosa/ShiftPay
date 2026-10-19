package com.shiftpay.mvp.security;

import com.shiftpay.mvp.TestDataCleaner;
import com.shiftpay.mvp.entity.Role;
import com.shiftpay.mvp.entity.User;
import com.shiftpay.mvp.repository.UserRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.http.HttpHeaders;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.test.web.servlet.MockMvc;

import javax.crypto.Mac;
import javax.crypto.spec.SecretKeySpec;
import java.nio.charset.StandardCharsets;
import java.time.Instant;
import java.util.Base64;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@SpringBootTest
@AutoConfigureMockMvc
class SessionRevocationControllerTests {

	private static final String JWT_SECRET = "shiftpay-dev-secret-change-me";
	private static final Base64.Encoder BASE64 = Base64.getUrlEncoder().withoutPadding();

	@Autowired MockMvc mockMvc;
	@Autowired JdbcTemplate jdbcTemplate;
	@Autowired UserRepository userRepository;
	@Autowired PasswordEncoder passwordEncoder;

	@BeforeEach
	void setUp() {
		TestDataCleaner.clean(jdbcTemplate);
	}

	@Test
	void rolloutTokenWithoutCredentialVersionWorksOnlyWhilePersistedVersionIsZero() throws Exception {
		User user = createUser("worker@example.com", Role.WORKER);
		String rolloutToken = token(user.getId(), user.getEmail(), Role.WORKER, null);

		mockMvc.perform(get("/api/v1/users/me")
					.header(HttpHeaders.AUTHORIZATION, "Bearer " + rolloutToken))
				.andExpect(status().isOk());

		user.setCredentialVersion(1);
		userRepository.saveAndFlush(user);
		mockMvc.perform(get("/api/v1/users/me")
					.header(HttpHeaders.AUTHORIZATION, "Bearer " + rolloutToken))
				.andExpect(status().isUnauthorized())
				.andExpect(jsonPath("$.code").value("SESSION_REVOKED"));
	}

	@Test
	void persistedRoleMismatchAndMissingSubjectAreSessionRevocations() throws Exception {
		User user = createUser("worker@example.com", Role.WORKER);

		mockMvc.perform(get("/api/v1/users/me")
					.header(HttpHeaders.AUTHORIZATION,
							"Bearer " + token(user.getId(), user.getEmail(), Role.FOREMAN, 0L)))
				.andExpect(status().isUnauthorized())
				.andExpect(jsonPath("$.code").value("SESSION_REVOKED"));

		mockMvc.perform(get("/api/v1/users/me")
					.header(HttpHeaders.AUTHORIZATION,
							"Bearer " + token(user.getId() + 999, user.getEmail(), Role.WORKER, 0L)))
				.andExpect(status().isUnauthorized())
				.andExpect(jsonPath("$.code").value("SESSION_REVOKED"));
	}

	private User createUser(String email, Role role) {
		User user = new User();
		user.setEmail(email);
		user.setPasswordHash(passwordEncoder.encode("password123"));
		user.setFirstName("Test");
		user.setLastName("User");
		user.setRole(role);
		return userRepository.saveAndFlush(user);
	}

	private String token(Long userId, String email, Role role, Long credentialVersion) throws Exception {
		String header = encode("{\"alg\":\"HS256\",\"typ\":\"JWT\"}");
		String versionClaim = credentialVersion == null
				? ""
				: ",\"credentialVersion\":" + credentialVersion;
		String payload = encode("""
				{"sub":"%d","email":"%s","role":"%s"%s,"exp":%d}
				""".formatted(userId, email, role, versionClaim, Instant.now().plusSeconds(3600).getEpochSecond()).trim());
		String signingInput = header + "." + payload;
		Mac mac = Mac.getInstance("HmacSHA256");
		mac.init(new SecretKeySpec(JWT_SECRET.getBytes(StandardCharsets.UTF_8), "HmacSHA256"));
		String signature = BASE64.encodeToString(mac.doFinal(signingInput.getBytes(StandardCharsets.UTF_8)));
		return signingInput + "." + signature;
	}

	private String encode(String value) {
		return BASE64.encodeToString(value.getBytes(StandardCharsets.UTF_8));
	}
}
