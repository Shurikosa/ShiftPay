package com.shiftpay.mvp.controller;

import com.shiftpay.mvp.TestDataCleaner;
import com.shiftpay.mvp.entity.User;
import com.shiftpay.mvp.repository.UserRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.http.MediaType;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.MvcResult;
import org.springframework.test.web.servlet.ResultActions;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@SpringBootTest
@AutoConfigureMockMvc
class AuthControllerTests {

	private static final String REGISTER_URL = "/api/v1/auth/register";
	private static final String LOGIN_URL = "/api/v1/auth/login";

	@Autowired
	private MockMvc mockMvc;

	@Autowired
	private UserRepository userRepository;

	@Autowired
	private PasswordEncoder passwordEncoder;

	@Autowired
	private JdbcTemplate jdbcTemplate;

	@BeforeEach
	void setUp() {
		TestDataCleaner.clean(jdbcTemplate);
	}

	@Test
	void workerRegistrationSucceedsWithoutExposingPassword() throws Exception {
		mockMvc.perform(post(REGISTER_URL)
						.contentType(MediaType.APPLICATION_JSON)
						.content("""
								{
								  "email": "Worker@example.com",
								  "password": "password123",
								  "firstName": "John",
								  "lastName": "Worker",
								  "role": "WORKER"
								}
								"""))
				.andExpect(status().isCreated())
				.andExpect(jsonPath("$.id").isNumber())
				.andExpect(jsonPath("$.email").value("worker@example.com"))
				.andExpect(jsonPath("$.firstName").value("John"))
				.andExpect(jsonPath("$.lastName").value("Worker"))
				.andExpect(jsonPath("$.role").value("WORKER"))
				.andExpect(jsonPath("$.password").doesNotExist())
				.andExpect(jsonPath("$.passwordHash").doesNotExist());
	}

	@Test
	void foremanRegistrationSucceeds() throws Exception {
		mockMvc.perform(post(REGISTER_URL)
						.contentType(MediaType.APPLICATION_JSON)
						.content("""
								{
								  "email": "foreman@example.com",
								  "password": "password123",
								  "firstName": "Jane",
								  "lastName": "Foreman",
								  "role": "FOREMAN"
								}
								"""))
				.andExpect(status().isCreated())
				.andExpect(jsonPath("$.email").value("foreman@example.com"))
				.andExpect(jsonPath("$.role").value("FOREMAN"));
	}

	@Test
	void adminRegistrationReturnsBadRequest() throws Exception {
		registerAdmin()
				.andExpect(status().isBadRequest())
				.andExpect(jsonPath("$.status").value(400))
				.andExpect(jsonPath("$.error").value("Bad Request"))
				.andExpect(jsonPath("$.message").value("Public registration supports only WORKER and FOREMAN"))
				.andExpect(jsonPath("$.path").value(REGISTER_URL));
	}

	@Test
	void rejectedAdminUserIsNotPersisted() throws Exception {
		registerAdmin().andExpect(status().isBadRequest());

		assertThat(userRepository.findByEmail("admin@example.com")).isEmpty();
	}

	@Test
	void passwordIsStoredHashedNotPlainText() throws Exception {
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

		User user = userRepository.findByEmail("worker@example.com").orElseThrow();

		assertThat(user.getPasswordHash()).isNotEqualTo("password123");
		assertThat(passwordEncoder.matches("password123", user.getPasswordHash())).isTrue();
	}

	@Test
	void duplicateEmailReturnsConflict() throws Exception {
		String payload = """
				{
				  "email": "worker@example.com",
				  "password": "password123",
				  "firstName": "John",
				  "lastName": "Worker",
				  "role": "WORKER"
				}
				""";
		String duplicatePayload = """
				{
				  "email": "WORKER@example.com",
				  "password": "password123",
				  "firstName": "John",
				  "lastName": "Worker",
				  "role": "WORKER"
				}
				""";

		mockMvc.perform(post(REGISTER_URL)
						.contentType(MediaType.APPLICATION_JSON)
						.content(duplicatePayload))
				.andExpect(status().isCreated());

		mockMvc.perform(post(REGISTER_URL)
						.contentType(MediaType.APPLICATION_JSON)
						.content(payload))
				.andExpect(status().isConflict())
				.andExpect(jsonPath("$.status").value(409))
				.andExpect(jsonPath("$.error").value("Conflict"))
				.andExpect(jsonPath("$.message").value("User with email already exists: worker@example.com"))
				.andExpect(jsonPath("$.path").value(REGISTER_URL));
	}

