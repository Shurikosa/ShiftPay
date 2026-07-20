package com.shiftpay.mvp.controller;

import com.shiftpay.mvp.TestDataCleaner;
import com.shiftpay.mvp.entity.AttendanceStatus;
import com.shiftpay.mvp.entity.Role;
import com.shiftpay.mvp.entity.ShiftAttendance;
import com.shiftpay.mvp.entity.ShiftSession;
import com.shiftpay.mvp.entity.ShiftStatus;
import com.shiftpay.mvp.entity.User;
import com.shiftpay.mvp.repository.ShiftAttendanceRepository;
import com.shiftpay.mvp.repository.ShiftSessionRepository;
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

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.Duration;
import java.time.OffsetDateTime;
import java.time.ZoneOffset;
import java.util.HashSet;
import java.util.Set;
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
 * Controller integration tests for shift session endpoints.
 *
 * <p>The class covers create, get, start, close, and summary APIs with MockMvc. It verifies role access,
 * foreman ownership, shift lifecycle conflicts, salary persistence on close, summary response rules, and DTO fields
 * that must not expose entities or internal timestamps.</p>
 */
@SpringBootTest
@AutoConfigureMockMvc
class ShiftSessionControllerTests {

	private static final String REGISTER_URL = "/api/v1/auth/register";
	private static final String LOGIN_URL = "/api/v1/auth/login";
	private static final String CREATE_SHIFT_URL = "/api/v1/shifts";
	private static final String JOIN_SHIFT_URL = "/api/v1/shifts/join";
	private static final Pattern ACCESS_TOKEN_PATTERN = Pattern.compile("\"accessToken\":\"([^\"]+)\"");
	private static final Pattern SHIFT_ID_PATTERN = Pattern.compile("\"id\":(\\d+)");
	private static final Pattern JOIN_CODE_PATTERN = Pattern.compile("\"joinCode\":\"([^\"]+)\"");
	private static final Pattern ATTENDANCE_ID_PATTERN = Pattern.compile("\"attendanceId\":(\\d+)");

	@Autowired
	private MockMvc mockMvc;

	@Autowired
	private JdbcTemplate jdbcTemplate;

	@Autowired
	private ShiftAttendanceRepository shiftAttendanceRepository;

	@Autowired
	private ShiftSessionRepository shiftSessionRepository;

	@Autowired
	private UserRepository userRepository;

	@Autowired
	private PasswordEncoder passwordEncoder;

	/**
	 * Clears data before each API scenario so generated ids, join codes, and ownership checks do not leak between
	 * tests.
	 */
	@BeforeEach
	void setUp() {
		TestDataCleaner.clean(jdbcTemplate);
	}

	/**
	 * Creates a shift as a FOREMAN and expects an OPEN shift with the requested default hourly rate persisted.
	 */
	@Test
	void foremanCanCreateShift() throws Exception {
		String accessToken = registerAndLogin("foreman@example.com", "FOREMAN");

		mockMvc.perform(post(CREATE_SHIFT_URL)
						.header(HttpHeaders.AUTHORIZATION, "Bearer " + accessToken)
						.contentType(MediaType.APPLICATION_JSON)
						.content(validCreateShiftPayload("Foreman shift")))
				.andExpect(status().isCreated())
				.andExpect(jsonPath("$.id").isNumber())
				.andExpect(jsonPath("$.title").value("Foreman shift"))
				.andExpect(jsonPath("$.joinCode").isString())
				.andExpect(jsonPath("$.status").value("OPEN"))
				.andExpect(jsonPath("$.defaultHourlyRate").value(15.25))
				.andExpect(jsonPath("$.createdBy").isNumber());

		assertThat(shiftSessionRepository.count()).isEqualTo(1);
		assertThat(shiftSessionRepository.findAll().getFirst().getDefaultHourlyRate())
				.isEqualByComparingTo("15.25");
	}

	/**
	 * Creates a shift as an ADMIN, which is allowed to manage any shift in the MVP contract.
	 */
	@Test
	void adminCanCreateShift() throws Exception {
		String accessToken = createAdminAndLogin();

		mockMvc.perform(post(CREATE_SHIFT_URL)
						.header(HttpHeaders.AUTHORIZATION, "Bearer " + accessToken)
						.contentType(MediaType.APPLICATION_JSON)
						.content(validCreateShiftPayload("Admin shift")))
				.andExpect(status().isCreated())
				.andExpect(jsonPath("$.title").value("Admin shift"))
				.andExpect(jsonPath("$.status").value("OPEN"))
				.andExpect(jsonPath("$.defaultHourlyRate").value(15.25));
	}

	/**
	 * Attempts shift creation as a WORKER and expects role-based authorization to return 403.
	 */
	@Test
	void workerCannotCreateShift() throws Exception {
		String accessToken = registerAndLogin("worker@example.com", "WORKER");

		mockMvc.perform(post(CREATE_SHIFT_URL)
						.header(HttpHeaders.AUTHORIZATION, "Bearer " + accessToken)
						.contentType(MediaType.APPLICATION_JSON)
						.content(validCreateShiftPayload("Worker shift")))
				.andExpect(status().isForbidden())
				.andExpect(jsonPath("$.status").value(403))
				.andExpect(jsonPath("$.error").value("Forbidden"))
				.andExpect(jsonPath("$.message").value("Forbidden"))
				.andExpect(jsonPath("$.path").value(CREATE_SHIFT_URL));
	}

	/**
	 * Calls the protected create endpoint without JWT and expects the shared 401 error response.
	 */
	@Test
	void missingTokenReturnsUnauthorized() throws Exception {
		mockMvc.perform(post(CREATE_SHIFT_URL)
						.contentType(MediaType.APPLICATION_JSON)
						.content(validCreateShiftPayload("Missing token shift")))
				.andExpect(status().isUnauthorized())
				.andExpect(jsonPath("$.status").value(401))
				.andExpect(jsonPath("$.error").value("Unauthorized"))
				.andExpect(jsonPath("$.message").value("Unauthorized"))
				.andExpect(jsonPath("$.path").value(CREATE_SHIFT_URL));
	}

	/**
	 * Sends a negative default break value and expects request validation to reject the create request.
	 */
	@Test
	void invalidBreakMinutesReturnsBadRequest() throws Exception {
		String accessToken = registerAndLogin("foreman@example.com", "FOREMAN");

		mockMvc.perform(post(CREATE_SHIFT_URL)
						.header(HttpHeaders.AUTHORIZATION, "Bearer " + accessToken)
						.contentType(MediaType.APPLICATION_JSON)
						.content("""
								{
								  "title": "Invalid break shift",
								  "location": "Cologne",
								  "plannedStartTime": "2026-07-01T08:00:00",
								  "plannedEndTime": "2026-07-01T17:00:00",
								  "defaultBreakMinutes": -1,
								  "defaultHourlyRate": 15.25
								}
								"""))
				.andExpect(status().isBadRequest())
				.andExpect(jsonPath("$.status").value(400))
				.andExpect(jsonPath("$.error").value("Bad Request"))
				.andExpect(jsonPath("$.path").value(CREATE_SHIFT_URL));
	}

