package com.shiftpay.mvp.controller;

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
import org.springframework.http.MediaType;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.MvcResult;
import org.springframework.test.web.servlet.ResultActions;

import java.sql.Timestamp;
import java.time.OffsetDateTime;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

import static org.assertj.core.api.Assertions.assertThat;
import static org.hamcrest.Matchers.hasSize;
import static org.hamcrest.Matchers.nullValue;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/**
 * Controller integration tests for the current user's managed-shifts endpoint.
 *
 * <p>The class covers FOREMAN and ADMIN creator-owned shift listing, WORKER denial, JWT failures, response DTO safety,
 * and stable newest-first ordering for the Foreman mobile dashboard.</p>
 */
@SpringBootTest
@AutoConfigureMockMvc
class ManagedShiftControllerTests {

	private static final String REGISTER_URL = "/api/v1/auth/register";
	private static final String LOGIN_URL = "/api/v1/auth/login";
	private static final String CREATE_SHIFT_URL = "/api/v1/shifts";
	private static final String MANAGED_SHIFTS_URL = "/api/v1/me/managed-shifts";
	private static final Pattern ACCESS_TOKEN_PATTERN = Pattern.compile("\"accessToken\":\"([^\"]+)\"");
	private static final Pattern SHIFT_ID_PATTERN = Pattern.compile("\"id\":(\\d+)");

	@Autowired
	private MockMvc mockMvc;

	@Autowired
	private JdbcTemplate jdbcTemplate;

	@Autowired
	private UserRepository userRepository;

	@Autowired
	private PasswordEncoder passwordEncoder;

	/**
	 * Clears test data before each managed-shift scenario so creator filtering and ordering are deterministic.
	 */
	@BeforeEach
	void setUp() {
		TestDataCleaner.clean(jdbcTemplate);
	}

	/**
	 * Creates two shifts as the same FOREMAN and expects both to appear in the current user's managed-shifts list.
	 */
	@Test
	void foremanSeesOwnManagedShifts() throws Exception {
		String foremanToken = registerAndLogin("foreman@example.com", "FOREMAN");
		long firstShiftId = createShift(foremanToken, "First managed shift");
		long secondShiftId = createShift(foremanToken, "Second managed shift");

		getManagedShifts(foremanToken)
				.andExpect(status().isOk())
				.andExpect(jsonPath("$", hasSize(2)))
				.andExpect(jsonPath("$[0].id").value(secondShiftId))
				.andExpect(jsonPath("$[0].title").value("Second managed shift"))
				.andExpect(jsonPath("$[0].status").value("OPEN"))
				.andExpect(jsonPath("$[1].id").value(firstShiftId))
				.andExpect(jsonPath("$[1].title").value("First managed shift"));
	}

	/**
	 * Creates shifts by two different FOREMEN and expects each caller to see only their own created shift.
	 */
	@Test
	void foremanDoesNotSeeAnotherForemansManagedShifts() throws Exception {
		String ownerToken = registerAndLogin("owner@example.com", "FOREMAN");
		String anotherForemanToken = registerAndLogin("another@example.com", "FOREMAN");
		long ownerShiftId = createShift(ownerToken, "Owner shift");
		long anotherShiftId = createShift(anotherForemanToken, "Another foreman shift");

		getManagedShifts(ownerToken)
				.andExpect(status().isOk())
				.andExpect(jsonPath("$", hasSize(1)))
				.andExpect(jsonPath("$[0].id").value(ownerShiftId))
				.andExpect(jsonPath("$[?(@.id == %d)]".formatted(anotherShiftId)).isEmpty());
	}

	/**
	 * Uses an ADMIN-created shift and a FOREMAN-created shift to document the MVP admin behavior: admins see only
	 * shifts they created through this endpoint.
	 */
	@Test
	void adminSeesOnlyOwnCreatedManagedShiftsForMvp() throws Exception {
		String foremanToken = registerAndLogin("foreman@example.com", "FOREMAN");
		long foremanShiftId = createShift(foremanToken, "Foreman shift");
		String adminToken = createAdminAndLogin();
		long adminShiftId = createShift(adminToken, "Admin shift");

		getManagedShifts(adminToken)
				.andExpect(status().isOk())
				.andExpect(jsonPath("$", hasSize(1)))
				.andExpect(jsonPath("$[0].id").value(adminShiftId))
				.andExpect(jsonPath("$[0].title").value("Admin shift"))
				.andExpect(jsonPath("$[?(@.id == %d)]".formatted(foremanShiftId)).isEmpty());
	}

