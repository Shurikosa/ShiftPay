package com.shiftpay.mvp.controller;

import com.shiftpay.mvp.TestDataCleaner;
import com.shiftpay.mvp.entity.AttendanceStatus;
import com.shiftpay.mvp.entity.Role;
import com.shiftpay.mvp.entity.ShiftAttendance;
import com.shiftpay.mvp.entity.User;
import com.shiftpay.mvp.repository.ShiftAttendanceRepository;
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
import java.time.OffsetDateTime;
import java.time.ZoneOffset;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

import static org.assertj.core.api.Assertions.assertThat;
import static org.hamcrest.Matchers.hasSize;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@SpringBootTest
@AutoConfigureMockMvc
class AttendanceControllerTests {

	private static final String REGISTER_URL = "/api/v1/auth/register";
	private static final String LOGIN_URL = "/api/v1/auth/login";
	private static final String CREATE_SHIFT_URL = "/api/v1/shifts";
	private static final String JOIN_SHIFT_URL = "/api/v1/shifts/join";
	private static final Pattern ACCESS_TOKEN_PATTERN = Pattern.compile("\"accessToken\":\"([^\"]+)\"");
	private static final Pattern SHIFT_ID_PATTERN = Pattern.compile("\"id\":(\\d+)");
	private static final Pattern JOIN_CODE_PATTERN = Pattern.compile("\"joinCode\":\"([^\"]+)\"");

	@Autowired
	private MockMvc mockMvc;

	@Autowired
	private JdbcTemplate jdbcTemplate;

	@Autowired
	private ShiftAttendanceRepository shiftAttendanceRepository;

	@Autowired
	private UserRepository userRepository;

	@Autowired
	private PasswordEncoder passwordEncoder;

	@BeforeEach
	void setUp() {
		TestDataCleaner.clean(jdbcTemplate);
	}

	@Test
	void workerJoinsOpenShiftWithNormalizedCode() throws Exception {
		String foremanToken = registerAndLogin("foreman@example.com", "FOREMAN");
		CreatedShift shift = createShift(foremanToken, "Open shift");
		String workerToken = registerAndLogin("worker@example.com", "WORKER");

		mockMvc.perform(post(JOIN_SHIFT_URL)
						.header(HttpHeaders.AUTHORIZATION, "Bearer " + workerToken)
						.contentType(MediaType.APPLICATION_JSON)
						.content(joinPayload("  " + shift.joinCode().toLowerCase() + "  ", "15.00")))
				.andExpect(status().isOk())
				.andExpect(jsonPath("$.attendanceId").isNumber())
				.andExpect(jsonPath("$.shiftId").value(shift.id()))
				.andExpect(jsonPath("$.workerId").isNumber())
				.andExpect(jsonPath("$.status").value("JOINED"))
				.andExpect(jsonPath("$.hourlyRate").value(15.00))
				.andExpect(jsonPath("$.*", hasSize(5)));
	}

	@Test
	void duplicateJoinReturnsConflict() throws Exception {
		String foremanToken = registerAndLogin("foreman@example.com", "FOREMAN");
		CreatedShift shift = createShift(foremanToken, "Open shift");
		String workerToken = registerAndLogin("worker@example.com", "WORKER");

		joinShift(workerToken, shift.joinCode(), "15.00").andExpect(status().isOk());

		joinShift(workerToken, shift.joinCode(), "15.00")
				.andExpect(status().isConflict())
				.andExpect(jsonPath("$.status").value(409))
				.andExpect(jsonPath("$.error").value("Conflict"))
				.andExpect(jsonPath("$.message").value("Worker has already joined this shift"))
				.andExpect(jsonPath("$.path").value(JOIN_SHIFT_URL));
	}

	@Test
	void unknownJoinCodeReturnsNotFound() throws Exception {
		String workerToken = registerAndLogin("worker@example.com", "WORKER");

		joinShift(workerToken, "UNKNOWN", "15.00")
				.andExpect(status().isNotFound())
				.andExpect(jsonPath("$.status").value(404))
				.andExpect(jsonPath("$.error").value("Not Found"))
				.andExpect(jsonPath("$.message").value("Shift not found"))
				.andExpect(jsonPath("$.path").value(JOIN_SHIFT_URL));
	}