	/**
	 * Sends planned end before planned start and expects the service business validation message.
	 */
	@Test
	void invalidPlannedTimeOrderReturnsBadRequest() throws Exception {
		String accessToken = registerAndLogin("foreman@example.com", "FOREMAN");

		mockMvc.perform(post(CREATE_SHIFT_URL)
						.header(HttpHeaders.AUTHORIZATION, "Bearer " + accessToken)
						.contentType(MediaType.APPLICATION_JSON)
						.content("""
								{
								  "title": "Invalid time shift",
								  "location": "Cologne",
								  "plannedStartTime": "2026-07-01T17:00:00",
								  "plannedEndTime": "2026-07-01T08:00:00",
								  "defaultBreakMinutes": 60,
								  "defaultHourlyRate": 15.25
								}
								"""))
				.andExpect(status().isBadRequest())
				.andExpect(jsonPath("$.status").value(400))
				.andExpect(jsonPath("$.error").value("Bad Request"))
				.andExpect(jsonPath("$.message").value("plannedEndTime must be after plannedStartTime"))
				.andExpect(jsonPath("$.path").value(CREATE_SHIFT_URL));
	}

	/**
	 * Creates several shifts and checks each generated join code is six characters and unique within the sample.
	 */
	@Test
	void joinCodeGeneratedAndUniqueForTestedCases() throws Exception {
		String accessToken = registerAndLogin("foreman@example.com", "FOREMAN");
		Set<String> joinCodes = new HashSet<>();

		for (int index = 0; index < 5; index++) {
			MvcResult result = mockMvc.perform(post(CREATE_SHIFT_URL)
							.header(HttpHeaders.AUTHORIZATION, "Bearer " + accessToken)
							.contentType(MediaType.APPLICATION_JSON)
							.content(validCreateShiftPayload("Shift " + index)))
					.andExpect(status().isCreated())
					.andExpect(jsonPath("$.joinCode").isString())
					.andReturn();

			String joinCode = extractJoinCode(result);
			assertThat(joinCode).hasSize(6);
			assertThat(joinCodes.add(joinCode)).isTrue();
		}
	}

	/**
	 * Reads a shift as its creator FOREMAN and verifies public shift fields while internal entity fields are hidden.
	 */
	@Test
	void ownerForemanGetsShift() throws Exception {
		String accessToken = registerAndLogin("owner@example.com", "FOREMAN");
		long shiftId = createShift(accessToken, "Owner shift");

		mockMvc.perform(get(shiftUrl(shiftId))
						.header(HttpHeaders.AUTHORIZATION, "Bearer " + accessToken))
				.andExpect(status().isOk())
				.andExpect(jsonPath("$.id").value(shiftId))
				.andExpect(jsonPath("$.title").value("Owner shift"))
				.andExpect(jsonPath("$.location").value("Cologne"))
				.andExpect(jsonPath("$.status").value("OPEN"))
				.andExpect(jsonPath("$.joinCode").isString())
				.andExpect(jsonPath("$.plannedStartTime").value("2026-07-01T08:00:00Z"))
				.andExpect(jsonPath("$.plannedEndTime").value("2026-07-01T17:00:00Z"))
				.andExpect(jsonPath("$.actualStartTime").value(nullValue()))
				.andExpect(jsonPath("$.actualEndTime").value(nullValue()))
				.andExpect(jsonPath("$.defaultBreakMinutes").value(60))
				.andExpect(jsonPath("$.defaultHourlyRate").value(15.25))
				.andExpect(jsonPath("$.createdBy").isNumber())
				.andExpect(jsonPath("$.*", hasSize(12)))
				.andExpect(jsonPath("$.company").doesNotExist())
				.andExpect(jsonPath("$.createdAt").doesNotExist())
				.andExpect(jsonPath("$.updatedAt").doesNotExist());
	}

	/**
	 * Tries to read a shift as a different FOREMAN and expects owner-only access to return 403.
	 */
	@Test
	void anotherForemanGetsForbidden() throws Exception {
		String ownerToken = registerAndLogin("owner@example.com", "FOREMAN");
		long shiftId = createShift(ownerToken, "Owner shift");
		String anotherForemanToken = registerAndLogin("another@example.com", "FOREMAN");

		mockMvc.perform(get(shiftUrl(shiftId))
						.header(HttpHeaders.AUTHORIZATION, "Bearer " + anotherForemanToken))
				.andExpect(status().isForbidden())
				.andExpect(jsonPath("$.status").value(403))
				.andExpect(jsonPath("$.error").value("Forbidden"))
				.andExpect(jsonPath("$.message").value("Forbidden"))
				.andExpect(jsonPath("$.path").value(shiftUrl(shiftId)));
	}

	/**
	 * Reads a foreman-created shift as ADMIN and expects cross-shift admin access to succeed.
	 */
	@Test
	void adminGetsAnyShift() throws Exception {
		String foremanToken = registerAndLogin("foreman@example.com", "FOREMAN");
		long shiftId = createShift(foremanToken, "Foreman shift");
		String adminToken = createAdminAndLogin();

		mockMvc.perform(get(shiftUrl(shiftId))
						.header(HttpHeaders.AUTHORIZATION, "Bearer " + adminToken))
				.andExpect(status().isOk())
				.andExpect(jsonPath("$.id").value(shiftId))
				.andExpect(jsonPath("$.title").value("Foreman shift"));
	}

	/**
	 * Tries to read shift management details as a WORKER and expects role-based denial.
	 */
	@Test
	void workerCannotGetShift() throws Exception {
		String foremanToken = registerAndLogin("foreman@example.com", "FOREMAN");
		long shiftId = createShift(foremanToken, "Foreman shift");
		String workerToken = registerAndLogin("worker@example.com", "WORKER");

		mockMvc.perform(get(shiftUrl(shiftId))
						.header(HttpHeaders.AUTHORIZATION, "Bearer " + workerToken))
				.andExpect(status().isForbidden())
				.andExpect(jsonPath("$.status").value(403))
				.andExpect(jsonPath("$.error").value("Forbidden"))
				.andExpect(jsonPath("$.message").value("Forbidden"))
				.andExpect(jsonPath("$.path").value(shiftUrl(shiftId)));
	}

	/**
	 * Calls shift details without JWT and expects the security entry point to return 401.
	 */
	@Test
	void missingTokenCannotGetShift() throws Exception {
		mockMvc.perform(get(shiftUrl(1)))
				.andExpect(status().isUnauthorized())
				.andExpect(jsonPath("$.status").value(401))
				.andExpect(jsonPath("$.error").value("Unauthorized"))
				.andExpect(jsonPath("$.message").value("Unauthorized"))
				.andExpect(jsonPath("$.path").value(shiftUrl(1)));
	}

	/**
	 * Calls shift details with an invalid JWT and expects token validation to return 401.
	 */
	@Test
	void invalidTokenCannotGetShift() throws Exception {
		mockMvc.perform(get(shiftUrl(1))
						.header(HttpHeaders.AUTHORIZATION, "Bearer invalid-token"))
				.andExpect(status().isUnauthorized())
				.andExpect(jsonPath("$.status").value(401))
				.andExpect(jsonPath("$.error").value("Unauthorized"))
				.andExpect(jsonPath("$.message").value("Unauthorized"))
				.andExpect(jsonPath("$.path").value(shiftUrl(1)));
	}