	/**
	 * Calls the foreman/admin dashboard endpoint as WORKER and expects role authorization to return 403.
	 */
	@Test
	void workerCannotGetManagedShifts() throws Exception {
		String workerToken = registerAndLogin("worker@example.com", "WORKER");

		getManagedShifts(workerToken)
				.andExpect(status().isForbidden())
				.andExpect(jsonPath("$.status").value(403))
				.andExpect(jsonPath("$.error").value("Forbidden"))
				.andExpect(jsonPath("$.message").value("Forbidden"))
				.andExpect(jsonPath("$.path").value(MANAGED_SHIFTS_URL));
	}

	/**
	 * Calls managed shifts without JWT and expects the standard 401 error body.
	 */
	@Test
	void missingTokenCannotGetManagedShifts() throws Exception {
		mockMvc.perform(get(MANAGED_SHIFTS_URL))
				.andExpect(status().isUnauthorized())
				.andExpect(jsonPath("$.status").value(401))
				.andExpect(jsonPath("$.error").value("Unauthorized"))
				.andExpect(jsonPath("$.message").value("Unauthorized"))
				.andExpect(jsonPath("$.path").value(MANAGED_SHIFTS_URL));
	}

	/**
	 * Calls managed shifts with a malformed JWT and expects token validation to return 401.
	 */
	@Test
	void invalidTokenCannotGetManagedShifts() throws Exception {
		mockMvc.perform(get(MANAGED_SHIFTS_URL)
						.header(HttpHeaders.AUTHORIZATION, "Bearer invalid-token"))
				.andExpect(status().isUnauthorized())
				.andExpect(jsonPath("$.status").value(401))
				.andExpect(jsonPath("$.error").value("Unauthorized"))
				.andExpect(jsonPath("$.message").value("Unauthorized"))
				.andExpect(jsonPath("$.path").value(MANAGED_SHIFTS_URL));
	}

	/**
	 * Reads a managed shift and verifies the response uses the public shift DTO without entities, password data, or
	 * persistence audit fields.
	 */
	@Test
	void managedShiftResponseDoesNotExposeEntityOrInternalFields() throws Exception {
		String foremanToken = registerAndLogin("foreman@example.com", "FOREMAN");
		long shiftId = createShift(foremanToken, "Safe response shift");

		getManagedShifts(foremanToken)
				.andExpect(status().isOk())
				.andExpect(jsonPath("$", hasSize(1)))
				.andExpect(jsonPath("$[0].id").value(shiftId))
				.andExpect(jsonPath("$[0].title").value("Safe response shift"))
				.andExpect(jsonPath("$[0].location").value("Cologne"))
				.andExpect(jsonPath("$[0].joinCode").isString())
				.andExpect(jsonPath("$[0].plannedStartTime").value("2026-07-01T08:00:00Z"))
				.andExpect(jsonPath("$[0].plannedEndTime").value("2026-07-01T17:00:00Z"))
				.andExpect(jsonPath("$[0].actualStartTime").value(nullValue()))
				.andExpect(jsonPath("$[0].actualEndTime").value(nullValue()))
				.andExpect(jsonPath("$[0].defaultBreakMinutes").value(60))
				.andExpect(jsonPath("$[0].defaultHourlyRate").value(15.25))
				.andExpect(jsonPath("$[0].createdBy").isNumber())
				.andExpect(jsonPath("$[0].*", hasSize(12)))
				.andExpect(jsonPath("$[0].company").doesNotExist())
				.andExpect(jsonPath("$[0].createdByUser").doesNotExist())
				.andExpect(jsonPath("$[0].createdAt").doesNotExist())
				.andExpect(jsonPath("$[0].updatedAt").doesNotExist())
				.andExpect(jsonPath("$[0].password").doesNotExist())
				.andExpect(jsonPath("$[0].passwordHash").doesNotExist())
				.andExpect(jsonPath("$[0].user").doesNotExist());
	}

