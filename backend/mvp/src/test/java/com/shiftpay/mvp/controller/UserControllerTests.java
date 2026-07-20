package com.shiftpay.mvp.controller;

import com.shiftpay.mvp.TestDataCleaner;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.MvcResult;

import java.util.regex.Matcher;
import java.util.regex.Pattern;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/**
 * Controller integration tests for the authenticated current-user endpoint.
 *
 * <p>The class verifies JWT access to {@code GET /api/v1/users/me}, unauthorized handling for missing or invalid
 * tokens, and response DTO safety around password fields.</p>
 */
@SpringBootTest
@AutoConfigureMockMvc
class UserControllerTests {

	private static final String REGISTER_URL = "/api/v1/auth/register";
	private static final String LOGIN_URL = "/api/v1/auth/login";
	private static final String CURRENT_USER_URL = "/api/v1/users/me";
	private static final Pattern ACCESS_TOKEN_PATTERN = Pattern.compile("\"accessToken\":\"([^\"]+)\"");

	@Autowired
	private MockMvc mockMvc;

	@Autowired
	private JdbcTemplate jdbcTemplate;

	/**
	 * Removes users and related data so each current-user scenario owns its authentication state.
	 */
	@BeforeEach
	void setUp() {
		TestDataCleaner.clean(jdbcTemplate);
	}

	/**
	 * Registers and logs in a worker, then expects the current-user endpoint to return that account.
	 */
	@Test
	void currentUserWithValidTokenReturnsCurrentUser() throws Exception {
		String accessToken = registerAndLoginWorker();

		mockMvc.perform(get(CURRENT_USER_URL)
						.header(HttpHeaders.AUTHORIZATION, "Bearer " + accessToken))
				.andExpect(status().isOk())
				.andExpect(jsonPath("$.id").isNumber())
				.andExpect(jsonPath("$.email").value("worker@example.com"))
				.andExpect(jsonPath("$.firstName").value("John"))
				.andExpect(jsonPath("$.lastName").value("Worker"))
				.andExpect(jsonPath("$.role").value("WORKER"));
	}

	/**
	 * Calls the protected endpoint without Authorization and expects the standard 401 response.
	 */
	@Test
	void currentUserWithoutTokenReturnsUnauthorized() throws Exception {
		mockMvc.perform(get(CURRENT_USER_URL))
				.andExpect(status().isUnauthorized())
				.andExpect(jsonPath("$.status").value(401))
				.andExpect(jsonPath("$.error").value("Unauthorized"))
				.andExpect(jsonPath("$.message").value("Unauthorized"))
				.andExpect(jsonPath("$.path").value(CURRENT_USER_URL));
	}

	/**
	 * Sends a malformed Bearer token and expects JWT filtering to reject the request with 401.
	 */
	@Test
	void currentUserWithInvalidTokenReturnsUnauthorized() throws Exception {
		mockMvc.perform(get(CURRENT_USER_URL)
						.header(HttpHeaders.AUTHORIZATION, "Bearer invalid-token"))
				.andExpect(status().isUnauthorized())
				.andExpect(jsonPath("$.status").value(401))
				.andExpect(jsonPath("$.error").value("Unauthorized"))
				.andExpect(jsonPath("$.message").value("Unauthorized"))
				.andExpect(jsonPath("$.path").value(CURRENT_USER_URL));
	}

	/**
	 * Ensures the authenticated profile response exposes only public user fields.
	 */
	@Test
	void currentUserDoesNotExposePasswordOrPasswordHash() throws Exception {
		String accessToken = registerAndLoginWorker();

		mockMvc.perform(get(CURRENT_USER_URL)
						.header(HttpHeaders.AUTHORIZATION, "Bearer " + accessToken))
				.andExpect(status().isOk())
				.andExpect(jsonPath("$.password").doesNotExist())
				.andExpect(jsonPath("$.passwordHash").doesNotExist());
	}

	/**
	 * Creates a worker through the public API, logs in, and extracts the access token from the JSON response.
	 *
	 * @return JWT access token for the registered worker
	 */
	private String registerAndLoginWorker() throws Exception {
		mockMvc.perform(post(REGISTER_URL)
						.contentType(MediaType.APPLICATION_JSON)
						.content("""
								{
								  "email": "worker@example.com",
								  "password": "password123",
								  "firstName": "John",
								  "lastName": "Worker",
								  "role": "WORKER"
								}
								"""))
				.andExpect(status().isCreated());

		MvcResult result = mockMvc.perform(post(LOGIN_URL)
						.contentType(MediaType.APPLICATION_JSON)
						.content("""
								{
								  "email": "worker@example.com",
								  "password": "password123"
								}
								"""))
				.andExpect(status().isOk())
				.andReturn();

		Matcher matcher = ACCESS_TOKEN_PATTERN.matcher(result.getResponse().getContentAsString());
		assertThat(matcher.find()).isTrue();
		return matcher.group(1);
	}
}