	/**
	 * Requests a missing shift as an allowed role and expects a 404 rather than an authorization error.
	 */
	@Test
	void unknownShiftReturnsNotFoundForAllowedRole() throws Exception {
		String accessToken = registerAndLogin("foreman@example.com", "FOREMAN");

		mockMvc.perform(get(shiftUrl(999999))
						.header(HttpHeaders.AUTHORIZATION, "Bearer " + accessToken))
				.andExpect(status().isNotFound())
				.andExpect(jsonPath("$.status").value(404))
				.andExpect(jsonPath("$.error").value("Not Found"))
				.andExpect(jsonPath("$.message").value("Shift not found"))
				.andExpect(jsonPath("$.path").value(shiftUrl(999999)));
	}

	/**
	 * Starts an OPEN shift as the owner FOREMAN and expects ACTIVE status with an actual start timestamp.
	 */
	@Test
	void ownerForemanStartsShift() throws Exception {
		String accessToken = registerAndLogin("owner@example.com", "FOREMAN");
		long shiftId = createShift(accessToken, "Owner shift");

		mockMvc.perform(post(startShiftUrl(shiftId))
						.header(HttpHeaders.AUTHORIZATION, "Bearer " + accessToken))
				.andExpect(status().isOk())
				.andExpect(jsonPath("$.id").value(shiftId))
				.andExpect(jsonPath("$.status").value("ACTIVE"))
				.andExpect(jsonPath("$.actualStartTime").isString())
				.andExpect(jsonPath("$.*", hasSize(3)));
	}

	/**
	 * Attempts to start a shift as another FOREMAN and expects ownership checks to return 403.
	 */
	@Test
	void anotherForemanCannotStartShift() throws Exception {
		String ownerToken = registerAndLogin("owner@example.com", "FOREMAN");
		long shiftId = createShift(ownerToken, "Owner shift");
		String anotherForemanToken = registerAndLogin("another@example.com", "FOREMAN");

		mockMvc.perform(post(startShiftUrl(shiftId))
						.header(HttpHeaders.AUTHORIZATION, "Bearer " + anotherForemanToken))
				.andExpect(status().isForbidden())
				.andExpect(jsonPath("$.status").value(403))
				.andExpect(jsonPath("$.error").value("Forbidden"))
				.andExpect(jsonPath("$.message").value("Forbidden"))
				.andExpect(jsonPath("$.path").value(startShiftUrl(shiftId)));
	}

	/**
	 * Starts a foreman-owned shift as ADMIN and expects lifecycle transition access to succeed.
	 */
	@Test
	void adminStartsAnyShift() throws Exception {
		String foremanToken = registerAndLogin("foreman@example.com", "FOREMAN");
		long shiftId = createShift(foremanToken, "Foreman shift");
		String adminToken = createAdminAndLogin();

		mockMvc.perform(post(startShiftUrl(shiftId))
						.header(HttpHeaders.AUTHORIZATION, "Bearer " + adminToken))
				.andExpect(status().isOk())
				.andExpect(jsonPath("$.id").value(shiftId))
				.andExpect(jsonPath("$.status").value("ACTIVE"))
				.andExpect(jsonPath("$.actualStartTime").isString());
	}

	/**
	 * Attempts to start a shift as WORKER and expects role-based authorization to reject the request.
	 */
	@Test
	void workerCannotStartShift() throws Exception {
		String foremanToken = registerAndLogin("foreman@example.com", "FOREMAN");
		long shiftId = createShift(foremanToken, "Foreman shift");
		String workerToken = registerAndLogin("worker@example.com", "WORKER");

		mockMvc.perform(post(startShiftUrl(shiftId))
						.header(HttpHeaders.AUTHORIZATION, "Bearer " + workerToken))
				.andExpect(status().isForbidden())
				.andExpect(jsonPath("$.status").value(403))
				.andExpect(jsonPath("$.error").value("Forbidden"))
				.andExpect(jsonPath("$.message").value("Forbidden"))
				.andExpect(jsonPath("$.path").value(startShiftUrl(shiftId)));
	}

	/**
	 * Calls the start endpoint without JWT and expects 401 before service logic runs.
	 */
	@Test
	void missingTokenCannotStartShift() throws Exception {
		mockMvc.perform(post(startShiftUrl(1)))
				.andExpect(status().isUnauthorized())
				.andExpect(jsonPath("$.status").value(401))
				.andExpect(jsonPath("$.error").value("Unauthorized"))
				.andExpect(jsonPath("$.message").value("Unauthorized"))
				.andExpect(jsonPath("$.path").value(startShiftUrl(1)));
	}

	/**
	 * Calls the start endpoint with a malformed JWT and expects 401.
	 */
	@Test
	void invalidTokenCannotStartShift() throws Exception {
		mockMvc.perform(post(startShiftUrl(1))
						.header(HttpHeaders.AUTHORIZATION, "Bearer invalid-token"))
				.andExpect(status().isUnauthorized())
				.andExpect(jsonPath("$.status").value(401))
				.andExpect(jsonPath("$.error").value("Unauthorized"))
				.andExpect(jsonPath("$.message").value("Unauthorized"))
				.andExpect(jsonPath("$.path").value(startShiftUrl(1)));
	}

	/**
	 * Attempts to start a missing shift as an allowed role and expects a 404 shift-not-found response.
	 */
	@Test
	void unknownShiftCannotBeStarted() throws Exception {
		String accessToken = registerAndLogin("foreman@example.com", "FOREMAN");

		mockMvc.perform(post(startShiftUrl(999999))
						.header(HttpHeaders.AUTHORIZATION, "Bearer " + accessToken))
				.andExpect(status().isNotFound())
				.andExpect(jsonPath("$.status").value(404))
				.andExpect(jsonPath("$.error").value("Not Found"))
				.andExpect(jsonPath("$.message").value("Shift not found"))
				.andExpect(jsonPath("$.path").value(startShiftUrl(999999)));
	}

	/**
	 * Starts the same shift twice and expects the second call to fail because only OPEN shifts can start.
	 */
	@Test
	void repeatedStartReturnsConflict() throws Exception {
		String accessToken = registerAndLogin("foreman@example.com", "FOREMAN");
		long shiftId = createShift(accessToken, "Foreman shift");

		startShift(accessToken, shiftId).andExpect(status().isOk());

		startShift(accessToken, shiftId)
				.andExpect(status().isConflict())
				.andExpect(jsonPath("$.status").value(409))
				.andExpect(jsonPath("$.error").value("Conflict"))
				.andExpect(jsonPath("$.message").value("Shift can only be started when status is OPEN"))
				.andExpect(jsonPath("$.path").value(startShiftUrl(shiftId)));
	}

	/**
	 * Checks that start persists ACTIVE status and records actualStartTime in the expected time window.
	 */
	@Test
	void startPersistsActiveStatusAndActualStartTime() throws Exception {
		String accessToken = registerAndLogin("foreman@example.com", "FOREMAN");
		long shiftId = createShift(accessToken, "Foreman shift");
		OffsetDateTime beforeStart = OffsetDateTime.now(ZoneOffset.UTC);

		startShift(accessToken, shiftId).andExpect(status().isOk());

		ShiftSession persistedShift = shiftSessionRepository.findById(shiftId).orElseThrow();
		assertThat(persistedShift.getStatus()).isEqualTo(ShiftStatus.ACTIVE);
		assertThat(persistedShift.getActualStartTime())
				.isNotNull()
				.isAfterOrEqualTo(beforeStart)
				.isBeforeOrEqualTo(OffsetDateTime.now(ZoneOffset.UTC));
	}

