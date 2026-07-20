package com.shiftpay.mvp.controller;

import com.shiftpay.mvp.TestDataCleaner;
import com.shiftpay.mvp.entity.AttendanceStatus;
import com.shiftpay.mvp.entity.Role;
import com.shiftpay.mvp.entity.ShiftAttendance;
import com.shiftpay.mvp.entity.ShiftSession;
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
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/**
 * Controller integration tests for attendance and personal shift-history endpoints.
 *
 * <p>The class covers worker joins, attendance listing, approval rules, hourly-rate snapshots and overrides,
 * role/ownership authorization, current-user shift history, sorting, salary field visibility, and DTO safety around
 * user entity data.</p>
 */
@SpringBootTest
@AutoConfigureMockMvc
class AttendanceControllerTests {

	private static final String REGISTER_URL = "/api/v1/auth/register";
	private static final String LOGIN_URL = "/api/v1/auth/login";
	private static final String CREATE_SHIFT_URL = "/api/v1/shifts";
	private static final String JOIN_SHIFT_URL = "/api/v1/shifts/join";
	private static final String MY_SHIFT_HISTORY_URL = "/api/v1/me/shifts";
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
	 * Clears all mutable data before each attendance scenario so join conflicts, ordering, and ownership are isolated.
	 */
	@BeforeEach
	void setUp() {
		TestDataCleaner.clean(jdbcTemplate);
	}

	/**
	 * Joins an OPEN shift as WORKER using a lower-case, padded join code and expects the normalized lookup to succeed.
	 */
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

	/**
	 * Has the same worker join the same shift twice and expects the duplicate attendance rule to return 409.
	 */
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

	/**
	 * Uses a join code that belongs to no shift and expects the join endpoint to return shift not found.
	 */
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

	/**
	 * Starts the shift before joining and expects workers to be blocked once the shift is no longer OPEN.
	 */
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

	/**
	 * Sends an extra hourlyRate field from the worker and expects the server to ignore it and keep the shift default.
	 */
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

	/**
	 * Attempts to join through the worker-only endpoint as FOREMAN and expects role authorization to return 403.
	 */
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

	/**
	 * Attempts to join through the worker-only endpoint as ADMIN and expects role authorization to return 403.
	 */
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

	/**
	 * Calls join without JWT and expects the security layer to return the standard 401 body.
	 */
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

	/**
	 * Calls join with a malformed Bearer token and expects JWT validation to reject the request.
	 */
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

	/**
	 * Verifies a successful join persists worker, shift, status, rate snapshot, break minutes, UTC joinedAt, and empty
	 * salary fields.
	 */
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

	/**
	 * Lists attendance as the owner FOREMAN and expects joinedAt/id ordering plus worker identity fields without
	 * exposing User entities or password data.
	 */
	@Test
	void ownerForemanGetsSortedAttendanceWithoutUserEntityFields() throws Exception {
		String foremanToken = registerAndLogin("foreman@example.com", "FOREMAN");
		CreatedShift shift = createShift(foremanToken, "Open shift", "15.00");
		String firstWorkerToken = registerAndLogin(
				"first.worker@example.com",
				"WORKER",
				"John",
				"Worker"
		);
		String secondWorkerToken = registerAndLogin(
				"second.worker@example.com",
				"WORKER",
				"Alice",
				"Builder"
		);
		String thirdWorkerToken = registerAndLogin(
				"third.worker@example.com",
				"WORKER",
				"Maria",
				"Stone"
		);
		long firstAttendanceId = joinAndGetAttendanceId(firstWorkerToken, shift.joinCode());
		long secondAttendanceId = joinAndGetAttendanceId(secondWorkerToken, shift.joinCode());
		long thirdAttendanceId = joinAndGetAttendanceId(thirdWorkerToken, shift.joinCode());
		OffsetDateTime sharedJoinedAt = OffsetDateTime.parse("2026-07-06T18:00:00Z");
		setJoinedAt(firstAttendanceId, sharedJoinedAt);
		setJoinedAt(secondAttendanceId, sharedJoinedAt.minusMinutes(1));
		setJoinedAt(thirdAttendanceId, sharedJoinedAt);

		mockMvc.perform(get(attendanceUrl(shift.id()))
						.header(HttpHeaders.AUTHORIZATION, "Bearer " + foremanToken))
				.andExpect(status().isOk())
				.andExpect(jsonPath("$", hasSize(3)))
				.andExpect(jsonPath("$[0].attendanceId").value(secondAttendanceId))
				.andExpect(jsonPath("$[1].attendanceId").value(firstAttendanceId))
				.andExpect(jsonPath("$[2].attendanceId").value(thirdAttendanceId))
				.andExpect(jsonPath("$[1].workerId").isNumber())
				.andExpect(jsonPath("$[1].firstName").value("John"))
				.andExpect(jsonPath("$[1].lastName").value("Worker"))
				.andExpect(jsonPath("$[1].status").value("JOINED"))
				.andExpect(jsonPath("$[1].hourlyRate").value(15.00))
				.andExpect(jsonPath("$[1].breakMinutes").value(60))
				.andExpect(jsonPath("$[1].workedMinutes").value((Object) null))
				.andExpect(jsonPath("$[1].calculatedSalary").value((Object) null))
				.andExpect(jsonPath("$[1].joinedAt").value("2026-07-06T18:00:00Z"))
				.andExpect(jsonPath("$[1].approvedAt").value((Object) null))
				.andExpect(jsonPath("$[1].*", hasSize(11)))
				.andExpect(jsonPath("$[1].passwordHash").doesNotExist())
				.andExpect(jsonPath("$[1].worker").doesNotExist())
				.andExpect(jsonPath("$[1].email").doesNotExist());
	}

