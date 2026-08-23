package com.shiftpay.mvp.controller;

import com.shiftpay.mvp.TestDataCleaner;
import com.shiftpay.mvp.entity.Company;
import com.shiftpay.mvp.entity.Role;
import com.shiftpay.mvp.entity.User;
import com.shiftpay.mvp.repository.CompanyRepository;
import com.shiftpay.mvp.repository.UserRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.MvcResult;

import java.util.regex.Matcher;
import java.util.regex.Pattern;

import static org.assertj.core.api.Assertions.assertThat;
import static org.hamcrest.Matchers.hasSize;
import static org.hamcrest.Matchers.matchesPattern;
import static org.hamcrest.Matchers.nullValue;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/**
 * Controller integration tests for company onboarding endpoints.
 *
 * <p>The class covers foreman company creation, worker company join, one-company MVP rules, unknown code handling,
 * current-user company DTOs, and role restrictions.</p>
 */
@SpringBootTest
@AutoConfigureMockMvc
class CompanyControllerTests {

	private static final String REGISTER_URL = "/api/v1/auth/register";
	private static final String LOGIN_URL = "/api/v1/auth/login";
	private static final String CREATE_COMPANY_URL = "/api/v1/companies";
	private static final String JOIN_COMPANY_URL = "/api/v1/companies/join";
	private static final String CURRENT_USER_URL = "/api/v1/users/me";
	private static final Pattern ACCESS_TOKEN_PATTERN = Pattern.compile("\"accessToken\":\"([^\"]+)\"");
	private static final Pattern JOIN_CODE_PATTERN = Pattern.compile("\"joinCode\":\"([^\"]+)\"");

	@Autowired
	private MockMvc mockMvc;

	@Autowired
	private JdbcTemplate jdbcTemplate;

	@Autowired
	private CompanyRepository companyRepository;

	@Autowired
	private UserRepository userRepository;

	@Autowired
	private PasswordEncoder passwordEncoder;

	/**
	 * Clears persisted data before each company onboarding scenario.
	 */
	@BeforeEach
	void setUp() {
		TestDataCleaner.clean(jdbcTemplate);
	}

	/**
	 * Creates a company as FOREMAN and expects a generated join code plus user assignment.
	 */
	@Test
	void foremanCreatesCompanyAndGetsJoinCode() throws Exception {
		String foremanToken = registerAndLogin("foreman@example.com", "FOREMAN");

		MvcResult result = createCompany(foremanToken, "Acme Construction")
				.andExpect(status().isCreated())
				.andExpect(jsonPath("$.id").isNumber())
				.andExpect(jsonPath("$.name").value("Acme Construction"))
				.andExpect(jsonPath("$.joinCode").value(matchesPattern("[ABCDEFGHJKLMNPQRSTUVWXYZ23456789]{6}")))
				.andExpect(jsonPath("$.*", hasSize(3)))
				.andReturn();

		String joinCode = extractJoinCode(result);
		User foreman = userRepository.findWithCompanyByEmail("foreman@example.com").orElseThrow();
		assertThat(foreman.getCompany()).isNotNull();
		assertThat(foreman.getCompany().getName()).isEqualTo("Acme Construction");
		assertThat(foreman.getCompany().getJoinCode()).isEqualTo(joinCode);
	}

	/**
	 * Attempts a second company creation for the same foreman and expects 409.
	 */
	@Test
	void foremanCannotCreateSecondCompany() throws Exception {
		String foremanToken = registerAndLogin("foreman@example.com", "FOREMAN");
		createCompany(foremanToken, "Acme Construction").andExpect(status().isCreated());

		createCompany(foremanToken, "Second Company")
				.andExpect(status().isConflict())
				.andExpect(jsonPath("$.status").value(409))
				.andExpect(jsonPath("$.error").value("Conflict"))
				.andExpect(jsonPath("$.message").value("Foreman already has a company"))
				.andExpect(jsonPath("$.path").value(CREATE_COMPANY_URL));
	}

