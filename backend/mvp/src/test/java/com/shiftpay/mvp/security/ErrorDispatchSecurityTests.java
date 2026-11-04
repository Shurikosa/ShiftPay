package com.shiftpay.mvp.security;

import com.shiftpay.mvp.entity.Role;
import com.shiftpay.mvp.entity.User;
import com.shiftpay.mvp.repository.UserRepository;
import jakarta.servlet.DispatcherType;
import jakarta.servlet.RequestDispatcher;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.context.TestConfiguration;
import org.springframework.boot.test.web.server.LocalServerPort;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Import;
import org.springframework.dao.InvalidDataAccessResourceUsageException;
import org.springframework.http.HttpHeaders;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RestController;

import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.time.Duration;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT)
@AutoConfigureMockMvc
@Import(ErrorDispatchSecurityTests.FailureEndpointConfiguration.class)
class ErrorDispatchSecurityTests {

	@Autowired MockMvc mockMvc;
	@Autowired UserRepository userRepository;
	@Autowired PasswordEncoder passwordEncoder;
	@Autowired JwtService jwtService;
	@LocalServerPort int port;

	@Test
	void unauthenticatedBusinessRequestAndDirectErrorRequestStillReturnUnauthorized() throws Exception {
		mockMvc.perform(get("/api/v1/me/shifts/page").param("limit", "5"))
				.andExpect(status().isUnauthorized());
		mockMvc.perform(get("/error"))
				.andExpect(status().isUnauthorized());
	}

	@Test
	void internalFailureErrorDispatchKeepsServerStatusWithoutSqlDetails() throws Exception {
		var result = mockMvc.perform(get("/error").with(request -> {
			request.setDispatcherType(DispatcherType.ERROR);
			request.setAttribute(RequestDispatcher.ERROR_STATUS_CODE, 500);
			request.setAttribute(RequestDispatcher.ERROR_REQUEST_URI, "/api/v1/me/shifts/page");
			request.setAttribute(RequestDispatcher.ERROR_EXCEPTION,
					new IllegalStateException("SQLState 42P18: private SQL detail"));
			return request;
		})).andExpect(status().isInternalServerError()).andReturn();

		assertThat(result.getResponse().getContentAsString())
				.contains("500")
				.doesNotContain("42P18", "private SQL detail");
	}

	@Test
	void errorDispatchToProtectedBusinessPathDoesNotBypassAuthentication() throws Exception {
		mockMvc.perform(get("/api/v1/me/shifts/page").param("limit", "5").with(request -> {
			request.setDispatcherType(DispatcherType.ERROR);
			request.setAttribute(RequestDispatcher.ERROR_STATUS_CODE, 500);
			request.setAttribute(RequestDispatcher.ERROR_REQUEST_URI, "/api/v1/me/shifts/page");
			return request;
		})).andExpect(status().isUnauthorized());
	}

	@Test
	void realHttpInternalDatabaseFailureReturns500WhileAuthBoundariesRemain() throws Exception {
		User user = new User();
		user.setEmail("error.dispatch.worker@example.com");
		user.setPasswordHash(passwordEncoder.encode("password123"));
		user.setFirstName("Error");
		user.setLastName("Dispatch");
		user.setRole(Role.WORKER);
		user = userRepository.saveAndFlush(user);
		String token = jwtService.generateAccessToken(user);
		try (HttpClient client = HttpClient.newHttpClient()) {
			HttpResponse<String> failure = send(client, "/api/v1/test-only/internal-db-failure", token);
			assertThat(failure.statusCode()).isEqualTo(500);
			assertThat(failure.body()).doesNotContain("42P18", "private SQL detail");

			assertThat(send(client, "/api/v1/test-only/internal-db-failure", null).statusCode())
					.isEqualTo(401);
			assertThat(send(client, "/api/v1/me/managed-shifts/page?limit=5", token).statusCode())
					.isEqualTo(403);
		}
	}

	private HttpResponse<String> send(HttpClient client, String path, String token) throws Exception {
		HttpRequest.Builder builder = HttpRequest.newBuilder(URI.create("http://localhost:" + port + path))
				.timeout(Duration.ofSeconds(10)).GET();
		if (token != null) {
			builder.header(HttpHeaders.AUTHORIZATION, "Bearer " + token);
		}
		return client.send(builder.build(), HttpResponse.BodyHandlers.ofString());
	}

	@TestConfiguration(proxyBeanMethods = false)
	static class FailureEndpointConfiguration {
		@Bean
		SimulatedDatabaseFailureController simulatedDatabaseFailureController() {
			return new SimulatedDatabaseFailureController();
		}
	}

	@RestController
	static class SimulatedDatabaseFailureController {
		@GetMapping("/api/v1/test-only/internal-db-failure")
		void fail() {
			throw new InvalidDataAccessResourceUsageException("SQLState 42P18: private SQL detail");
		}
	}
}