	/**
	 * Reads attendance as ADMIN for a foreman-owned shift and expects global management access.
	 */
	@Test
	void adminGetsAttendanceForAnyShift() throws Exception {
		String foremanToken = registerAndLogin("foreman@example.com", "FOREMAN");
		CreatedShift shift = createShift(foremanToken, "Open shift");
		String workerToken = registerAndLogin("worker@example.com", "WORKER");
		long attendanceId = joinAndGetAttendanceId(workerToken, shift.joinCode());
		String adminToken = createAdminAndLogin();

		mockMvc.perform(get(attendanceUrl(shift.id()))
						.header(HttpHeaders.AUTHORIZATION, "Bearer " + adminToken))
				.andExpect(status().isOk())
				.andExpect(jsonPath("$", hasSize(1)))
				.andExpect(jsonPath("$[0].attendanceId").value(attendanceId));
	}

	/**
	 * Confirms attendance listing works across OPEN, ACTIVE, and CLOSED shift states.
	 */
	@Test
	void attendanceListWorksForOpenActiveAndClosedShifts() throws Exception {
		String foremanToken = registerAndLogin("foreman@example.com", "FOREMAN");
		CreatedShift openShift = createShift(foremanToken, "Open shift");
		CreatedShift activeShift = createShift(foremanToken, "Active shift");
		CreatedShift closedShift = createShift(foremanToken, "Closed shift");
		String workerToken = registerAndLogin("worker@example.com", "WORKER");
		joinAndGetAttendanceId(workerToken, openShift.joinCode());
		joinAndGetAttendanceId(workerToken, activeShift.joinCode());
		joinAndGetAttendanceId(workerToken, closedShift.joinCode());
		startShift(foremanToken, activeShift.id());
		startShift(foremanToken, closedShift.id());
		closeShift(foremanToken, closedShift.id());

		for (CreatedShift shift : new CreatedShift[] {openShift, activeShift, closedShift}) {
			mockMvc.perform(get(attendanceUrl(shift.id()))
							.header(HttpHeaders.AUTHORIZATION, "Bearer " + foremanToken))
					.andExpect(status().isOk())
					.andExpect(jsonPath("$", hasSize(1)));
		}
	}

	/**
	 * Attempts attendance listing as a non-owner FOREMAN and expects ownership checks to return 403.
	 */
	@Test
	void anotherForemanCannotGetAttendance() throws Exception {
		String ownerToken = registerAndLogin("owner@example.com", "FOREMAN");
		CreatedShift shift = createShift(ownerToken, "Open shift");
		String anotherForemanToken = registerAndLogin("another@example.com", "FOREMAN");

		mockMvc.perform(get(attendanceUrl(shift.id()))
						.header(HttpHeaders.AUTHORIZATION, "Bearer " + anotherForemanToken))
				.andExpect(status().isForbidden())
				.andExpect(jsonPath("$.status").value(403))
				.andExpect(jsonPath("$.error").value("Forbidden"))
				.andExpect(jsonPath("$.message").value("Forbidden"))
				.andExpect(jsonPath("$.path").value(attendanceUrl(shift.id())));
	}