	/**
	 * Closes an ACTIVE shift as owner FOREMAN and expects CLOSED status plus an actual end timestamp.
	 */
	@Test
	void ownerForemanClosesActiveShift() throws Exception {
		String accessToken = registerAndLogin("owner@example.com", "FOREMAN");
		long shiftId = createActiveShift(accessToken, "Owner shift");

		closeShift(accessToken, shiftId)
				.andExpect(status().isOk())
				.andExpect(jsonPath("$.id").value(shiftId))
				.andExpect(jsonPath("$.status").value("CLOSED"))
				.andExpect(jsonPath("$.actualEndTime").isString())
				.andExpect(jsonPath("$.*", hasSize(3)));
	}

	/**
	 * Attempts to close another foreman's shift and expects ownership enforcement to return 403.
	 */
	@Test
	void anotherForemanCannotCloseShift() throws Exception {
		String ownerToken = registerAndLogin("owner@example.com", "FOREMAN");
		long shiftId = createActiveShift(ownerToken, "Owner shift");
		String anotherForemanToken = registerAndLogin("another@example.com", "FOREMAN");

		closeShift(anotherForemanToken, shiftId)
				.andExpect(status().isForbidden())
				.andExpect(jsonPath("$.status").value(403))
				.andExpect(jsonPath("$.error").value("Forbidden"))
				.andExpect(jsonPath("$.message").value("Forbidden"))
				.andExpect(jsonPath("$.path").value(closeShiftUrl(shiftId)));
	}

	/**
	 * Closes a foreman-created active shift as ADMIN, proving admin lifecycle access is global.
	 */
	@Test
	void adminClosesAnyActiveShift() throws Exception {
		String foremanToken = registerAndLogin("foreman@example.com", "FOREMAN");
		long shiftId = createActiveShift(foremanToken, "Foreman shift");
		String adminToken = createAdminAndLogin();

		closeShift(adminToken, shiftId)
				.andExpect(status().isOk())
				.andExpect(jsonPath("$.id").value(shiftId))
				.andExpect(jsonPath("$.status").value("CLOSED"))
				.andExpect(jsonPath("$.actualEndTime").isString());
	}

	/**
	 * Attempts to close a shift as WORKER and expects role-based authorization to return 403.
	 */
	@Test
	void workerCannotCloseShift() throws Exception {
		String foremanToken = registerAndLogin("foreman@example.com", "FOREMAN");
		long shiftId = createActiveShift(foremanToken, "Foreman shift");
		String workerToken = registerAndLogin("worker@example.com", "WORKER");

		closeShift(workerToken, shiftId)
				.andExpect(status().isForbidden())
				.andExpect(jsonPath("$.status").value(403))
				.andExpect(jsonPath("$.error").value("Forbidden"))
				.andExpect(jsonPath("$.message").value("Forbidden"))
				.andExpect(jsonPath("$.path").value(closeShiftUrl(shiftId)));
	}

	/**
	 * Calls close without JWT and expects the security layer to return Unauthorized.
	 */
	@Test
	void missingTokenCannotCloseShift() throws Exception {
		mockMvc.perform(post(closeShiftUrl(1)))
				.andExpect(status().isUnauthorized())
				.andExpect(jsonPath("$.status").value(401))
				.andExpect(jsonPath("$.error").value("Unauthorized"))
				.andExpect(jsonPath("$.message").value("Unauthorized"))
				.andExpect(jsonPath("$.path").value(closeShiftUrl(1)));
	}

	/**
	 * Calls close with an invalid JWT and expects token validation to reject the request.
	 */
	@Test
	void invalidTokenCannotCloseShift() throws Exception {
		mockMvc.perform(post(closeShiftUrl(1))
						.header(HttpHeaders.AUTHORIZATION, "Bearer invalid-token"))
				.andExpect(status().isUnauthorized())
				.andExpect(jsonPath("$.status").value(401))
				.andExpect(jsonPath("$.error").value("Unauthorized"))
				.andExpect(jsonPath("$.message").value("Unauthorized"))
				.andExpect(jsonPath("$.path").value(closeShiftUrl(1)));
	}

	/**
	 * Attempts to close a missing shift as an allowed role and expects a 404 response.
	 */
	@Test
	void unknownShiftCannotBeClosed() throws Exception {
		String accessToken = registerAndLogin("foreman@example.com", "FOREMAN");

		closeShift(accessToken, 999999)
				.andExpect(status().isNotFound())
				.andExpect(jsonPath("$.status").value(404))
				.andExpect(jsonPath("$.error").value("Not Found"))
				.andExpect(jsonPath("$.message").value("Shift not found"))
				.andExpect(jsonPath("$.path").value(closeShiftUrl(999999)));
	}

	/**
	 * Attempts to close a shift that is still OPEN and expects the lifecycle conflict message.
	 */
	@Test
	void closingOpenShiftReturnsConflict() throws Exception {
		String accessToken = registerAndLogin("foreman@example.com", "FOREMAN");
		long shiftId = createShift(accessToken, "Open shift");

		closeShift(accessToken, shiftId)
				.andExpect(status().isConflict())
				.andExpect(jsonPath("$.status").value(409))
				.andExpect(jsonPath("$.error").value("Conflict"))
				.andExpect(jsonPath("$.message").value("Shift can only be closed when status is ACTIVE"))
				.andExpect(jsonPath("$.path").value(closeShiftUrl(shiftId)));
	}

	/**
	 * Closes an ACTIVE shift once, then expects a second close attempt to fail because the shift is already CLOSED.
	 */
	@Test
	void repeatedCloseReturnsConflict() throws Exception {
		String accessToken = registerAndLogin("foreman@example.com", "FOREMAN");
		long shiftId = createActiveShift(accessToken, "Active shift");

		closeShift(accessToken, shiftId).andExpect(status().isOk());

		closeShift(accessToken, shiftId)
				.andExpect(status().isConflict())
				.andExpect(jsonPath("$.status").value(409))
				.andExpect(jsonPath("$.error").value("Conflict"))
				.andExpect(jsonPath("$.message").value("Shift can only be closed when status is ACTIVE"))
				.andExpect(jsonPath("$.path").value(closeShiftUrl(shiftId)));
	}

	/**
	 * Verifies close persists CLOSED status and records actualEndTime after actualStartTime.
	 */
	@Test
	void closePersistsStatusAndChronologicalActualEndTime() throws Exception {
		String accessToken = registerAndLogin("foreman@example.com", "FOREMAN");
		long shiftId = createActiveShift(accessToken, "Active shift");
		OffsetDateTime beforeClose = OffsetDateTime.now(ZoneOffset.UTC);

		closeShift(accessToken, shiftId).andExpect(status().isOk());

		ShiftSession persistedShift = shiftSessionRepository.findById(shiftId).orElseThrow();
		assertThat(persistedShift.getStatus()).isEqualTo(ShiftStatus.CLOSED);
		assertThat(persistedShift.getActualEndTime())
				.isNotNull()
				.isAfterOrEqualTo(beforeClose)
				.isBeforeOrEqualTo(OffsetDateTime.now(ZoneOffset.UTC))
				.isAfterOrEqualTo(persistedShift.getActualStartTime());
	}

