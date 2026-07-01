package com.shiftpay.mvp.controller;

import com.shiftpay.mvp.entity.User;
import com.shiftpay.mvp.repository.UserRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.http.MediaType;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.test.web.servlet.MockMvc;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@SpringBootTest
@AutoConfigureMockMvc
class AuthControllerTests {

	private static final String REGISTER_URL = "/api/v1/auth/register";

	@Autowired
	private MockMvc mockMvc;

	@Autowired
	private UserRepository userRepository;

	@Autowired
	private PasswordEncoder passwordEncoder;

	@BeforeEach
	void setUp() {
		userRepository.deleteAll();
	}

	@Test
	void successfulRegistrationReturnsUserWithoutPassword() throws Exception {
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
}