	/**
	 * Attempts attendance listing as WORKER and expects role-based authorization to reject the request.
	 */
	@Test
	void workerCannotGetAttendance() throws Exception {
		String foremanToken = registerAndLogin("foreman@example.com", "FOREMAN");
		CreatedShift shift = createShift(foremanToken, "Open shift");
		String workerToken = registerAndLogin("worker@example.com", "WORKER");

		mockMvc.perform(get(attendanceUrl(shift.id()))
						.header(HttpHeaders.AUTHORIZATION, "Bearer " + workerToken))
				.andExpect(status().isForbidden())
				.andExpect(jsonPath("$.status").value(403))
				.andExpect(jsonPath("$.error").value("Forbidden"))
				.andExpect(jsonPath("$.message").value("Forbidden"))
				.andExpect(jsonPath("$.path").value(attendanceUrl(shift.id())));
	}

	/**
	 * Calls attendance listing without JWT and expects a 401 response.
	 */
	@Test
	void missingTokenCannotGetAttendance() throws Exception {
		mockMvc.perform(get(attendanceUrl(1)))
				.andExpect(status().isUnauthorized())
				.andExpect(jsonPath("$.status").value(401))
				.andExpect(jsonPath("$.error").value("Unauthorized"))
				.andExpect(jsonPath("$.message").value("Unauthorized"))
				.andExpect(jsonPath("$.path").value(attendanceUrl(1)));
	}

	/**
	 * Calls attendance listing with an invalid JWT and expects token validation to return 401.
	 */
	@Test
	void invalidTokenCannotGetAttendance() throws Exception {
		mockMvc.perform(get(attendanceUrl(1))
						.header(HttpHeaders.AUTHORIZATION, "Bearer invalid-token"))
				.andExpect(status().isUnauthorized())
				.andExpect(jsonPath("$.status").value(401))
				.andExpect(jsonPath("$.error").value("Unauthorized"))
				.andExpect(jsonPath("$.message").value("Unauthorized"))
				.andExpect(jsonPath("$.path").value(attendanceUrl(1)));
	}

	/**
	 * Requests attendance for a missing shift as an allowed role and expects a 404 shift-not-found response.
	 */
	@Test
	void unknownShiftAttendanceReturnsNotFound() throws Exception {
		String foremanToken = registerAndLogin("foreman@example.com", "FOREMAN");

		mockMvc.perform(get(attendanceUrl(999999))
						.header(HttpHeaders.AUTHORIZATION, "Bearer " + foremanToken))
				.andExpect(status().isNotFound())
				.andExpect(jsonPath("$.status").value(404))
				.andExpect(jsonPath("$.error").value("Not Found"))
				.andExpect(jsonPath("$.message").value("Shift not found"))
				.andExpect(jsonPath("$.path").value(attendanceUrl(999999)));
	}

	/**
	 * Approves JOINED attendance as owner FOREMAN without a rate override and expects the join-time rate snapshot to
	 * remain unchanged.
	 */
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

	/**
	 * Sends an empty approval JSON body and expects approval to keep the attendance hourly-rate snapshot.
	 */
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

	/**
	 * Approves one worker with an attendance-specific rate override and verifies other attendance plus shift default
	 * are not changed.
	 */
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

	/**
	 * Approves attendance as ADMIN for a shift created by a foreman and expects the override to be accepted.
	 */
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

	/**
	 * Attempts approval as WORKER and expects role-based authorization to return 403.
	 */
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

	/**
	 * Attempts approval as a different FOREMAN and expects shift ownership checks to return 403.
	 */
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

	/**
	 * Calls approval without JWT and expects Unauthorized before attendance lookup.
	 */
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

	/**
	 * Calls approval with an invalid JWT and expects the security filter to return 401.
	 */
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

	/**
	 * Attempts approval for a missing shift and expects a 404 shift-not-found response.
	 */
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

	/**
	 * Attempts approval with an unknown attendance id on an existing shift and expects 404.
	 */
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