	/**
	 * Joins a worker to a company by normalized join code and expects user assignment.
	 */
	@Test
	void workerJoinsCompanyByCode() throws Exception {
		String foremanToken = registerAndLogin("foreman@example.com", "FOREMAN");
		String joinCode = extractJoinCode(createCompany(foremanToken, "Acme Construction").andReturn());
		String workerToken = registerAndLogin("worker@example.com", "WORKER");

		joinCompany(workerToken, "  " + joinCode.toLowerCase() + "  ")
				.andExpect(status().isOk())
				.andExpect(jsonPath("$.id").isNumber())
				.andExpect(jsonPath("$.name").value("Acme Construction"))
				.andExpect(jsonPath("$.joinCode").doesNotExist())
				.andExpect(jsonPath("$.*", hasSize(2)));

		User worker = userRepository.findWithCompanyByEmail("worker@example.com").orElseThrow();
		assertThat(worker.getCompany()).isNotNull();
		assertThat(worker.getCompany().getJoinCode()).isEqualTo(joinCode);
	}

	/**
	 * Attempts a second company join for the same worker and expects 409.
	 */
	@Test
	void workerCannotJoinSecondCompany() throws Exception {
		String firstForemanToken = registerAndLogin("first.foreman@example.com", "FOREMAN");
		String firstJoinCode = extractJoinCode(createCompany(firstForemanToken, "First Company").andReturn());
		String secondForemanToken = registerAndLogin("second.foreman@example.com", "FOREMAN");
		String secondJoinCode = extractJoinCode(createCompany(secondForemanToken, "Second Company").andReturn());
		String workerToken = registerAndLogin("worker@example.com", "WORKER");
		joinCompany(workerToken, firstJoinCode).andExpect(status().isOk());

		joinCompany(workerToken, secondJoinCode)
				.andExpect(status().isConflict())
				.andExpect(jsonPath("$.status").value(409))
				.andExpect(jsonPath("$.error").value("Conflict"))
				.andExpect(jsonPath("$.message").value("Worker already belongs to a company"))
				.andExpect(jsonPath("$.path").value(JOIN_COMPANY_URL));
	}

	/**
	 * Uses an unknown company code and expects 404.
	 */
	@Test
	void unknownCompanyCodeReturnsNotFound() throws Exception {
		String workerToken = registerAndLogin("worker@example.com", "WORKER");

		joinCompany(workerToken, "UNKNOWN")
				.andExpect(status().isNotFound())
				.andExpect(jsonPath("$.status").value(404))
				.andExpect(jsonPath("$.error").value("Not Found"))
				.andExpect(jsonPath("$.message").value("Company not found"))
				.andExpect(jsonPath("$.path").value(JOIN_COMPANY_URL));
	}

	/**
	 * Reads current user before and after assignment and expects company summary fields for mobile.
	 */
	@Test
	void currentUserIncludesCompanyInfoAfterAssignment() throws Exception {
		String foremanToken = registerAndLogin("foreman@example.com", "FOREMAN");

		mockMvc.perform(get(CURRENT_USER_URL)
						.header(HttpHeaders.AUTHORIZATION, "Bearer " + foremanToken))
				.andExpect(status().isOk())
				.andExpect(jsonPath("$.company").value(nullValue()));

		String joinCode = extractJoinCode(createCompany(foremanToken, "Acme Construction").andReturn());
		mockMvc.perform(get(CURRENT_USER_URL)
						.header(HttpHeaders.AUTHORIZATION, "Bearer " + foremanToken))
				.andExpect(status().isOk())
				.andExpect(jsonPath("$.company.id").isNumber())
				.andExpect(jsonPath("$.company.name").value("Acme Construction"))
				.andExpect(jsonPath("$.company.joinCode").value(joinCode));

		String workerToken = registerAndLogin("worker@example.com", "WORKER");
		joinCompany(workerToken, joinCode).andExpect(status().isOk());
		mockMvc.perform(get(CURRENT_USER_URL)
						.header(HttpHeaders.AUTHORIZATION, "Bearer " + workerToken))
				.andExpect(status().isOk())
				.andExpect(jsonPath("$.company.id").isNumber())
				.andExpect(jsonPath("$.company.name").value("Acme Construction"))
				.andExpect(jsonPath("$.company.joinCode").doesNotExist());
	}