	/**
	 * Forces identical createdAt values for two shifts and expects ordering by createdAt descending, then id
	 * descending.
	 */
	@Test
	void managedShiftsSortByCreatedAtDescendingThenIdDescending() throws Exception {
		String foremanToken = registerAndLogin("foreman@example.com", "FOREMAN");
		long olderShiftId = createShift(foremanToken, "Older shift");
		long firstTieShiftId = createShift(foremanToken, "First tied shift");
		long secondTieShiftId = createShift(foremanToken, "Second tied shift");
		setCreatedAt(olderShiftId, OffsetDateTime.parse("2026-07-01T08:00:00Z"));
		setCreatedAt(firstTieShiftId, OffsetDateTime.parse("2026-07-02T08:00:00Z"));
		setCreatedAt(secondTieShiftId, OffsetDateTime.parse("2026-07-02T08:00:00Z"));

		getManagedShifts(foremanToken)
				.andExpect(status().isOk())
				.andExpect(jsonPath("$", hasSize(3)))
				.andExpect(jsonPath("$[0].id").value(secondTieShiftId))
				.andExpect(jsonPath("$[1].id").value(firstTieShiftId))
				.andExpect(jsonPath("$[2].id").value(olderShiftId));
	}

	/**
	 * Registers a user and returns a JWT for endpoint calls.
	 *
	 * @param email email address for registration and login
	 * @param role role accepted by public registration
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
	 * Inserts an ADMIN directly because public registration intentionally rejects ADMIN accounts.
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
	 * Logs in an existing user and extracts the access token from the JSON response.
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

		return extractString(result.getResponse().getContentAsString(), ACCESS_TOKEN_PATTERN);
	}

	/**
	 * Creates a shift through the REST API and returns the generated id.
	 *
	 * @param accessToken JWT for a FOREMAN or ADMIN
	 * @param title shift title
	 * @return created shift id
	 */
	private long createShift(String accessToken, String title) throws Exception {
		MvcResult result = mockMvc.perform(post(CREATE_SHIFT_URL)
						.header(HttpHeaders.AUTHORIZATION, "Bearer " + accessToken)
						.contentType(MediaType.APPLICATION_JSON)
						.content("""
								{
								  "title": "%s",
								  "location": "Cologne",
								  "plannedStartTime": "2026-07-01T08:00:00",
								  "plannedEndTime": "2026-07-01T17:00:00",
								  "defaultBreakMinutes": 60,
								  "defaultHourlyRate": 15.25
								}
								""".formatted(title)))
				.andExpect(status().isCreated())
				.andReturn();

		return extractLong(result.getResponse().getContentAsString(), SHIFT_ID_PATTERN);
	}

	/**
	 * Sends the managed-shifts request as the supplied caller.
	 *
	 * @param accessToken JWT for the caller
	 * @return MockMvc result actions for assertions
	 */
	private ResultActions getManagedShifts(String accessToken) throws Exception {
		return mockMvc.perform(get(MANAGED_SHIFTS_URL)
				.header(HttpHeaders.AUTHORIZATION, "Bearer " + accessToken));
	}

	/**
	 * Updates audit timestamps directly so sorting tests can control createdAt ordering.
	 *
	 * @param shiftId shift to update
	 * @param createdAt timestamp to store in created_at and updated_at
	 */
	private void setCreatedAt(long shiftId, OffsetDateTime createdAt) {
		Timestamp timestamp = Timestamp.from(createdAt.toInstant());
		jdbcTemplate.update(
				"update shift_sessions set created_at = ?, updated_at = ? where id = ?",
				timestamp,
				timestamp,
				shiftId
		);
	}

	/**
	 * Extracts a long value from a JSON response using a focused regex.
	 *
	 * @param response response body
	 * @param pattern regex with the number in group one
	 * @return parsed long value
	 */
	private long extractLong(String response, Pattern pattern) {
		return Long.parseLong(extractString(response, pattern));
	}

	/**
	 * Extracts a string value from a JSON response using a focused regex.
	 *
	 * @param response response body
	 * @param pattern regex with the value in group one
	 * @return extracted value
	 */
	private String extractString(String response, Pattern pattern) {
		Matcher matcher = pattern.matcher(response);
		assertThat(matcher.find()).isTrue();
		return matcher.group(1);
	}
}