	/**
	 * Closes a shift with APPROVED attendance and expects worked minutes and salary to be persisted from shift time,
	 * break, and attendance rate.
	 */
	@Test
	void closeCalculatesSalaryForApprovedAttendance() throws Exception {
		String foremanToken = registerAndLogin("foreman@example.com", "FOREMAN");
		long shiftId = createShift(foremanToken, "Salary shift");
		String workerToken = registerAndLogin("worker@example.com", "WORKER");
		long attendanceId = joinAndGetAttendanceId(workerToken, shiftId);
		approveAttendance(foremanToken, shiftId, attendanceId, "{}").andExpect(status().isOk());
		startShift(foremanToken, shiftId).andExpect(status().isOk());
		setActualStartTime(shiftId, OffsetDateTime.now(ZoneOffset.UTC).minusMinutes(540));

		closeShift(foremanToken, shiftId).andExpect(status().isOk());

		ShiftSession shift = shiftSessionRepository.findById(shiftId).orElseThrow();
		ShiftAttendance attendance = shiftAttendanceRepository.findById(attendanceId).orElseThrow();
		int expectedWorkedMinutes = expectedWorkedMinutes(shift, attendance);
		assertThat(attendance.getStatus()).isEqualTo(AttendanceStatus.APPROVED);
		assertThat(attendance.getWorkedMinutes()).isEqualTo(expectedWorkedMinutes);
		assertThat(attendance.getCalculatedSalary())
				.isEqualByComparingTo(expectedSalary(expectedWorkedMinutes, attendance.getHourlyRate()));
	}

	/**
	 * Approves attendance with a rate override and expects close-time salary to use the attendance override.
	 */
	@Test
	void closeUsesAttendanceOverrideHourlyRateForSalary() throws Exception {
		String foremanToken = registerAndLogin("foreman@example.com", "FOREMAN");
		long shiftId = createShift(foremanToken, "Override salary shift");
		String workerToken = registerAndLogin("worker@example.com", "WORKER");
		long attendanceId = joinAndGetAttendanceId(workerToken, shiftId);
		approveAttendance(foremanToken, shiftId, attendanceId, "{\"hourlyRate\": 18.50}")
				.andExpect(status().isOk());
		startShift(foremanToken, shiftId).andExpect(status().isOk());
		setActualStartTime(shiftId, OffsetDateTime.now(ZoneOffset.UTC).minusMinutes(180));

		closeShift(foremanToken, shiftId).andExpect(status().isOk());

		ShiftSession shift = shiftSessionRepository.findById(shiftId).orElseThrow();
		ShiftAttendance attendance = shiftAttendanceRepository.findById(attendanceId).orElseThrow();
		int expectedWorkedMinutes = expectedWorkedMinutes(shift, attendance);
		assertThat(attendance.getHourlyRate()).isEqualByComparingTo("18.50");
		assertThat(attendance.getWorkedMinutes()).isEqualTo(expectedWorkedMinutes);
		assertThat(attendance.getCalculatedSalary())
				.isEqualByComparingTo(expectedSalary(expectedWorkedMinutes, new BigDecimal("18.50")));
	}

	/**
	 * Leaves attendance in JOINED state, closes the shift, and expects salary fields to remain null.
	 */
	@Test
	void closeLeavesJoinedAttendanceWithoutSalary() throws Exception {
		String foremanToken = registerAndLogin("foreman@example.com", "FOREMAN");
		long shiftId = createShift(foremanToken, "Joined attendance shift");
		String workerToken = registerAndLogin("worker@example.com", "WORKER");
		long attendanceId = joinAndGetAttendanceId(workerToken, shiftId);
		startShift(foremanToken, shiftId).andExpect(status().isOk());
		setActualStartTime(shiftId, OffsetDateTime.now(ZoneOffset.UTC).minusMinutes(120));

		closeShift(foremanToken, shiftId).andExpect(status().isOk());

		ShiftAttendance attendance = shiftAttendanceRepository.findById(attendanceId).orElseThrow();
		assertThat(attendance.getStatus()).isEqualTo(AttendanceStatus.JOINED);
		assertThat(attendance.getWorkedMinutes()).isNull();
		assertThat(attendance.getCalculatedSalary()).isNull();
	}

	/**
	 * Makes the shift duration shorter than the attendance break and expects close to roll back without salary writes.
	 */
	@Test
	void invalidBreakGreaterThanDurationReturnsConflictAndDoesNotCloseShift() throws Exception {
		String foremanToken = registerAndLogin("foreman@example.com", "FOREMAN");
		long shiftId = createShift(foremanToken, "Invalid break salary shift");
		String workerToken = registerAndLogin("worker@example.com", "WORKER");
		long attendanceId = joinAndGetAttendanceId(workerToken, shiftId);
		approveAttendance(foremanToken, shiftId, attendanceId, "{}").andExpect(status().isOk());
		startShift(foremanToken, shiftId).andExpect(status().isOk());
		setActualStartTime(shiftId, OffsetDateTime.now(ZoneOffset.UTC).minusMinutes(10));

		closeShift(foremanToken, shiftId)
				.andExpect(status().isConflict())
				.andExpect(jsonPath("$.status").value(409))
				.andExpect(jsonPath("$.error").value("Conflict"))
				.andExpect(jsonPath("$.message").value("Break minutes cannot be greater than shift duration"))
				.andExpect(jsonPath("$.path").value(closeShiftUrl(shiftId)));

		ShiftSession shift = shiftSessionRepository.findById(shiftId).orElseThrow();
		ShiftAttendance attendance = shiftAttendanceRepository.findById(attendanceId).orElseThrow();
		assertThat(shift.getStatus()).isEqualTo(ShiftStatus.ACTIVE);
		assertThat(shift.getActualEndTime()).isNull();
		assertThat(attendance.getWorkedMinutes()).isNull();
		assertThat(attendance.getCalculatedSalary()).isNull();
	}