	/**
	 * Uses an attendance id from another shift and expects the shift/id pair lookup to hide the row as not found.
	 */
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

	/**
	 * Starts a shift before approval and expects the OPEN-only approval rule to return 409.
	 */
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

	/**
	 * Closes a shift before approval and expects the same OPEN-only approval rule to reject the request.
	 */
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

	/**
	 * Approves attendance once, then expects a second approval to fail because only JOINED rows can transition.
	 */
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

	/**
	 * Mutates attendance to REJECTED and expects approval to reject non-JOINED statuses.
	 */
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

	/**
	 * Sends a negative attendance-specific hourly rate and expects request validation to return 400.
	 */
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

	/**
	 * Sends an approval hourly rate with too many decimal places and expects validation to return 400.
	 */
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

	/**
	 * Reads worker history and expects only the current worker's attendance, not another worker's row on the same
	 * shift, and no user/entity fields.
	 */
	@Test
	void workerGetsOnlyOwnShiftHistoryWithoutUserEntityFields() throws Exception {
		String foremanToken = registerAndLogin("foreman@example.com", "FOREMAN");
		CreatedShift shift = createShift(foremanToken, "Open history shift", "17.50");
		String workerToken = registerAndLogin("worker@example.com", "WORKER");
		String secondWorkerToken = registerAndLogin("second.worker@example.com", "WORKER");
		long attendanceId = joinAndGetAttendanceId(workerToken, shift.joinCode());
		long secondAttendanceId = joinAndGetAttendanceId(secondWorkerToken, shift.joinCode());

		getMyShiftHistory(workerToken)
				.andExpect(status().isOk())
				.andExpect(jsonPath("$", hasSize(1)))
				.andExpect(jsonPath("$[0].shiftId").value(shift.id()))
				.andExpect(jsonPath("$[0].attendanceId").value(attendanceId))
				.andExpect(jsonPath("$[0].title").value("Open history shift"))
				.andExpect(jsonPath("$[0].location").value("Cologne"))
				.andExpect(jsonPath("$[0].status").value("OPEN"))
				.andExpect(jsonPath("$[0].plannedStartTime").value("2026-07-01T08:00:00Z"))
				.andExpect(jsonPath("$[0].plannedEndTime").value("2026-07-01T17:00:00Z"))
				.andExpect(jsonPath("$[0].actualStartTime").value((Object) null))
				.andExpect(jsonPath("$[0].actualEndTime").value((Object) null))
				.andExpect(jsonPath("$[0].attendanceStatus").value("JOINED"))
				.andExpect(jsonPath("$[0].hourlyRate").value(17.50))
				.andExpect(jsonPath("$[0].breakMinutes").value(60))
				.andExpect(jsonPath("$[0].workedMinutes").value((Object) null))
				.andExpect(jsonPath("$[0].calculatedSalary").value((Object) null))
				.andExpect(jsonPath("$[0].*", hasSize(14)))
				.andExpect(jsonPath("$[0].passwordHash").doesNotExist())
				.andExpect(jsonPath("$[0].user").doesNotExist())
				.andExpect(jsonPath("$[0].worker").doesNotExist())
				.andExpect(jsonPath("$[0].workerId").doesNotExist())
				.andExpect(jsonPath("$[0].email").doesNotExist())
				.andExpect(jsonPath("$[0].firstName").doesNotExist())
				.andExpect(jsonPath("$[0].lastName").doesNotExist())
				.andExpect(jsonPath("$[0].joinCode").doesNotExist())
				.andExpect(jsonPath("$[?(@.attendanceId == %d)]".formatted(secondAttendanceId)).isEmpty());
	}