	/**
	 * Verifies role restrictions for company onboarding endpoints.
	 */
	@Test
	void roleRestrictionsForCompanyEndpoints() throws Exception {
		String foremanToken = registerAndLogin("foreman@example.com", "FOREMAN");
		String joinCode = extractJoinCode(createCompany(foremanToken, "Acme Construction").andReturn());
		String workerToken = registerAndLogin("worker@example.com", "WORKER");
		String adminToken = createAdminAndLogin();

		createCompany(workerToken, "Worker Company")
				.andExpect(status().isForbidden())
				.andExpect(jsonPath("$.status").value(403))
				.andExpect(jsonPath("$.message").value("Forbidden"))
				.andExpect(jsonPath("$.path").value(CREATE_COMPANY_URL));

		createCompany(adminToken, "Admin Company")
				.andExpect(status().isForbidden())
				.andExpect(jsonPath("$.status").value(403))
				.andExpect(jsonPath("$.message").value("Forbidden"))
				.andExpect(jsonPath("$.path").value(CREATE_COMPANY_URL));

		joinCompany(foremanToken, joinCode)
				.andExpect(status().isForbidden())
				.andExpect(jsonPath("$.status").value(403))
				.andExpect(jsonPath("$.message").value("Forbidden"))
				.andExpect(jsonPath("$.path").value(JOIN_COMPANY_URL));

		joinCompany(adminToken, joinCode)
				.andExpect(status().isForbidden())
				.andExpect(jsonPath("$.status").value(403))
				.andExpect(jsonPath("$.message").value("Forbidden"))
				.andExpect(jsonPath("$.path").value(JOIN_COMPANY_URL));
	}

	/**
	 * Registers a user and returns a JWT.
	 *
	 * @param email email address used for registration and login
	 * @param role role sent to public registration
	 * @return JWT access token
	 */
	private String registerAndLogin(String email, String role) throws Exception {
		mockMvc.perform(post(REGISTER_URL)
						.contentType(MediaType.APPLICATION_JSON)
						.content("""
								{
								  "email": "%s",
								  "password": "password123",
								  "firstName": "Test",
								  "lastName": "User",
								  "role": "%s"
								}
								""".formatted(email, role)))
				.andExpect(status().isCreated());

		return login(email);
	}

	/**
	 * Inserts an ADMIN directly because public registration rejects ADMIN accounts.
	 *
	 * @return JWT access token for the seeded admin
	 */
	private String createAdminAndLogin() throws Exception {
		User admin = new User();
		admin.setEmail("admin@example.com");
		admin.setPasswordHash(passwordEncoder.encode("password123"));
		admin.setFirstName("System");
		admin.setLastName("Admin");
		admin.setRole(Role.ADMIN);
		userRepository.save(admin);

		return login(admin.getEmail());
	}

	/**
	 * Sends the create company request.
	 *
	 * @param accessToken JWT for the caller
	 * @param companyName company name
	 * @return MockMvc result actions
	 */
	private org.springframework.test.web.servlet.ResultActions createCompany(
			String accessToken,
			String companyName
	) throws Exception {
		return mockMvc.perform(post(CREATE_COMPANY_URL)
				.header(HttpHeaders.AUTHORIZATION, "Bearer " + accessToken)
				.contentType(MediaType.APPLICATION_JSON)
				.content("""
						{
						  "name": "%s"
						}
						""".formatted(companyName)));
	}

	/**
	 * Sends the join company request.
	 *
	 * @param accessToken JWT for the caller
	 * @param joinCode company join code
	 * @return MockMvc result actions
	 */
	private org.springframework.test.web.servlet.ResultActions joinCompany(
			String accessToken,
			String joinCode
	) throws Exception {
		return mockMvc.perform(post(JOIN_COMPANY_URL)
				.header(HttpHeaders.AUTHORIZATION, "Bearer " + accessToken)
				.contentType(MediaType.APPLICATION_JSON)
				.content("""
						{
						  "joinCode": "%s"
						}
						""".formatted(joinCode)));
	}

	/**
	 * Logs in an existing user and extracts the access token.
	 *
	 * @param email account email
	 * @return JWT access token
	 */
	private String login(String email) throws Exception {
		MvcResult result = mockMvc.perform(post(LOGIN_URL)
						.contentType(MediaType.APPLICATION_JSON)
						.content("""
								{
								  "email": "%s",
								  "password": "password123"
								}
								""".formatted(email)))
				.andExpect(status().isOk())
				.andReturn();

		Matcher matcher = ACCESS_TOKEN_PATTERN.matcher(result.getResponse().getContentAsString());
		assertThat(matcher.find()).isTrue();
		return matcher.group(1);
	}

	/**
	 * Extracts a company join code from a JSON response.
	 *
	 * @param result MockMvc result containing joinCode
	 * @return join code
	 */
	private String extractJoinCode(MvcResult result) throws Exception {
		Matcher matcher = JOIN_CODE_PATTERN.matcher(result.getResponse().getContentAsString());
		assertThat(matcher.find()).isTrue();
		return matcher.group(1);
	}
}