	/**
	 * Builds a closed shift with two approved workers and one unapproved worker, then expects the summary to include
	 * only approved persisted salary rows ordered by worker name without user entity fields.
	 */
	@Test
	void ownerForemanGetsClosedShiftSummary() throws Exception {
		String foremanToken = registerAndLogin("foreman@example.com", "FOREMAN");
		long shiftId = createShift(foremanToken, "Summary shift");
		String firstWorkerToken = registerAndLogin(
				"first.worker@example.com",
				"WORKER",
				"Bob",
				"Alpha"
		);
		String secondWorkerToken = registerAndLogin(
				"second.worker@example.com",
				"WORKER",
				"Anna",
				"Zulu"
		);
		String joinedWorkerToken = registerAndLogin(
				"joined.worker@example.com",
				"WORKER",
				"Charlie",
				"Beta"
		);
		long firstAttendanceId = joinAndGetAttendanceId(firstWorkerToken, shiftId);
		long secondAttendanceId = joinAndGetAttendanceId(secondWorkerToken, shiftId);
		long joinedAttendanceId = joinAndGetAttendanceId(joinedWorkerToken, shiftId);
		approveAttendance(foremanToken, shiftId, secondAttendanceId, "{\"hourlyRate\": 18.50}")
				.andExpect(status().isOk());
		approveAttendance(foremanToken, shiftId, firstAttendanceId, "{}").andExpect(status().isOk());
		startShift(foremanToken, shiftId).andExpect(status().isOk());
		setActualStartTime(shiftId, OffsetDateTime.now(ZoneOffset.UTC).minusMinutes(540));
		closeShift(foremanToken, shiftId).andExpect(status().isOk());

		ShiftAttendance firstAttendance = shiftAttendanceRepository.findById(firstAttendanceId).orElseThrow();
		ShiftAttendance secondAttendance = shiftAttendanceRepository.findById(secondAttendanceId).orElseThrow();
		ShiftAttendance joinedAttendance = shiftAttendanceRepository.findById(joinedAttendanceId).orElseThrow();
		BigDecimal totalSalary = firstAttendance.getCalculatedSalary()
				.add(secondAttendance.getCalculatedSalary())
				.setScale(2, RoundingMode.HALF_UP);

		getSummary(foremanToken, shiftId)
				.andExpect(status().isOk())
				.andExpect(jsonPath("$.shiftId").value(shiftId))
				.andExpect(jsonPath("$.status").value("CLOSED"))
				.andExpect(jsonPath("$.totalWorkers").value(2))
				.andExpect(jsonPath("$.totalSalary").value(totalSalary.doubleValue()))
				.andExpect(jsonPath("$.workers", hasSize(2)))
				.andExpect(jsonPath("$.workers[0].attendanceId").value(firstAttendanceId))
				.andExpect(jsonPath("$.workers[0].workerId").isNumber())
				.andExpect(jsonPath("$.workers[0].firstName").value("Bob"))
				.andExpect(jsonPath("$.workers[0].lastName").value("Alpha"))
				.andExpect(jsonPath("$.workers[0].workedMinutes").value(firstAttendance.getWorkedMinutes()))
				.andExpect(jsonPath("$.workers[0].hourlyRate").value(15.25))
				.andExpect(jsonPath("$.workers[0].salary")
						.value(firstAttendance.getCalculatedSalary().doubleValue()))
				.andExpect(jsonPath("$.workers[0].*", hasSize(7)))
				.andExpect(jsonPath("$.workers[0].passwordHash").doesNotExist())
				.andExpect(jsonPath("$.workers[0].user").doesNotExist())
				.andExpect(jsonPath("$.workers[0].email").doesNotExist())
				.andExpect(jsonPath("$.workers[1].attendanceId").value(secondAttendanceId))
				.andExpect(jsonPath("$.workers[1].firstName").value("Anna"))
				.andExpect(jsonPath("$.workers[1].lastName").value("Zulu"))
				.andExpect(jsonPath("$.workers[1].hourlyRate").value(18.50))
				.andExpect(jsonPath("$.workers[1].salary")
						.value(secondAttendance.getCalculatedSalary().doubleValue()))
				.andExpect(jsonPath("$.*", hasSize(5)))
				.andExpect(jsonPath("$.workers[?(@.attendanceId == %d)]".formatted(joinedAttendanceId))
						.isEmpty());
		assertThat(joinedAttendance.getCalculatedSalary()).isNull();
	}

	/**
	 * Reads a closed shift summary as ADMIN and expects cross-shift summary access to succeed.
	 */
	@Test
	void adminGetsSummaryForAnyClosedShift() throws Exception {
		String foremanToken = registerAndLogin("foreman@example.com", "FOREMAN");
		long shiftId = createClosedShiftWithApprovedAttendance(foremanToken);
		String adminToken = createAdminAndLogin();

		getSummary(adminToken, shiftId)
				.andExpect(status().isOk())
				.andExpect(jsonPath("$.shiftId").value(shiftId))
				.andExpect(jsonPath("$.status").value("CLOSED"))
				.andExpect(jsonPath("$.totalWorkers").value(1));
	}

	/**
	 * Attempts to read a shift summary as WORKER and expects role-based denial.
	 */
	@Test
	void workerCannotGetSummary() throws Exception {
		String foremanToken = registerAndLogin("foreman@example.com", "FOREMAN");
		long shiftId = createClosedShiftWithApprovedAttendance(foremanToken);
		String workerToken = registerAndLogin("other.worker@example.com", "WORKER");

		getSummary(workerToken, shiftId)
				.andExpect(status().isForbidden())
				.andExpect(jsonPath("$.status").value(403))
				.andExpect(jsonPath("$.error").value("Forbidden"))
				.andExpect(jsonPath("$.message").value("Forbidden"))
				.andExpect(jsonPath("$.path").value(summaryUrl(shiftId)));
	}

	/**
	 * Attempts to read another foreman's summary and expects ownership enforcement to return 403.
	 */
	@Test
	void nonOwnerForemanCannotGetSummary() throws Exception {
		String ownerToken = registerAndLogin("owner@example.com", "FOREMAN");
		long shiftId = createClosedShiftWithApprovedAttendance(ownerToken);
		String anotherForemanToken = registerAndLogin("another@example.com", "FOREMAN");

		getSummary(anotherForemanToken, shiftId)
				.andExpect(status().isForbidden())
				.andExpect(jsonPath("$.status").value(403))
				.andExpect(jsonPath("$.error").value("Forbidden"))
				.andExpect(jsonPath("$.message").value("Forbidden"))
				.andExpect(jsonPath("$.path").value(summaryUrl(shiftId)));
	}

	/**
	 * Calls summary without JWT and expects a 401 response.
	 */
	@Test
	void missingTokenCannotGetSummary() throws Exception {
		mockMvc.perform(get(summaryUrl(1)))
				.andExpect(status().isUnauthorized())
				.andExpect(jsonPath("$.status").value(401))
				.andExpect(jsonPath("$.error").value("Unauthorized"))
				.andExpect(jsonPath("$.message").value("Unauthorized"))
				.andExpect(jsonPath("$.path").value(summaryUrl(1)));
	}

	/**
	 * Calls summary with an invalid JWT and expects token validation to return 401.
	 */
	@Test
	void invalidTokenCannotGetSummary() throws Exception {
		mockMvc.perform(get(summaryUrl(1))
						.header(HttpHeaders.AUTHORIZATION, "Bearer invalid-token"))
				.andExpect(status().isUnauthorized())
				.andExpect(jsonPath("$.status").value(401))
				.andExpect(jsonPath("$.error").value("Unauthorized"))
				.andExpect(jsonPath("$.message").value("Unauthorized"))
				.andExpect(jsonPath("$.path").value(summaryUrl(1)));
	}

	/**
	 * Requests summary for a missing shift and expects the allowed role to receive a 404 response.
	 */
	@Test
	void unknownShiftSummaryReturnsNotFound() throws Exception {
		String foremanToken = registerAndLogin("foreman@example.com", "FOREMAN");

		getSummary(foremanToken, 999999)
				.andExpect(status().isNotFound())
				.andExpect(jsonPath("$.status").value(404))
				.andExpect(jsonPath("$.error").value("Not Found"))
				.andExpect(jsonPath("$.message").value("Shift not found"))
				.andExpect(jsonPath("$.path").value(summaryUrl(999999)));
	}