	/**
	 * Builds OPEN, ACTIVE, CLOSED-approved, and CLOSED-unapproved history rows and expects persisted salary fields
	 * only for the approved closed attendance.
	 */
	@Test
	void myShiftHistoryIncludesOpenActiveAndClosedShiftsWithPersistedSalaryFields() throws Exception {
		String foremanToken = registerAndLogin("foreman@example.com", "FOREMAN");
		CreatedShift openShift = createShift(foremanToken, "Open history shift");
		CreatedShift activeShift = createShift(foremanToken, "Active history shift");
		CreatedShift closedApprovedShift = createShift(foremanToken, "Closed approved history shift");
		CreatedShift closedJoinedShift = createShift(foremanToken, "Closed joined history shift");
		String workerToken = registerAndLogin("worker@example.com", "WORKER");
		long openAttendanceId = joinAndGetAttendanceId(workerToken, openShift.joinCode());
		long activeAttendanceId = joinAndGetAttendanceId(workerToken, activeShift.joinCode());
		long closedApprovedAttendanceId = joinAndGetAttendanceId(workerToken, closedApprovedShift.joinCode());
		long closedJoinedAttendanceId = joinAndGetAttendanceId(workerToken, closedJoinedShift.joinCode());
		setJoinedAt(closedApprovedAttendanceId, OffsetDateTime.parse("2026-07-06T13:00:00Z"));
		setJoinedAt(activeAttendanceId, OffsetDateTime.parse("2026-07-06T12:00:00Z"));
		setJoinedAt(openAttendanceId, OffsetDateTime.parse("2026-07-06T11:00:00Z"));
		setJoinedAt(closedJoinedAttendanceId, OffsetDateTime.parse("2026-07-06T10:00:00Z"));
		approveAttendance(foremanToken, closedApprovedShift.id(), closedApprovedAttendanceId, "{}")
				.andExpect(status().isOk());
		startShift(foremanToken, activeShift.id());
		startShift(foremanToken, closedApprovedShift.id());
		setActualStartTime(closedApprovedShift.id(), OffsetDateTime.now(ZoneOffset.UTC).minusMinutes(180));
		closeShift(foremanToken, closedApprovedShift.id());
		startShift(foremanToken, closedJoinedShift.id());
		setActualStartTime(closedJoinedShift.id(), OffsetDateTime.now(ZoneOffset.UTC).minusMinutes(180));
		closeShift(foremanToken, closedJoinedShift.id());
		ShiftAttendance closedApprovedAttendance = shiftAttendanceRepository
				.findById(closedApprovedAttendanceId)
				.orElseThrow();

		getMyShiftHistory(workerToken)
				.andExpect(status().isOk())
				.andExpect(jsonPath("$", hasSize(4)))
				.andExpect(jsonPath("$[0].shiftId").value(closedApprovedShift.id()))
				.andExpect(jsonPath("$[0].attendanceId").value(closedApprovedAttendanceId))
				.andExpect(jsonPath("$[0].status").value("CLOSED"))
				.andExpect(jsonPath("$[0].actualStartTime").isString())
				.andExpect(jsonPath("$[0].actualEndTime").isString())
				.andExpect(jsonPath("$[0].attendanceStatus").value("APPROVED"))
				.andExpect(jsonPath("$[0].workedMinutes").value(closedApprovedAttendance.getWorkedMinutes()))
				.andExpect(jsonPath("$[0].calculatedSalary")
						.value(closedApprovedAttendance.getCalculatedSalary().doubleValue()))
				.andExpect(jsonPath("$[1].shiftId").value(activeShift.id()))
				.andExpect(jsonPath("$[1].status").value("ACTIVE"))
				.andExpect(jsonPath("$[1].attendanceStatus").value("JOINED"))
				.andExpect(jsonPath("$[1].workedMinutes").value((Object) null))
				.andExpect(jsonPath("$[1].calculatedSalary").value((Object) null))
				.andExpect(jsonPath("$[2].shiftId").value(openShift.id()))
				.andExpect(jsonPath("$[2].status").value("OPEN"))
				.andExpect(jsonPath("$[2].workedMinutes").value((Object) null))
				.andExpect(jsonPath("$[2].calculatedSalary").value((Object) null))
				.andExpect(jsonPath("$[3].shiftId").value(closedJoinedShift.id()))
				.andExpect(jsonPath("$[3].attendanceId").value(closedJoinedAttendanceId))
				.andExpect(jsonPath("$[3].status").value("CLOSED"))
				.andExpect(jsonPath("$[3].attendanceStatus").value("JOINED"))
				.andExpect(jsonPath("$[3].workedMinutes").value((Object) null))
				.andExpect(jsonPath("$[3].calculatedSalary").value((Object) null));
	}

