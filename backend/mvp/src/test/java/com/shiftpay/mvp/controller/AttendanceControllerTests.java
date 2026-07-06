package com.shiftpay.mvp.controller;

import com.shiftpay.mvp.TestDataCleaner;
import com.shiftpay.mvp.entity.AttendanceStatus;
import com.shiftpay.mvp.entity.Role;
import com.shiftpay.mvp.entity.ShiftAttendance;
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
	void workerJoinsOpenShiftWithNormalizedCode() throws Exception {
		String foremanToken = registerAndLogin("foreman@example.com", "FOREMAN");
		CreatedShift shift = createShift(foremanToken, "Open shift", "17.50");
		String workerToken = registerAndLogin("worker@example.com", "WORKER");

		mockMvc.perform(post(JOIN_SHIFT_URL)
						.header(HttpHeaders.AUTHORIZATION, "Bearer " + workerToken)
						.contentType(MediaType.APPLICATION_JSON)
						.content(joinPayload("  " + shift.joinCode().toLowerCase() + "  ")))
				.andExpect(status().isOk())
				.andExpect(jsonPath("$.attendanceId").isNumber())
				.andExpect(jsonPath("$.shiftId").value(shift.id()))
				.andExpect(jsonPath("$.workerId").isNumber())
				.andExpect(jsonPath("$.status").value("JOINED"))
				.andExpect(jsonPath("$.hourlyRate").value(17.50))
				.andExpect(jsonPath("$.*", hasSize(5)));
	}

	@Test
	void duplicateJoinReturnsConflict() throws Exception {
		String foremanToken = registerAndLogin("foreman@example.com", "FOREMAN");
		CreatedShift shift = createShift(foremanToken, "Open shift");
		String workerToken = registerAndLogin("worker@example.com", "WORKER");

		joinShift(workerToken, shift.joinCode()).andExpect(status().isOk());

		joinShift(workerToken, shift.joinCode())
				.andExpect(status().isConflict())
				.andExpect(jsonPath("$.status").value(409))
				.andExpect(jsonPath("$.error").value("Conflict"))
				.andExpect(jsonPath("$.message").value("Worker has already joined this shift"))
				.andExpect(jsonPath("$.path").value(JOIN_SHIFT_URL));
	}

	@Test
	void unknownJoinCodeReturnsNotFound() throws Exception {
		String workerToken = registerAndLogin("worker@example.com", "WORKER");

		joinShift(workerToken, "UNKNOWN")
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

		joinShift(workerToken, shift.joinCode())
				.andExpect(status().isConflict())
				.andExpect(jsonPath("$.status").value(409))
				.andExpect(jsonPath("$.error").value("Conflict"))
				.andExpect(jsonPath("$.message").value("Workers can only join shifts with status OPEN"))
				.andExpect(jsonPath("$.path").value(JOIN_SHIFT_URL));
	}

	@Test
	void workerProvidedHourlyRateCannotOverrideShiftDefault() throws Exception {
		String foremanToken = registerAndLogin("foreman@example.com", "FOREMAN");
		CreatedShift shift = createShift(foremanToken, "Open shift", "18.75");
		String workerToken = registerAndLogin("worker@example.com", "WORKER");

		joinShiftWithClientRate(workerToken, shift.joinCode(), "999.99")
				.andExpect(status().isOk())
				.andExpect(jsonPath("$.hourlyRate").value(18.75));

		ShiftAttendance attendance = shiftAttendanceRepository.findAll().getFirst();
		assertThat(attendance.getHourlyRate()).isEqualByComparingTo(new BigDecimal("18.75"));
	}

	@Test
	void foremanCannotJoinShift() throws Exception {
		String foremanToken = registerAndLogin("foreman@example.com", "FOREMAN");
		CreatedShift shift = createShift(foremanToken, "Open shift");

		joinShift(foremanToken, shift.joinCode())
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

		joinShift(adminToken, shift.joinCode())
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
						.content(joinPayload("ABCD12")))
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
						.content(joinPayload("ABCD12")))
				.andExpect(status().isUnauthorized())
				.andExpect(jsonPath("$.status").value(401))
				.andExpect(jsonPath("$.error").value("Unauthorized"))
				.andExpect(jsonPath("$.message").value("Unauthorized"))
				.andExpect(jsonPath("$.path").value(JOIN_SHIFT_URL));
	}

	@Test
	void joinPersistsAttendanceData() throws Exception {
		String foremanToken = registerAndLogin("foreman@example.com", "FOREMAN");
		CreatedShift shift = createShift(foremanToken, "Open shift", "16.40");
		String workerToken = registerAndLogin("worker@example.com", "WORKER");
		User worker = userRepository.findByEmail("worker@example.com").orElseThrow();
		OffsetDateTime beforeJoin = OffsetDateTime.now(ZoneOffset.UTC);

		joinShift(workerToken, shift.joinCode()).andExpect(status().isOk());

		ShiftAttendance attendance = shiftAttendanceRepository.findAll().getFirst();
		assertThat(shiftAttendanceRepository.count()).isEqualTo(1);
		assertThat(attendance.getShiftSession().getId()).isEqualTo(shift.id());
		assertThat(attendance.getWorker().getId()).isEqualTo(worker.getId());
		assertThat(attendance.getStatus()).isEqualTo(AttendanceStatus.JOINED);
		assertThat(attendance.getHourlyRate()).isEqualByComparingTo(new BigDecimal("16.40"));
		assertThat(attendance.getBreakMinutes()).isEqualTo(60);
		assertThat(attendance.getJoinedAt())
				.isAfterOrEqualTo(beforeJoin)
				.isBeforeOrEqualTo(OffsetDateTime.now(ZoneOffset.UTC));
		assertThat(attendance.getJoinedAt().getOffset()).isEqualTo(ZoneOffset.UTC);
		assertThat(attendance.getWorkedMinutes()).isNull();
		assertThat(attendance.getCalculatedSalary()).isNull();
		assertThat(attendance.getApprovedAt()).isNull();
	}

	@Test
	void ownerForemanApprovesAttendanceWithoutOverrideAndKeepsSnapshotRate() throws Exception {
		String foremanToken = registerAndLogin("foreman@example.com", "FOREMAN");
		CreatedShift shift = createShift(foremanToken, "Open shift", "16.75");
		String workerToken = registerAndLogin("worker@example.com", "WORKER");
		long attendanceId = joinAndGetAttendanceId(workerToken, shift.joinCode());
		OffsetDateTime beforeApproval = OffsetDateTime.now(ZoneOffset.UTC);

		approveAttendance(foremanToken, shift.id(), attendanceId, null)
				.andExpect(status().isOk())
				.andExpect(jsonPath("$.attendanceId").value(attendanceId))
				.andExpect(jsonPath("$.status").value("APPROVED"))
				.andExpect(jsonPath("$.hourlyRate").value(16.75))
				.andExpect(jsonPath("$.approvedAt").isString())
				.andExpect(jsonPath("$.*", hasSize(4)));

		ShiftAttendance attendance = shiftAttendanceRepository.findById(attendanceId).orElseThrow();
		assertThat(attendance.getStatus()).isEqualTo(AttendanceStatus.APPROVED);
		assertThat(attendance.getHourlyRate()).isEqualByComparingTo("16.75");
		assertThat(attendance.getApprovedAt())
				.isAfterOrEqualTo(beforeApproval)
				.isBeforeOrEqualTo(OffsetDateTime.now(ZoneOffset.UTC));
		assertThat(attendance.getApprovedAt().getOffset()).isEqualTo(ZoneOffset.UTC);
	}

	@Test
	void emptyApprovalRequestKeepsSnapshotRate() throws Exception {
		String foremanToken = registerAndLogin("foreman@example.com", "FOREMAN");
		CreatedShift shift = createShift(foremanToken, "Open shift", "19.25");
		String workerToken = registerAndLogin("worker@example.com", "WORKER");
		long attendanceId = joinAndGetAttendanceId(workerToken, shift.joinCode());

		approveAttendance(foremanToken, shift.id(), attendanceId, "{}")
				.andExpect(status().isOk())
				.andExpect(jsonPath("$.hourlyRate").value(19.25));

		assertThat(shiftAttendanceRepository.findById(attendanceId).orElseThrow().getHourlyRate())
				.isEqualByComparingTo("19.25");
	}

	@Test
	void foremanCanOverrideOnlyApprovedAttendanceRate() throws Exception {
		String foremanToken = registerAndLogin("foreman@example.com", "FOREMAN");
		CreatedShift shift = createShift(foremanToken, "Open shift", "15.00");
		String firstWorkerToken = registerAndLogin("first.worker@example.com", "WORKER");
		String secondWorkerToken = registerAndLogin("second.worker@example.com", "WORKER");
		long approvedAttendanceId = joinAndGetAttendanceId(firstWorkerToken, shift.joinCode());
		long untouchedAttendanceId = joinAndGetAttendanceId(secondWorkerToken, shift.joinCode());

		approveAttendance(foremanToken, shift.id(), approvedAttendanceId, """
				{
				  "hourlyRate": 18.50
				}
				""")
				.andExpect(status().isOk())
				.andExpect(jsonPath("$.attendanceId").value(approvedAttendanceId))
				.andExpect(jsonPath("$.status").value("APPROVED"))
				.andExpect(jsonPath("$.hourlyRate").value(18.50));

		assertThat(shiftAttendanceRepository.findById(approvedAttendanceId).orElseThrow().getHourlyRate())
				.isEqualByComparingTo("18.50");
		assertThat(shiftAttendanceRepository.findById(untouchedAttendanceId).orElseThrow().getHourlyRate())
				.isEqualByComparingTo("15.00");
		assertThat(shiftSessionRepository.findById(shift.id()).orElseThrow().getDefaultHourlyRate())
				.isEqualByComparingTo("15.00");
	}

	@Test
	void adminApprovesAttendanceForAnyShift() throws Exception {
		String foremanToken = registerAndLogin("foreman@example.com", "FOREMAN");
		CreatedShift shift = createShift(foremanToken, "Open shift");
		String workerToken = registerAndLogin("worker@example.com", "WORKER");
		long attendanceId = joinAndGetAttendanceId(workerToken, shift.joinCode());
		String adminToken = createAdminAndLogin();

		approveAttendance(adminToken, shift.id(), attendanceId, "{\"hourlyRate\": 20.00}")
				.andExpect(status().isOk())
				.andExpect(jsonPath("$.attendanceId").value(attendanceId))
				.andExpect(jsonPath("$.status").value("APPROVED"))
				.andExpect(jsonPath("$.hourlyRate").value(20.00));
	}

	@Test
	void workerCannotApproveAttendance() throws Exception {
		String foremanToken = registerAndLogin("foreman@example.com", "FOREMAN");
		CreatedShift shift = createShift(foremanToken, "Open shift");
		String workerToken = registerAndLogin("worker@example.com", "WORKER");
		long attendanceId = joinAndGetAttendanceId(workerToken, shift.joinCode());
		String approvalUrl = approvalUrl(shift.id(), attendanceId);

		approveAttendance(workerToken, shift.id(), attendanceId, "{}")
				.andExpect(status().isForbidden())
				.andExpect(jsonPath("$.status").value(403))
				.andExpect(jsonPath("$.error").value("Forbidden"))
				.andExpect(jsonPath("$.message").value("Forbidden"))
				.andExpect(jsonPath("$.path").value(approvalUrl));
	}

	@Test
	void nonOwnerForemanCannotApproveAttendance() throws Exception {
		String ownerToken = registerAndLogin("owner@example.com", "FOREMAN");
		CreatedShift shift = createShift(ownerToken, "Open shift");
		String workerToken = registerAndLogin("worker@example.com", "WORKER");
		long attendanceId = joinAndGetAttendanceId(workerToken, shift.joinCode());
		String anotherForemanToken = registerAndLogin("another@example.com", "FOREMAN");
		String approvalUrl = approvalUrl(shift.id(), attendanceId);

		approveAttendance(anotherForemanToken, shift.id(), attendanceId, "{}")
				.andExpect(status().isForbidden())
				.andExpect(jsonPath("$.status").value(403))
				.andExpect(jsonPath("$.error").value("Forbidden"))
				.andExpect(jsonPath("$.message").value("Forbidden"))
				.andExpect(jsonPath("$.path").value(approvalUrl));
	}

	@Test
	void missingTokenCannotApproveAttendance() throws Exception {
		String approvalUrl = approvalUrl(1, 1);

		mockMvc.perform(post(approvalUrl)
						.contentType(MediaType.APPLICATION_JSON)
						.content("{}"))
				.andExpect(status().isUnauthorized())
				.andExpect(jsonPath("$.status").value(401))
				.andExpect(jsonPath("$.error").value("Unauthorized"))
				.andExpect(jsonPath("$.message").value("Unauthorized"))
				.andExpect(jsonPath("$.path").value(approvalUrl));
	}

	@Test
	void invalidTokenCannotApproveAttendance() throws Exception {
		String approvalUrl = approvalUrl(1, 1);

		mockMvc.perform(post(approvalUrl)
						.header(HttpHeaders.AUTHORIZATION, "Bearer invalid-token")
						.contentType(MediaType.APPLICATION_JSON)
						.content("{}"))
				.andExpect(status().isUnauthorized())
				.andExpect(jsonPath("$.status").value(401))
				.andExpect(jsonPath("$.error").value("Unauthorized"))
				.andExpect(jsonPath("$.message").value("Unauthorized"))
				.andExpect(jsonPath("$.path").value(approvalUrl));
	}

	@Test
	void unknownShiftCannotHaveAttendanceApproved() throws Exception {
		String foremanToken = registerAndLogin("foreman@example.com", "FOREMAN");
		String approvalUrl = approvalUrl(999999, 1);

		approveAttendance(foremanToken, 999999, 1, "{}")
				.andExpect(status().isNotFound())
				.andExpect(jsonPath("$.status").value(404))
				.andExpect(jsonPath("$.error").value("Not Found"))
				.andExpect(jsonPath("$.message").value("Shift not found"))
				.andExpect(jsonPath("$.path").value(approvalUrl));
	}

	@Test
	void unknownAttendanceReturnsNotFound() throws Exception {
		String foremanToken = registerAndLogin("foreman@example.com", "FOREMAN");
		CreatedShift shift = createShift(foremanToken, "Open shift");
		String approvalUrl = approvalUrl(shift.id(), 999999);

		approveAttendance(foremanToken, shift.id(), 999999, "{}")
				.andExpect(status().isNotFound())
				.andExpect(jsonPath("$.status").value(404))
				.andExpect(jsonPath("$.error").value("Not Found"))
				.andExpect(jsonPath("$.message").value("Attendance not found"))
				.andExpect(jsonPath("$.path").value(approvalUrl));
	}

	@Test
	void attendanceFromAnotherShiftReturnsNotFound() throws Exception {
		String foremanToken = registerAndLogin("foreman@example.com", "FOREMAN");
		CreatedShift firstShift = createShift(foremanToken, "First shift");
		CreatedShift secondShift = createShift(foremanToken, "Second shift");
		String workerToken = registerAndLogin("worker@example.com", "WORKER");
		long attendanceId = joinAndGetAttendanceId(workerToken, firstShift.joinCode());
		String approvalUrl = approvalUrl(secondShift.id(), attendanceId);

		approveAttendance(foremanToken, secondShift.id(), attendanceId, "{}")
				.andExpect(status().isNotFound())
				.andExpect(jsonPath("$.status").value(404))
				.andExpect(jsonPath("$.error").value("Not Found"))
				.andExpect(jsonPath("$.message").value("Attendance not found"))
				.andExpect(jsonPath("$.path").value(approvalUrl));
	}

	@Test
	void attendanceCannotBeApprovedForActiveShift() throws Exception {
		String foremanToken = registerAndLogin("foreman@example.com", "FOREMAN");
		CreatedShift shift = createShift(foremanToken, "Open shift");
		String workerToken = registerAndLogin("worker@example.com", "WORKER");
		long attendanceId = joinAndGetAttendanceId(workerToken, shift.joinCode());
		startShift(foremanToken, shift.id());
		String approvalUrl = approvalUrl(shift.id(), attendanceId);

		approveAttendance(foremanToken, shift.id(), attendanceId, "{}")
				.andExpect(status().isConflict())
				.andExpect(jsonPath("$.status").value(409))
				.andExpect(jsonPath("$.error").value("Conflict"))
				.andExpect(jsonPath("$.message")
						.value("Attendance can only be approved while shift status is OPEN"))
				.andExpect(jsonPath("$.path").value(approvalUrl));
	}

	@Test
	void attendanceCannotBeApprovedForClosedShift() throws Exception {
		String foremanToken = registerAndLogin("foreman@example.com", "FOREMAN");
		CreatedShift shift = createShift(foremanToken, "Open shift");
		String workerToken = registerAndLogin("worker@example.com", "WORKER");
		long attendanceId = joinAndGetAttendanceId(workerToken, shift.joinCode());
		startShift(foremanToken, shift.id());
		closeShift(foremanToken, shift.id());

		approveAttendance(foremanToken, shift.id(), attendanceId, "{}")
				.andExpect(status().isConflict())
				.andExpect(jsonPath("$.status").value(409))
				.andExpect(jsonPath("$.message")
						.value("Attendance can only be approved while shift status is OPEN"));
	}

	@Test
	void repeatedApprovalReturnsConflict() throws Exception {
		String foremanToken = registerAndLogin("foreman@example.com", "FOREMAN");
		CreatedShift shift = createShift(foremanToken, "Open shift");
		String workerToken = registerAndLogin("worker@example.com", "WORKER");
		long attendanceId = joinAndGetAttendanceId(workerToken, shift.joinCode());

		approveAttendance(foremanToken, shift.id(), attendanceId, "{}")
				.andExpect(status().isOk());

		approveAttendance(foremanToken, shift.id(), attendanceId, "{}")
				.andExpect(status().isConflict())
				.andExpect(jsonPath("$.status").value(409))
				.andExpect(jsonPath("$.error").value("Conflict"))
				.andExpect(jsonPath("$.message")
						.value("Attendance can only be approved when status is JOINED"));
	}

	@Test
	void nonJoinedAttendanceCannotBeApproved() throws Exception {
		String foremanToken = registerAndLogin("foreman@example.com", "FOREMAN");
		CreatedShift shift = createShift(foremanToken, "Open shift");
		String workerToken = registerAndLogin("worker@example.com", "WORKER");
		long attendanceId = joinAndGetAttendanceId(workerToken, shift.joinCode());
		ShiftAttendance attendance = shiftAttendanceRepository.findById(attendanceId).orElseThrow();
		attendance.setStatus(AttendanceStatus.REJECTED);
		shiftAttendanceRepository.saveAndFlush(attendance);

		approveAttendance(foremanToken, shift.id(), attendanceId, "{}")
				.andExpect(status().isConflict())
				.andExpect(jsonPath("$.status").value(409))
				.andExpect(jsonPath("$.message")
						.value("Attendance can only be approved when status is JOINED"));
	}

	@Test
	void negativeApprovalRateReturnsBadRequest() throws Exception {
		String foremanToken = registerAndLogin("foreman@example.com", "FOREMAN");
		CreatedShift shift = createShift(foremanToken, "Open shift");
		String workerToken = registerAndLogin("worker@example.com", "WORKER");
		long attendanceId = joinAndGetAttendanceId(workerToken, shift.joinCode());
		String approvalUrl = approvalUrl(shift.id(), attendanceId);

		approveAttendance(foremanToken, shift.id(), attendanceId, "{\"hourlyRate\": -0.01}")
				.andExpect(status().isBadRequest())
				.andExpect(jsonPath("$.status").value(400))
				.andExpect(jsonPath("$.error").value("Bad Request"))
				.andExpect(jsonPath("$.path").value(approvalUrl));
	}

	@Test
	void approvalRateWithTooManyDecimalPlacesReturnsBadRequest() throws Exception {
		String foremanToken = registerAndLogin("foreman@example.com", "FOREMAN");
		CreatedShift shift = createShift(foremanToken, "Open shift");
		String workerToken = registerAndLogin("worker@example.com", "WORKER");
		long attendanceId = joinAndGetAttendanceId(workerToken, shift.joinCode());
		String approvalUrl = approvalUrl(shift.id(), attendanceId);

		approveAttendance(foremanToken, shift.id(), attendanceId, "{\"hourlyRate\": 18.501}")
				.andExpect(status().isBadRequest())
				.andExpect(jsonPath("$.status").value(400))
				.andExpect(jsonPath("$.error").value("Bad Request"))
				.andExpect(jsonPath("$.path").value(approvalUrl));
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
		return createShift(accessToken, title, "15.25");
	}

	private CreatedShift createShift(String accessToken, String title, String defaultHourlyRate) throws Exception {
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
								  "defaultHourlyRate": %s
								}
								""".formatted(title, defaultHourlyRate)))
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

	private void closeShift(String accessToken, long shiftId) throws Exception {
		mockMvc.perform(post(CREATE_SHIFT_URL + "/" + shiftId + "/close")
						.header(HttpHeaders.AUTHORIZATION, "Bearer " + accessToken))
				.andExpect(status().isOk());
	}

	private ResultActions joinShift(String accessToken, String joinCode) throws Exception {
		return mockMvc.perform(post(JOIN_SHIFT_URL)
				.header(HttpHeaders.AUTHORIZATION, "Bearer " + accessToken)
				.contentType(MediaType.APPLICATION_JSON)
				.content(joinPayload(joinCode)));
	}

	private ResultActions joinShiftWithClientRate(String accessToken, String joinCode, String hourlyRate)
			throws Exception {
		return mockMvc.perform(post(JOIN_SHIFT_URL)
				.header(HttpHeaders.AUTHORIZATION, "Bearer " + accessToken)
				.contentType(MediaType.APPLICATION_JSON)
				.content("""
						{
						  "joinCode": "%s",
						  "hourlyRate": %s
						}
						""".formatted(joinCode, hourlyRate)));
	}

	private long joinAndGetAttendanceId(String accessToken, String joinCode) throws Exception {
		MvcResult result = joinShift(accessToken, joinCode)
				.andExpect(status().isOk())
				.andReturn();
		return extractLong(result.getResponse().getContentAsString(), ATTENDANCE_ID_PATTERN);
	}

	private ResultActions approveAttendance(
			String accessToken,
			long shiftId,
			long attendanceId,
			String payload
	) throws Exception {
		var request = post(approvalUrl(shiftId, attendanceId))
				.header(HttpHeaders.AUTHORIZATION, "Bearer " + accessToken);
		if (payload != null) {
			request.contentType(MediaType.APPLICATION_JSON).content(payload);
		}
		return mockMvc.perform(request);
	}

	private String approvalUrl(long shiftId, long attendanceId) {
		return CREATE_SHIFT_URL + "/" + shiftId + "/attendance/" + attendanceId + "/approve";
	}

	private String joinPayload(String joinCode) {
		return """
				{
				  "joinCode": "%s"
				}
				""".formatted(joinCode);
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
