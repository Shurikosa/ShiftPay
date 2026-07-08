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

	@BeforeEach
	void setUp() {
		TestDataCleaner.clean(jdbcTemplate);
	}

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

	@Test
	void missingTokenCannotGetShift() throws Exception {
		mockMvc.perform(get(shiftUrl(1)))
				.andExpect(status().isUnauthorized())
				.andExpect(jsonPath("$.status").value(401))
				.andExpect(jsonPath("$.error").value("Unauthorized"))
				.andExpect(jsonPath("$.message").value("Unauthorized"))
				.andExpect(jsonPath("$.path").value(shiftUrl(1)));
	}

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

	@Test
	void missingTokenCannotStartShift() throws Exception {
		mockMvc.perform(post(startShiftUrl(1)))
				.andExpect(status().isUnauthorized())
				.andExpect(jsonPath("$.status").value(401))
				.andExpect(jsonPath("$.error").value("Unauthorized"))
				.andExpect(jsonPath("$.message").value("Unauthorized"))
				.andExpect(jsonPath("$.path").value(startShiftUrl(1)));
	}

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

	@Test
	void missingTokenCannotCloseShift() throws Exception {
		mockMvc.perform(post(closeShiftUrl(1)))
				.andExpect(status().isUnauthorized())
				.andExpect(jsonPath("$.status").value(401))
				.andExpect(jsonPath("$.error").value("Unauthorized"))
				.andExpect(jsonPath("$.message").value("Unauthorized"))
				.andExpect(jsonPath("$.path").value(closeShiftUrl(1)));
	}

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

	@Test
	void missingTokenCannotGetSummary() throws Exception {
		mockMvc.perform(get(summaryUrl(1)))
				.andExpect(status().isUnauthorized())
				.andExpect(jsonPath("$.status").value(401))
				.andExpect(jsonPath("$.error").value("Unauthorized"))
				.andExpect(jsonPath("$.message").value("Unauthorized"))
				.andExpect(jsonPath("$.path").value(summaryUrl(1)));
	}

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

	@Test
	void negativeDefaultHourlyRateReturnsBadRequest() throws Exception {
		String accessToken = registerAndLogin("foreman@example.com", "FOREMAN");

		createShiftWithPayload(accessToken, validCreateShiftPayload("Negative rate shift", "-0.01"))
				.andExpect(status().isBadRequest())
				.andExpect(jsonPath("$.status").value(400))
				.andExpect(jsonPath("$.error").value("Bad Request"))
				.andExpect(jsonPath("$.path").value(CREATE_SHIFT_URL));
	}

	@Test
	void defaultHourlyRateWithTooManyDecimalPlacesReturnsBadRequest() throws Exception {
		String accessToken = registerAndLogin("foreman@example.com", "FOREMAN");

		createShiftWithPayload(accessToken, validCreateShiftPayload("Invalid rate shift", "15.123"))
				.andExpect(status().isBadRequest())
				.andExpect(jsonPath("$.status").value(400))
				.andExpect(jsonPath("$.error").value("Bad Request"))
				.andExpect(jsonPath("$.path").value(CREATE_SHIFT_URL));
	}

	private String registerAndLogin(String email, String role) throws Exception {
		return registerAndLogin(email, role, "Test", "User");
	}

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

	private String validCreateShiftPayload(String title) {
		return validCreateShiftPayload(title, "15.25");
	}

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

	private long createShift(String accessToken, String title) throws Exception {
		MvcResult result = createShiftWithPayload(accessToken, validCreateShiftPayload(title))
				.andExpect(status().isCreated())
				.andReturn();

		Matcher matcher = SHIFT_ID_PATTERN.matcher(result.getResponse().getContentAsString());
		assertThat(matcher.find()).isTrue();
		return Long.parseLong(matcher.group(1));
	}

	private ResultActions createShiftWithPayload(String accessToken, String payload) throws Exception {
		return mockMvc.perform(post(CREATE_SHIFT_URL)
				.header(HttpHeaders.AUTHORIZATION, "Bearer " + accessToken)
				.contentType(MediaType.APPLICATION_JSON)
				.content(payload));
	}

	private long createActiveShift(String accessToken, String title) throws Exception {
		long shiftId = createShift(accessToken, title);
		startShift(accessToken, shiftId).andExpect(status().isOk());
		return shiftId;
	}

	private String shiftUrl(long shiftId) {
		return CREATE_SHIFT_URL + "/" + shiftId;
	}

	private String startShiftUrl(long shiftId) {
		return shiftUrl(shiftId) + "/start";
	}

	private ResultActions startShift(String accessToken, long shiftId) throws Exception {
		return mockMvc.perform(post(startShiftUrl(shiftId))
				.header(HttpHeaders.AUTHORIZATION, "Bearer " + accessToken));
	}

	private String closeShiftUrl(long shiftId) {
		return shiftUrl(shiftId) + "/close";
	}

	private ResultActions closeShift(String accessToken, long shiftId) throws Exception {
		return mockMvc.perform(post(closeShiftUrl(shiftId))
				.header(HttpHeaders.AUTHORIZATION, "Bearer " + accessToken));
	}

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

	private ResultActions getSummary(String accessToken, long shiftId) throws Exception {
		return mockMvc.perform(get(summaryUrl(shiftId))
				.header(HttpHeaders.AUTHORIZATION, "Bearer " + accessToken));
	}

	private void setActualStartTime(long shiftId, OffsetDateTime actualStartTime) {
		ShiftSession shiftSession = shiftSessionRepository.findById(shiftId).orElseThrow();
		shiftSession.setActualStartTime(actualStartTime);
		shiftSessionRepository.saveAndFlush(shiftSession);
	}

	private int expectedWorkedMinutes(ShiftSession shift, ShiftAttendance attendance) {
		return Math.toIntExact(Duration.between(shift.getActualStartTime(), shift.getActualEndTime()).toMinutes()
				- attendance.getBreakMinutes());
	}

	private BigDecimal expectedSalary(int workedMinutes, BigDecimal hourlyRate) {
		return hourlyRate.multiply(BigDecimal.valueOf(workedMinutes))
				.divide(BigDecimal.valueOf(60), 2, RoundingMode.HALF_UP);
	}

	private String summaryUrl(long shiftId) {
		return shiftUrl(shiftId) + "/summary";
	}

	private String extractJoinCode(MvcResult result) throws Exception {
		Matcher matcher = JOIN_CODE_PATTERN.matcher(result.getResponse().getContentAsString());
		assertThat(matcher.find()).isTrue();
		return matcher.group(1);
	}
}