	/**
	 * Sets two joins to the same timestamp and expects history sorting by joinedAt descending, then attendance id
	 * descending.
	 */
	@Test
	void myShiftHistorySortsByJoinedAtDescendingThenAttendanceIdDescending() throws Exception {
		String foremanToken = registerAndLogin("foreman@example.com", "FOREMAN");
		CreatedShift firstShift = createShift(foremanToken, "First same-time shift");
		CreatedShift secondShift = createShift(foremanToken, "Second same-time shift");
		CreatedShift olderShift = createShift(foremanToken, "Older shift");
		String workerToken = registerAndLogin("worker@example.com", "WORKER");
		long firstAttendanceId = joinAndGetAttendanceId(workerToken, firstShift.joinCode());
		long secondAttendanceId = joinAndGetAttendanceId(workerToken, secondShift.joinCode());
		long olderAttendanceId = joinAndGetAttendanceId(workerToken, olderShift.joinCode());
		OffsetDateTime sharedJoinedAt = OffsetDateTime.parse("2026-07-06T18:00:00Z");
		setJoinedAt(firstAttendanceId, sharedJoinedAt);
		setJoinedAt(secondAttendanceId, sharedJoinedAt);
		setJoinedAt(olderAttendanceId, sharedJoinedAt.minusMinutes(1));

		getMyShiftHistory(workerToken)
				.andExpect(status().isOk())
				.andExpect(jsonPath("$", hasSize(3)))
				.andExpect(jsonPath("$[0].attendanceId").value(secondAttendanceId))
				.andExpect(jsonPath("$[1].attendanceId").value(firstAttendanceId))
				.andExpect(jsonPath("$[2].attendanceId").value(olderAttendanceId));
	}

	/**
	 * Calls personal shift history as FOREMAN and ADMIN with no worker-attendance rows and expects an empty list.
	 */
	@Test
	void foremanAndAdminCanGetOwnShiftHistory() throws Exception {
		String foremanToken = registerAndLogin("foreman@example.com", "FOREMAN");
		String adminToken = createAdminAndLogin();

		getMyShiftHistory(foremanToken)
				.andExpect(status().isOk())
				.andExpect(jsonPath("$", hasSize(0)));
		getMyShiftHistory(adminToken)
				.andExpect(status().isOk())
				.andExpect(jsonPath("$", hasSize(0)));
	}

	/**
	 * Seeds a foreman-owned shift plus a foreman attendance row and expects /me/shifts to return only the foreman's
	 * own worker-attendance record, not managed worker attendance.
	 */
	@Test
	void foremanGetsOnlyOwnWorkerAttendanceHistory() throws Exception {
		String foremanToken = registerAndLogin("foreman@example.com", "FOREMAN");
		CreatedShift shift = createShift(foremanToken, "Foreman-owned history shift");
		String workerToken = registerAndLogin("worker@example.com", "WORKER");
		long workerAttendanceId = joinAndGetAttendanceId(workerToken, shift.joinCode());
		User foreman = userRepository.findByEmail("foreman@example.com").orElseThrow();
		long foremanAttendanceId = createAttendanceForUser(
				shift,
				foreman,
				OffsetDateTime.parse("2026-07-06T18:00:00Z")
		);

		getMyShiftHistory(foremanToken)
				.andExpect(status().isOk())
				.andExpect(jsonPath("$", hasSize(1)))
				.andExpect(jsonPath("$[0].shiftId").value(shift.id()))
				.andExpect(jsonPath("$[0].attendanceId").value(foremanAttendanceId))
				.andExpect(jsonPath("$[0].attendanceStatus").value("JOINED"))
				.andExpect(jsonPath("$[?(@.attendanceId == %d)]".formatted(workerAttendanceId)).isEmpty());
	}

	/**
	 * Calls personal shift history without JWT and expects a 401 response.
	 */
	@Test
	void missingTokenCannotGetMyShiftHistory() throws Exception {
		mockMvc.perform(get(MY_SHIFT_HISTORY_URL))
				.andExpect(status().isUnauthorized())
				.andExpect(jsonPath("$.status").value(401))
				.andExpect(jsonPath("$.error").value("Unauthorized"))
				.andExpect(jsonPath("$.message").value("Unauthorized"))
				.andExpect(jsonPath("$.path").value(MY_SHIFT_HISTORY_URL));
	}