	@Test
	void workerCannotJoinNonOpenShift() throws Exception {
		String foremanToken = registerAndLogin("foreman@example.com", "FOREMAN");
		CreatedShift shift = createShift(foremanToken, "Active shift");
		startShift(foremanToken, shift.id());
		String workerToken = registerAndLogin("worker@example.com", "WORKER");

		joinShift(workerToken, shift.joinCode(), "15.00")
				.andExpect(status().isConflict())
				.andExpect(jsonPath("$.status").value(409))
				.andExpect(jsonPath("$.error").value("Conflict"))
				.andExpect(jsonPath("$.message").value("Workers can only join shifts with status OPEN"))
				.andExpect(jsonPath("$.path").value(JOIN_SHIFT_URL));
	}

	@Test
	void negativeHourlyRateReturnsBadRequest() throws Exception {
		String foremanToken = registerAndLogin("foreman@example.com", "FOREMAN");
		CreatedShift shift = createShift(foremanToken, "Open shift");
		String workerToken = registerAndLogin("worker@example.com", "WORKER");

		joinShift(workerToken, shift.joinCode(), "-0.01")
				.andExpect(status().isBadRequest())
				.andExpect(jsonPath("$.status").value(400))
				.andExpect(jsonPath("$.error").value("Bad Request"))
				.andExpect(jsonPath("$.path").value(JOIN_SHIFT_URL));
	}

	@Test
	void foremanCannotJoinShift() throws Exception {
		String foremanToken = registerAndLogin("foreman@example.com", "FOREMAN");
		CreatedShift shift = createShift(foremanToken, "Open shift");

		joinShift(foremanToken, shift.joinCode(), "15.00")
				.andExpect(status().isForbidden())
				.andExpect(jsonPath("$.status").value(403))
				.andExpect(jsonPath("$.error").value("Forbidden"))
				.andExpect(jsonPath("$.message").value("Forbidden"))
				.andExpect(jsonPath("$.path").value(JOIN_SHIFT_URL));
	}

	@Test
	void adminCannotJoinShift() throws Exception {
		String foremanToken = registerAndLogin("foreman@example.com", "FOREMAN");
		CreatedShift shift = createShift(foremanToken, "Open shift");
		String adminToken = createAdminAndLogin();

		joinShift(adminToken, shift.joinCode(), "15.00")
				.andExpect(status().isForbidden())
				.andExpect(jsonPath("$.status").value(403))
				.andExpect(jsonPath("$.error").value("Forbidden"))
				.andExpect(jsonPath("$.message").value("Forbidden"))
				.andExpect(jsonPath("$.path").value(JOIN_SHIFT_URL));
	}

	@Test
	void missingTokenCannotJoinShift() throws Exception {
		mockMvc.perform(post(JOIN_SHIFT_URL)
						.contentType(MediaType.APPLICATION_JSON)
						.content(joinPayload("ABCD12", "15.00")))
				.andExpect(status().isUnauthorized())
				.andExpect(jsonPath("$.status").value(401))
				.andExpect(jsonPath("$.error").value("Unauthorized"))
				.andExpect(jsonPath("$.message").value("Unauthorized"))
				.andExpect(jsonPath("$.path").value(JOIN_SHIFT_URL));
	}

	@Test
	void invalidTokenCannotJoinShift() throws Exception {
		mockMvc.perform(post(JOIN_SHIFT_URL)
						.header(HttpHeaders.AUTHORIZATION, "Bearer invalid-token")
						.contentType(MediaType.APPLICATION_JSON)
						.content(joinPayload("ABCD12", "15.00")))
				.andExpect(status().isUnauthorized())
				.andExpect(jsonPath("$.status").value(401))
				.andExpect(jsonPath("$.error").value("Unauthorized"))
				.andExpect(jsonPath("$.message").value("Unauthorized"))
				.andExpect(jsonPath("$.path").value(JOIN_SHIFT_URL));
	}