	/**
	 * Requests summary before close and expects the CLOSED-only summary rule to return a conflict.
	 */
	@Test
	void nonClosedShiftSummaryReturnsConflict() throws Exception {
		String foremanToken = registerAndLogin("foreman@example.com", "FOREMAN");
		long shiftId = createShift(foremanToken, "Open summary shift");

		getSummary(foremanToken, shiftId)
				.andExpect(status().isConflict())
				.andExpect(jsonPath("$.status").value(409))
				.andExpect(jsonPath("$.error").value("Conflict"))
				.andExpect(jsonPath("$.message").value("Shift summary is available only for CLOSED shifts"))
				.andExpect(jsonPath("$.path").value(summaryUrl(shiftId)));
	}

	/**
	 * Corrupts persisted salary data for approved attendance and expects summary to fail rather than recalculate.
	 */
	@Test
	void approvedAttendanceWithMissingSalaryDataReturnsConflict() throws Exception {
		String foremanToken = registerAndLogin("foreman@example.com", "FOREMAN");
		long shiftId = createClosedShiftWithApprovedAttendance(foremanToken);
		ShiftAttendance attendance = shiftAttendanceRepository.findAll().stream()
				.filter((candidate) -> candidate.getShiftSession().getId().equals(shiftId))
				.findFirst()
				.orElseThrow();
		attendance.setWorkedMinutes(null);
		shiftAttendanceRepository.saveAndFlush(attendance);

		getSummary(foremanToken, shiftId)
				.andExpect(status().isConflict())
				.andExpect(jsonPath("$.status").value(409))
				.andExpect(jsonPath("$.error").value("Conflict"))
				.andExpect(jsonPath("$.message").value("Approved attendance has incomplete salary calculation"))
				.andExpect(jsonPath("$.path").value(summaryUrl(shiftId)));
	}

	/**
	 * Omits defaultHourlyRate during shift creation and expects request validation to reject the payload.
	 */
	@Test
	void missingDefaultHourlyRateReturnsBadRequest() throws Exception {
		String accessToken = registerAndLogin("foreman@example.com", "FOREMAN");

		createShiftWithPayload(accessToken, """
				{
				  "title": "Missing rate shift",
				  "location": "Cologne",
				  "plannedStartTime": "2026-07-01T08:00:00",
				  "plannedEndTime": "2026-07-01T17:00:00",
				  "defaultBreakMinutes": 60
				}
				""")
				.andExpect(status().isBadRequest())
				.andExpect(jsonPath("$.status").value(400))
				.andExpect(jsonPath("$.error").value("Bad Request"))
				.andExpect(jsonPath("$.path").value(CREATE_SHIFT_URL));
	}

	/**
	 * Sends a negative default hourly rate and expects validation to reject salary input before persistence.
	 */
	@Test
	void negativeDefaultHourlyRateReturnsBadRequest() throws Exception {
		String accessToken = registerAndLogin("foreman@example.com", "FOREMAN");

		createShiftWithPayload(accessToken, validCreateShiftPayload("Negative rate shift", "-0.01"))
				.andExpect(status().isBadRequest())
				.andExpect(jsonPath("$.status").value(400))
				.andExpect(jsonPath("$.error").value("Bad Request"))
				.andExpect(jsonPath("$.path").value(CREATE_SHIFT_URL));
	}

	/**
	 * Sends a default hourly rate with more than two decimal places and expects validation to return 400.
	 */
	@Test
	void defaultHourlyRateWithTooManyDecimalPlacesReturnsBadRequest() throws Exception {
		String accessToken = registerAndLogin("foreman@example.com", "FOREMAN");

		createShiftWithPayload(accessToken, validCreateShiftPayload("Invalid rate shift", "15.123"))
				.andExpect(status().isBadRequest())
				.andExpect(jsonPath("$.status").value(400))
				.andExpect(jsonPath("$.error").value("Bad Request"))
				.andExpect(jsonPath("$.path").value(CREATE_SHIFT_URL));
	}

	/**
	 * Registers a user with the default test name and returns a JWT for authenticated controller requests.
	 *
	 * @param email email address used for registration and login
	 * @param role role sent to the public registration endpoint
	 * @return JWT access token for the created user
	 */
	private String registerAndLogin(String email, String role) throws Exception {
		return registerAndLogin(email, role, "Test", "User");
	}

	/**
	 * Registers a named user and logs in with the shared test password.
	 *
	 * @param email email address used for the account
	 * @param role role sent to registration
	 * @param firstName first name stored on the user
	 * @param lastName last name stored on the user
	 * @return JWT access token for the account
	 */
	private String registerAndLogin(
			String email,
			String role,
			String firstName,
			String lastName
	) throws Exception {
		mockMvc.perform(post(REGISTER_URL)
						.contentType(MediaType.APPLICATION_JSON)
						.content("""
								{
								  "email": "%s",
								  "password": "password123",
								  "firstName": "%s",
								  "lastName": "%s",
								  "role": "%s"
								}
								""".formatted(email, firstName, lastName, role)))
				.andExpect(status().isCreated());

		return login(email);
	}

	/**
	 * Inserts an ADMIN directly because public registration intentionally disallows ADMIN accounts.
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
	 * Logs in an existing test user and extracts the JWT access token from the response body.
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
	 * Builds a valid shift creation request with the default hourly rate used by most tests.
	 *
	 * @param title shift title
	 * @return JSON request body
	 */
	private String validCreateShiftPayload(String title) {
		return validCreateShiftPayload(title, "15.25");
	}

	/**
	 * Builds a shift creation request while allowing tests to vary hourly-rate validation input.
	 *
	 * @param title shift title
	 * @param defaultHourlyRate literal JSON number for defaultHourlyRate
	 * @return JSON request body
	 */
	private String validCreateShiftPayload(String title, String defaultHourlyRate) {
		return """
				{
				  "title": "%s",
				  "location": "Cologne",
				  "plannedStartTime": "2026-07-01T08:00:00",
				  "plannedEndTime": "2026-07-01T17:00:00",
				  "defaultBreakMinutes": 60,
				  "defaultHourlyRate": %s
				}
				""".formatted(title, defaultHourlyRate);
	}

	/**
	 * Creates a valid shift through the API and extracts its generated id.
	 *
	 * @param accessToken JWT for a FOREMAN or ADMIN
	 * @param title shift title
	 * @return created shift id
	 */
	private long createShift(String accessToken, String title) throws Exception {
		MvcResult result = createShiftWithPayload(accessToken, validCreateShiftPayload(title))
				.andExpect(status().isCreated())
				.andReturn();

		Matcher matcher = SHIFT_ID_PATTERN.matcher(result.getResponse().getContentAsString());
		assertThat(matcher.find()).isTrue();
		return Long.parseLong(matcher.group(1));
	}

	/**
	 * Sends a raw shift creation payload so validation tests can control invalid fields.
	 *
	 * @param accessToken JWT for the caller
	 * @param payload JSON request body
	 * @return MockMvc result actions for assertions
	 */
	private ResultActions createShiftWithPayload(String accessToken, String payload) throws Exception {
		return mockMvc.perform(post(CREATE_SHIFT_URL)
				.header(HttpHeaders.AUTHORIZATION, "Bearer " + accessToken)
				.contentType(MediaType.APPLICATION_JSON)
				.content(payload));
	}