	/**
	 * Calls personal shift history with an invalid JWT and expects token validation to return 401.
	 */
	@Test
	void invalidTokenCannotGetMyShiftHistory() throws Exception {
		mockMvc.perform(get(MY_SHIFT_HISTORY_URL)
						.header(HttpHeaders.AUTHORIZATION, "Bearer invalid-token"))
				.andExpect(status().isUnauthorized())
				.andExpect(jsonPath("$.status").value(401))
				.andExpect(jsonPath("$.error").value("Unauthorized"))
				.andExpect(jsonPath("$.message").value("Unauthorized"))
				.andExpect(jsonPath("$.path").value(MY_SHIFT_HISTORY_URL));
	}

	/**
	 * Registers a user with default display names and returns a JWT for authenticated attendance requests.
	 *
	 * @param email email address used for registration and login
	 * @param role role sent to public registration
	 * @return JWT access token
	 */
	private String registerAndLogin(String email, String role) throws Exception {
		return registerAndLogin(email, role, "Test", "User");
	}

	/**
	 * Registers a named test user and logs in with the shared password.
	 *
	 * @param email email address used for the account
	 * @param role role sent to registration
	 * @param firstName first name stored on the user
	 * @param lastName last name stored on the user
	 * @return JWT access token
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
	 * Inserts an ADMIN directly because public registration supports only WORKER and FOREMAN.
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
	 * Logs in an existing test user and extracts the JWT from the JSON response.
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
	 * Creates an OPEN shift with the default test hourly rate.
	 *
	 * @param accessToken JWT for a FOREMAN or ADMIN
	 * @param title shift title
	 * @return shift id and generated join code
	 */
	private CreatedShift createShift(String accessToken, String title) throws Exception {
		return createShift(accessToken, title, "15.25");
	}

	/**
	 * Creates an OPEN shift while allowing tests to control the default hourly rate.
	 *
	 * @param accessToken JWT for a FOREMAN or ADMIN
	 * @param title shift title
	 * @param defaultHourlyRate JSON numeric value for the shift default rate
	 * @return shift id and generated join code
	 */
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

	/**
	 * Starts a shift through the API and asserts success for setup scenarios.
	 *
	 * @param accessToken JWT for a shift manager
	 * @param shiftId target shift id
	 */
	private void startShift(String accessToken, long shiftId) throws Exception {
		mockMvc.perform(post(CREATE_SHIFT_URL + "/" + shiftId + "/start")
						.header(HttpHeaders.AUTHORIZATION, "Bearer " + accessToken))
				.andExpect(status().isOk());
	}

	/**
	 * Closes a shift through the API and asserts success for setup scenarios.
	 *
	 * @param accessToken JWT for a shift manager
	 * @param shiftId target shift id
	 */
	private void closeShift(String accessToken, long shiftId) throws Exception {
		mockMvc.perform(post(CREATE_SHIFT_URL + "/" + shiftId + "/close")
						.header(HttpHeaders.AUTHORIZATION, "Bearer " + accessToken))
				.andExpect(status().isOk());
	}

	/**
	 * Sends a worker join request with a supplied join code.
	 *
	 * @param accessToken JWT for the caller
	 * @param joinCode join code to submit
	 * @return MockMvc result actions for assertions
	 */
	private ResultActions joinShift(String accessToken, String joinCode) throws Exception {
		return mockMvc.perform(post(JOIN_SHIFT_URL)
				.header(HttpHeaders.AUTHORIZATION, "Bearer " + accessToken)
				.contentType(MediaType.APPLICATION_JSON)
				.content(joinPayload(joinCode)));
	}

	/**
	 * Sends a join request that includes an ignored client hourlyRate field.
	 *
	 * @param accessToken JWT for the caller
	 * @param joinCode join code to submit
	 * @param hourlyRate client-provided rate that should not affect attendance
	 * @return MockMvc result actions for assertions
	 */
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

	/**
	 * Joins a shift and extracts the created attendance id from the response.
	 *
	 * @param accessToken worker JWT
	 * @param joinCode shift join code
	 * @return created attendance id
	 */
	private long joinAndGetAttendanceId(String accessToken, String joinCode) throws Exception {
		MvcResult result = joinShift(accessToken, joinCode)
				.andExpect(status().isOk())
				.andReturn();
		return extractLong(result.getResponse().getContentAsString(), ATTENDANCE_ID_PATTERN);
	}