	@Test
	void invalidRequestReturnsBadRequest() throws Exception {
		mockMvc.perform(post(REGISTER_URL)
						.contentType(MediaType.APPLICATION_JSON)
						.content("""
								{
								  "email": "not-an-email",
								  "password": "short",
								  "firstName": "",
								  "lastName": "Worker",
								  "role": "WORKER"
								}
								"""))
				.andExpect(status().isBadRequest())
				.andExpect(jsonPath("$.status").value(400))
				.andExpect(jsonPath("$.error").value("Bad Request"))
				.andExpect(jsonPath("$.path").value(REGISTER_URL));
	}

	@Test
	void successfulLoginReturnsBearerTokenAndUser() throws Exception {
		registerWorker();

		MvcResult result = mockMvc.perform(post(LOGIN_URL)
						.contentType(MediaType.APPLICATION_JSON)
						.content("""
								{
								  "email": "WORKER@example.com",
								  "password": "password123"
								}
								"""))
				.andExpect(status().isOk())
				.andExpect(jsonPath("$.tokenType").value("Bearer"))
				.andExpect(jsonPath("$.user.id").isNumber())
				.andExpect(jsonPath("$.user.email").value("worker@example.com"))
				.andExpect(jsonPath("$.user.firstName").value("John"))
				.andExpect(jsonPath("$.user.lastName").value("Worker"))
				.andExpect(jsonPath("$.user.role").value("WORKER"))
				.andExpect(jsonPath("$.user.password").doesNotExist())
				.andExpect(jsonPath("$.user.passwordHash").doesNotExist())
				.andReturn();

		assertThat(result.getResponse().getContentAsString())
				.contains("\"tokenType\":\"Bearer\"")
				.containsPattern("\"accessToken\":\"[A-Za-z0-9_-]+\\.[A-Za-z0-9_-]+\\.[A-Za-z0-9_-]+\"");
	}

	@Test
	void wrongPasswordReturnsUnauthorized() throws Exception {
		registerWorker();

		mockMvc.perform(post(LOGIN_URL)
						.contentType(MediaType.APPLICATION_JSON)
						.content("""
								{
								  "email": "worker@example.com",
								  "password": "wrong-password"
								}
								"""))
				.andExpect(status().isUnauthorized())
				.andExpect(jsonPath("$.status").value(401))
				.andExpect(jsonPath("$.error").value("Unauthorized"))
				.andExpect(jsonPath("$.message").value("Invalid email or password"))
				.andExpect(jsonPath("$.path").value(LOGIN_URL));
	}

	@Test
	void unknownEmailReturnsUnauthorized() throws Exception {
		mockMvc.perform(post(LOGIN_URL)
						.contentType(MediaType.APPLICATION_JSON)
						.content("""
								{
								  "email": "unknown@example.com",
								  "password": "password123"
								}
								"""))
				.andExpect(status().isUnauthorized())
				.andExpect(jsonPath("$.status").value(401))
				.andExpect(jsonPath("$.error").value("Unauthorized"))
				.andExpect(jsonPath("$.message").value("Invalid email or password"))
				.andExpect(jsonPath("$.path").value(LOGIN_URL));
	}

	@Test
	void loginValidationReturnsBadRequest() throws Exception {
		mockMvc.perform(post(LOGIN_URL)
						.contentType(MediaType.APPLICATION_JSON)
						.content("""
								{
								  "email": "not-an-email",
								  "password": ""
								}
								"""))
				.andExpect(status().isBadRequest())
				.andExpect(jsonPath("$.status").value(400))
				.andExpect(jsonPath("$.error").value("Bad Request"))
				.andExpect(jsonPath("$.path").value(LOGIN_URL));
	}

	private void registerWorker() throws Exception {
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
	}

	private ResultActions registerAdmin() throws Exception {
		return mockMvc.perform(post(REGISTER_URL)
				.contentType(MediaType.APPLICATION_JSON)
				.content("""
						{
						  "email": "admin@example.com",
						  "password": "password123",
						  "firstName": "System",
						  "lastName": "Admin",
						  "role": "ADMIN"
						}
						"""));
	}
}