	@Test
	void joinPersistsAttendanceData() throws Exception {
		String foremanToken = registerAndLogin("foreman@example.com", "FOREMAN");
		CreatedShift shift = createShift(foremanToken, "Open shift");
		String workerToken = registerAndLogin("worker@example.com", "WORKER");
		User worker = userRepository.findByEmail("worker@example.com").orElseThrow();
		OffsetDateTime beforeJoin = OffsetDateTime.now(ZoneOffset.UTC);

		joinShift(workerToken, shift.joinCode(), "15.25").andExpect(status().isOk());

		ShiftAttendance attendance = shiftAttendanceRepository.findAll().getFirst();
		assertThat(shiftAttendanceRepository.count()).isEqualTo(1);
		assertThat(attendance.getShiftSession().getId()).isEqualTo(shift.id());
		assertThat(attendance.getWorker().getId()).isEqualTo(worker.getId());
		assertThat(attendance.getStatus()).isEqualTo(AttendanceStatus.JOINED);
		assertThat(attendance.getHourlyRate()).isEqualByComparingTo(new BigDecimal("15.25"));
		assertThat(attendance.getBreakMinutes()).isEqualTo(60);
		assertThat(attendance.getJoinedAt())
				.isAfterOrEqualTo(beforeJoin)
				.isBeforeOrEqualTo(OffsetDateTime.now(ZoneOffset.UTC));
		assertThat(attendance.getJoinedAt().getOffset()).isEqualTo(ZoneOffset.UTC);
		assertThat(attendance.getWorkedMinutes()).isNull();
		assertThat(attendance.getCalculatedSalary()).isNull();
		assertThat(attendance.getApprovedAt()).isNull();
	}

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

	private CreatedShift createShift(String accessToken, String title) throws Exception {
		MvcResult result = mockMvc.perform(post(CREATE_SHIFT_URL)
						.header(HttpHeaders.AUTHORIZATION, "Bearer " + accessToken)
						.contentType(MediaType.APPLICATION_JSON)
						.content("""
								{
								  "title": "%s",
								  "location": "Cologne",
								  "plannedStartTime": "2026-07-01T08:00:00",
								  "plannedEndTime": "2026-07-01T17:00:00",
								  "defaultBreakMinutes": 60
								}
								""".formatted(title)))
				.andExpect(status().isCreated())
				.andReturn();

		String response = result.getResponse().getContentAsString();
		return new CreatedShift(extractLong(response, SHIFT_ID_PATTERN), extractString(response, JOIN_CODE_PATTERN));
	}

	private void startShift(String accessToken, long shiftId) throws Exception {
		mockMvc.perform(post(CREATE_SHIFT_URL + "/" + shiftId + "/start")
						.header(HttpHeaders.AUTHORIZATION, "Bearer " + accessToken))
				.andExpect(status().isOk());
	}

	private ResultActions joinShift(
			String accessToken,
			String joinCode,
			String hourlyRate
	) throws Exception {
		return mockMvc.perform(post(JOIN_SHIFT_URL)
				.header(HttpHeaders.AUTHORIZATION, "Bearer " + accessToken)
				.contentType(MediaType.APPLICATION_JSON)
				.content(joinPayload(joinCode, hourlyRate)));
	}

	private String joinPayload(String joinCode, String hourlyRate) {
		return """
				{
				  "joinCode": "%s",
				  "hourlyRate": %s
				}
				""".formatted(joinCode, hourlyRate);
	}

	private long extractLong(String response, Pattern pattern) {
		Matcher matcher = pattern.matcher(response);
		assertThat(matcher.find()).isTrue();
		return Long.parseLong(matcher.group(1));
	}

	private String extractString(String response, Pattern pattern) {
		Matcher matcher = pattern.matcher(response);
		assertThat(matcher.find()).isTrue();
		return matcher.group(1);
	}

	private record CreatedShift(long id, String joinCode) {
	}
}