	/**
	 * Sends an attendance approval request, optionally with no body to cover the optional request contract.
	 *
	 * @param accessToken JWT for the caller
	 * @param shiftId shift id in the URL
	 * @param attendanceId attendance id in the URL
	 * @param payload approval JSON body, or null for no body
	 * @return MockMvc result actions for assertions
	 */
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

	/**
	 * Reads the current user's personal shift history.
	 *
	 * @param accessToken JWT for the caller
	 * @return MockMvc result actions for assertions
	 */
	private ResultActions getMyShiftHistory(String accessToken) throws Exception {
		return mockMvc.perform(get(MY_SHIFT_HISTORY_URL)
				.header(HttpHeaders.AUTHORIZATION, "Bearer " + accessToken));
	}

	/**
	 * Builds the approval endpoint path for a shift and attendance id pair.
	 *
	 * @param shiftId shift id
	 * @param attendanceId attendance id
	 * @return endpoint path
	 */
	private String approvalUrl(long shiftId, long attendanceId) {
		return CREATE_SHIFT_URL + "/" + shiftId + "/attendance/" + attendanceId + "/approve";
	}

	/**
	 * Builds the attendance list endpoint path for a shift.
	 *
	 * @param shiftId shift id
	 * @return endpoint path
	 */
	private String attendanceUrl(long shiftId) {
		return CREATE_SHIFT_URL + "/" + shiftId + "/attendance";
	}

	/**
	 * Overrides joinedAt so sorting tests can use deterministic timestamps and tie-breaks.
	 *
	 * @param attendanceId attendance row to update
	 * @param joinedAt timestamp to persist
	 */
	private void setJoinedAt(long attendanceId, OffsetDateTime joinedAt) {
		ShiftAttendance attendance = shiftAttendanceRepository.findById(attendanceId).orElseThrow();
		attendance.setJoinedAt(joinedAt);
		shiftAttendanceRepository.saveAndFlush(attendance);
	}

	/**
	 * Moves actualStartTime backward to create deterministic closed-shift salary data.
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
	 * Seeds an attendance row for any user, including FOREMAN or ADMIN, to exercise /me/shifts history filtering.
	 *
	 * @param shift created shift metadata
	 * @param worker user to store as the attendance worker
	 * @param joinedAt join timestamp to persist
	 * @return created attendance id
	 */
	private long createAttendanceForUser(CreatedShift shift, User worker, OffsetDateTime joinedAt) {
		ShiftSession shiftSession = shiftSessionRepository.findById(shift.id()).orElseThrow();
		ShiftAttendance attendance = new ShiftAttendance();
		attendance.setShiftSession(shiftSession);
		attendance.setWorker(worker);
		attendance.setStatus(AttendanceStatus.JOINED);
		attendance.setHourlyRate(shiftSession.getDefaultHourlyRate());
		attendance.setBreakMinutes(shiftSession.getDefaultBreakMinutes());
		attendance.setJoinedAt(joinedAt);
		return shiftAttendanceRepository.saveAndFlush(attendance).getId();
	}

	/**
	 * Builds a join request body for a supplied join code.
	 *
	 * @param joinCode join code value
	 * @return JSON request body
	 */
	private String joinPayload(String joinCode) {
		return """
				{
				  "joinCode": "%s"
				}
				""".formatted(joinCode);
	}

	/**
	 * Extracts a numeric value from a JSON response using a focused regex.
	 *
	 * @param response response body
	 * @param pattern regex with the numeric value in group one
	 * @return parsed long value
	 */
	private long extractLong(String response, Pattern pattern) {
		Matcher matcher = pattern.matcher(response);
		assertThat(matcher.find()).isTrue();
		return Long.parseLong(matcher.group(1));
	}

	/**
	 * Extracts a string value from a JSON response using a focused regex.
	 *
	 * @param response response body
	 * @param pattern regex with the string value in group one
	 * @return extracted string value
	 */
	private String extractString(String response, Pattern pattern) {
		Matcher matcher = pattern.matcher(response);
		assertThat(matcher.find()).isTrue();
		return matcher.group(1);
	}

	/**
	 * Small setup value object carrying the fields tests need after creating a shift.
	 *
	 * @param id created shift id
	 * @param joinCode generated join code for worker joins
	 */
	private record CreatedShift(long id, String joinCode) {
	}
}