	/**
	 * Creates a shift and starts it, returning an ACTIVE shift id for close and summary setup.
	 *
	 * @param accessToken JWT for a shift manager
	 * @param title shift title
	 * @return active shift id
	 */
	private long createActiveShift(String accessToken, String title) throws Exception {
		long shiftId = createShift(accessToken, title);
		startShift(accessToken, shiftId).andExpect(status().isOk());
		return shiftId;
	}

	/**
	 * Builds the shift details URL for the supplied id.
	 *
	 * @param shiftId shift id
	 * @return endpoint path
	 */
	private String shiftUrl(long shiftId) {
		return CREATE_SHIFT_URL + "/" + shiftId;
	}

	/**
	 * Builds the start endpoint URL for a shift.
	 *
	 * @param shiftId shift id
	 * @return endpoint path
	 */
	private String startShiftUrl(long shiftId) {
		return shiftUrl(shiftId) + "/start";
	}

	/**
	 * Sends a start request for a shift as the given caller.
	 *
	 * @param accessToken JWT for the caller
	 * @param shiftId target shift id
	 * @return MockMvc result actions for assertions
	 */
	private ResultActions startShift(String accessToken, long shiftId) throws Exception {
		return mockMvc.perform(post(startShiftUrl(shiftId))
				.header(HttpHeaders.AUTHORIZATION, "Bearer " + accessToken));
	}

	/**
	 * Builds the close endpoint URL for a shift.
	 *
	 * @param shiftId shift id
	 * @return endpoint path
	 */
	private String closeShiftUrl(long shiftId) {
		return shiftUrl(shiftId) + "/close";
	}

	/**
	 * Sends a close request for a shift as the given caller.
	 *
	 * @param accessToken JWT for the caller
	 * @param shiftId target shift id
	 * @return MockMvc result actions for assertions
	 */
	private ResultActions closeShift(String accessToken, long shiftId) throws Exception {
		return mockMvc.perform(post(closeShiftUrl(shiftId))
				.header(HttpHeaders.AUTHORIZATION, "Bearer " + accessToken));
	}

	/**
	 * Creates, approves, starts, adjusts start time, and closes a shift for summary tests.
	 *
	 * @param foremanToken JWT for the owning foreman
	 * @return closed shift id with one approved attendance row
	 */
	private long createClosedShiftWithApprovedAttendance(String foremanToken) throws Exception {
		long shiftId = createShift(foremanToken, "Closed summary shift");
		String workerToken = registerAndLogin("summary.worker." + shiftId + "@example.com", "WORKER");
		long attendanceId = joinAndGetAttendanceId(workerToken, shiftId);
		approveAttendance(foremanToken, shiftId, attendanceId, "{}").andExpect(status().isOk());
		startShift(foremanToken, shiftId).andExpect(status().isOk());
		setActualStartTime(shiftId, OffsetDateTime.now(ZoneOffset.UTC).minusMinutes(180));
		closeShift(foremanToken, shiftId).andExpect(status().isOk());
		return shiftId;
	}

	/**
	 * Uses a shift's generated join code to create worker attendance and extract the attendance id.
	 *
	 * @param accessToken worker JWT
	 * @param shiftId shift to join
	 * @return created attendance id
	 */
	private long joinAndGetAttendanceId(String accessToken, long shiftId) throws Exception {
		String joinCode = shiftSessionRepository.findById(shiftId).orElseThrow().getJoinCode();
		MvcResult result = mockMvc.perform(post(JOIN_SHIFT_URL)
						.header(HttpHeaders.AUTHORIZATION, "Bearer " + accessToken)
						.contentType(MediaType.APPLICATION_JSON)
						.content("""
								{
								  "joinCode": "%s"
								}
								""".formatted(joinCode)))
				.andExpect(status().isOk())
				.andReturn();
		Matcher matcher = ATTENDANCE_ID_PATTERN.matcher(result.getResponse().getContentAsString());
		assertThat(matcher.find()).isTrue();
		return Long.parseLong(matcher.group(1));
	}

	/**
	 * Sends an attendance approval request with a caller-selected body.
	 *
	 * @param accessToken JWT for a FOREMAN or ADMIN
	 * @param shiftId shift id from the URL
	 * @param attendanceId attendance id from the URL
	 * @param payload approval JSON body
	 * @return MockMvc result actions for assertions
	 */
	private ResultActions approveAttendance(
			String accessToken,
			long shiftId,
			long attendanceId,
			String payload
	) throws Exception {
		return mockMvc.perform(post(shiftUrl(shiftId) + "/attendance/" + attendanceId + "/approve")
				.header(HttpHeaders.AUTHORIZATION, "Bearer " + accessToken)
				.contentType(MediaType.APPLICATION_JSON)
				.content(payload));
	}

	/**
	 * Reads a shift summary as the supplied caller.
	 *
	 * @param accessToken JWT for the caller
	 * @param shiftId target shift id
	 * @return MockMvc result actions for assertions
	 */
	private ResultActions getSummary(String accessToken, long shiftId) throws Exception {
		return mockMvc.perform(get(summaryUrl(shiftId))
				.header(HttpHeaders.AUTHORIZATION, "Bearer " + accessToken));
	}

	/**
	 * Moves actualStartTime backward to make salary tests deterministic without waiting in real time.
	 *
	 * @param shiftId shift to update
	 * @param actualStartTime timestamp to persist
	 */
	private void setActualStartTime(long shiftId, OffsetDateTime actualStartTime) {
		ShiftSession shiftSession = shiftSessionRepository.findById(shiftId).orElseThrow();
		shiftSession.setActualStartTime(actualStartTime);
		shiftSessionRepository.saveAndFlush(shiftSession);
	}

	/**
	 * Mirrors the production worked-minute formula so controller tests can assert persisted salary output.
	 *
	 * @param shift closed shift entity
	 * @param attendance attendance row with break minutes
	 * @return expected worked minutes
	 */
	private int expectedWorkedMinutes(ShiftSession shift, ShiftAttendance attendance) {
		return Math.toIntExact(Duration.between(shift.getActualStartTime(), shift.getActualEndTime()).toMinutes()
				- attendance.getBreakMinutes());
	}

	/**
	 * Mirrors salary rounding used by the service for expected values in close tests.
	 *
	 * @param workedMinutes expected worked minutes
	 * @param hourlyRate attendance hourly rate
	 * @return expected salary rounded to scale two
	 */
	private BigDecimal expectedSalary(int workedMinutes, BigDecimal hourlyRate) {
		return hourlyRate.multiply(BigDecimal.valueOf(workedMinutes))
				.divide(BigDecimal.valueOf(60), 2, RoundingMode.HALF_UP);
	}

	/**
	 * Builds the summary endpoint URL for a shift.
	 *
	 * @param shiftId shift id
	 * @return endpoint path
	 */
	private String summaryUrl(long shiftId) {
		return shiftUrl(shiftId) + "/summary";
	}

	/**
	 * Extracts the generated join code from a create-shift response.
	 *
	 * @param result MockMvc result containing a create response
	 * @return join code
	 */
	private String extractJoinCode(MvcResult result) throws Exception {
		Matcher matcher = JOIN_CODE_PATTERN.matcher(result.getResponse().getContentAsString());
		assertThat(matcher.find()).isTrue();
		return matcher.group(1);
	}
}
