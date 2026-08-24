package com.shiftpay.mvp.controller;

import com.shiftpay.mvp.TestDataCleaner;
import com.shiftpay.mvp.entity.AttendanceStatus;
import com.shiftpay.mvp.entity.PauseScope;
import com.shiftpay.mvp.entity.Role;
import com.shiftpay.mvp.entity.ShiftAttendance;
import com.shiftpay.mvp.entity.ShiftPauseInterval;
import com.shiftpay.mvp.entity.ShiftSession;
import com.shiftpay.mvp.entity.ShiftStatus;
import com.shiftpay.mvp.entity.User;
import com.shiftpay.mvp.repository.CompanyRepository;
import com.shiftpay.mvp.repository.ShiftAttendanceRepository;
import com.shiftpay.mvp.repository.ShiftPauseIntervalRepository;
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
import java.time.Duration;
import java.time.OffsetDateTime;
import java.time.ZoneOffset;
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
 * Controller integration tests for active-shift pause endpoints and pause-aware salary calculation.
 */
@SpringBootTest
@AutoConfigureMockMvc
class PauseControllerTests {

	private static final String REGISTER_URL = "/api/v1/auth/register";
	private static final String LOGIN_URL = "/api/v1/auth/login";
	private static final String CREATE_COMPANY_URL = "/api/v1/companies";
	private static final String JOIN_COMPANY_URL = "/api/v1/companies/join";
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
	private CompanyRepository companyRepository;

	@Autowired
	private ShiftAttendanceRepository shiftAttendanceRepository;

	@Autowired
	private ShiftPauseIntervalRepository shiftPauseIntervalRepository;

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

	/**
	 * Starts and ends a worker personal pause during an ACTIVE shift.
	 */
	@Test
	void workerCanStartAndEndOwnPauseDuringActiveShift() throws Exception {
		String foremanToken = registerAndLogin("foreman@example.com", "FOREMAN");
		CreatedShift shift = createShift(foremanToken, 0, "20.00");
		String workerToken = registerAndLogin("worker@example.com", "WORKER");
		long attendanceId = joinAndGetAttendanceId(workerToken, shift.joinCode());
		startShift(foremanToken, shift.id()).andExpect(status().isOk());
		Long workerId = userRepository.findByEmail("worker@example.com").orElseThrow().getId();

		startMyPause(workerToken, shift.id())
				.andExpect(status().isOk())
				.andExpect(jsonPath("$.shiftId").value(shift.id()))
				.andExpect(jsonPath("$.pauseId").isNumber())
				.andExpect(jsonPath("$.scope").value("PERSONAL"))
				.andExpect(jsonPath("$.userId").value(workerId))
				.andExpect(jsonPath("$.active").value(true))
				.andExpect(jsonPath("$.startedAt").isString())
				.andExpect(jsonPath("$.endedAt").value(nullValue()));

		mockMvc.perform(get(attendanceUrl(shift.id()))
						.header(HttpHeaders.AUTHORIZATION, "Bearer " + foremanToken))
				.andExpect(status().isOk())
				.andExpect(jsonPath("$[0].attendanceId").value(attendanceId))
				.andExpect(jsonPath("$[0].pauseState.personallyPaused").value(true))
				.andExpect(jsonPath("$[0].pauseState.personalPauseStartedAt").isString())
				.andExpect(jsonPath("$[0].pauseState.allPaused").value(false));

		endMyPause(workerToken, shift.id())
				.andExpect(status().isOk())
				.andExpect(jsonPath("$.scope").value("PERSONAL"))
				.andExpect(jsonPath("$.userId").value(workerId))
				.andExpect(jsonPath("$.active").value(false))
				.andExpect(jsonPath("$.endedAt").isString());
	}

	/**
	 * Verifies personal pause requests fail outside ACTIVE shift state.
	 */
	@Test
	void workerCannotPauseBeforeStartAfterCloseOrCancelledShift() throws Exception {
		String foremanToken = registerAndLogin("foreman@example.com", "FOREMAN");
		String workerToken = registerAndLogin("worker@example.com", "WORKER");
		CreatedShift openShift = createShift(foremanToken, 0, "20.00");
		CreatedShift closedShift = createShift(foremanToken, 0, "20.00");
		CreatedShift cancelledShift = createShift(foremanToken, 0, "20.00");
		joinAndGetAttendanceId(workerToken, openShift.joinCode());
		joinAndGetAttendanceId(workerToken, closedShift.joinCode());
		joinAndGetAttendanceId(workerToken, cancelledShift.joinCode());
		startShift(foremanToken, closedShift.id()).andExpect(status().isOk());
		setActualStartTime(closedShift.id(), OffsetDateTime.now(ZoneOffset.UTC).minusMinutes(120));
		closeShift(foremanToken, closedShift.id()).andExpect(status().isOk());
		cancelShift(foremanToken, cancelledShift.id()).andExpect(status().isOk());

		for (CreatedShift shift : new CreatedShift[] {openShift, closedShift, cancelledShift}) {
			startMyPause(workerToken, shift.id())
					.andExpect(status().isConflict())
					.andExpect(jsonPath("$.status").value(409))
					.andExpect(jsonPath("$.error").value("Conflict"))
					.andExpect(jsonPath("$.message")
							.value("Pause is available only while shift status is ACTIVE"))
					.andExpect(jsonPath("$.path").value(myPauseStartUrl(shift.id())));
		}
	}

	/**
	 * Requires a worker to have joined the active shift before using personal pause.
	 */
	@Test
	void workerCannotPauseShiftTheyDidNotJoin() throws Exception {
		String foremanToken = registerAndLogin("foreman@example.com", "FOREMAN");
		CreatedShift shift = createShift(foremanToken, 0, "20.00");
		String workerToken = registerAndLogin("worker@example.com", "WORKER");
		startShift(foremanToken, shift.id()).andExpect(status().isOk());

		startMyPause(workerToken, shift.id())
				.andExpect(status().isForbidden())
				.andExpect(jsonPath("$.status").value(403))
				.andExpect(jsonPath("$.error").value("Forbidden"))
				.andExpect(jsonPath("$.message").value("Worker must join this shift before pausing"))
				.andExpect(jsonPath("$.path").value(myPauseStartUrl(shift.id())));
	}

	/**
	 * Starts and ends the owner foreman's personal pause without creating foreman attendance.
	 */
	@Test
	void ownerForemanCanStartAndEndOwnPause() throws Exception {
		String foremanToken = registerAndLogin("foreman@example.com", "FOREMAN");
		CreatedShift shift = createShift(foremanToken, 0, "20.00");
		startShift(foremanToken, shift.id()).andExpect(status().isOk());
		Long foremanId = userRepository.findByEmail("foreman@example.com").orElseThrow().getId();

		startMyPause(foremanToken, shift.id())
				.andExpect(status().isOk())
				.andExpect(jsonPath("$.scope").value("PERSONAL"))
				.andExpect(jsonPath("$.userId").value(foremanId))
				.andExpect(jsonPath("$.active").value(true));
		mockMvc.perform(get(CREATE_SHIFT_URL + "/" + shift.id())
						.header(HttpHeaders.AUTHORIZATION, "Bearer " + foremanToken))
				.andExpect(status().isOk())
				.andExpect(jsonPath("$.pauseState.personallyPaused").value(true))
				.andExpect(jsonPath("$.pauseState.personalPauseStartedAt").isString());

		endMyPause(foremanToken, shift.id())
				.andExpect(status().isOk())
				.andExpect(jsonPath("$.scope").value("PERSONAL"))
				.andExpect(jsonPath("$.active").value(false));
		assertThat(shiftAttendanceRepository.count()).isZero();
	}

	/**
	 * Starts and ends an all-participant pause for an owner foreman.
	 */
	@Test
	void ownerForemanCanStartAndEndPauseForAll() throws Exception {
		String foremanToken = registerAndLogin("foreman@example.com", "FOREMAN");
		CreatedShift shift = createShift(foremanToken, 0, "20.00");
		String workerToken = registerAndLogin("worker@example.com", "WORKER");
		joinAndGetAttendanceId(workerToken, shift.joinCode());
		startShift(foremanToken, shift.id()).andExpect(status().isOk());

		startAllPause(foremanToken, shift.id())
				.andExpect(status().isOk())
				.andExpect(jsonPath("$.scope").value("ALL"))
				.andExpect(jsonPath("$.userId").doesNotExist())
				.andExpect(jsonPath("$.active").value(true));
		mockMvc.perform(get(CREATE_SHIFT_URL + "/" + shift.id())
						.header(HttpHeaders.AUTHORIZATION, "Bearer " + foremanToken))
				.andExpect(status().isOk())
				.andExpect(jsonPath("$.pauseState.allPaused").value(true))
				.andExpect(jsonPath("$.pauseState.allPauseStartedAt").isString());
		mockMvc.perform(get(attendanceUrl(shift.id()))
						.header(HttpHeaders.AUTHORIZATION, "Bearer " + foremanToken))
				.andExpect(status().isOk())
				.andExpect(jsonPath("$[0].pauseState.allPaused").value(true));

		endAllPause(foremanToken, shift.id())
				.andExpect(status().isOk())
				.andExpect(jsonPath("$.scope").value("ALL"))
				.andExpect(jsonPath("$.active").value(false))
				.andExpect(jsonPath("$.endedAt").isString());
	}

	/**
	 * Denies all-participant pause to non-owner foreman, admin, and worker callers.
	 */
	@Test
	void onlyOwnerForemanCanPauseAll() throws Exception {
		String ownerToken = registerAndLogin("owner@example.com", "FOREMAN");
		CreatedShift shift = createShift(ownerToken, 0, "20.00");
		String otherForemanToken = registerAndLogin("other.foreman@example.com", "FOREMAN");
		String adminToken = createAdminAndLogin();
		String workerToken = registerAndLogin("worker@example.com", "WORKER");
		startShift(ownerToken, shift.id()).andExpect(status().isOk());

		startAllPause(otherForemanToken, shift.id())
				.andExpect(status().isForbidden())
				.andExpect(jsonPath("$.message").value("Forbidden"))
				.andExpect(jsonPath("$.path").value(allPauseStartUrl(shift.id())));
		startAllPause(adminToken, shift.id())
				.andExpect(status().isForbidden())
				.andExpect(jsonPath("$.message").value("Forbidden"))
				.andExpect(jsonPath("$.path").value(allPauseStartUrl(shift.id())));
		startAllPause(workerToken, shift.id())
				.andExpect(status().isForbidden())
				.andExpect(jsonPath("$.message").value("Forbidden"))
				.andExpect(jsonPath("$.path").value(allPauseStartUrl(shift.id())));
	}

	/**
	 * Rejects duplicate personal pause starts and ends without an active personal pause.
	 */
	@Test
	void duplicatePersonalPauseStartAndEndReturnConflict() throws Exception {
		String foremanToken = registerAndLogin("foreman@example.com", "FOREMAN");
		CreatedShift shift = createShift(foremanToken, 0, "20.00");
		String workerToken = registerAndLogin("worker@example.com", "WORKER");
		joinAndGetAttendanceId(workerToken, shift.joinCode());
		startShift(foremanToken, shift.id()).andExpect(status().isOk());

		startMyPause(workerToken, shift.id()).andExpect(status().isOk());
		startMyPause(workerToken, shift.id())
				.andExpect(status().isConflict())
				.andExpect(jsonPath("$.status").value(409))
				.andExpect(jsonPath("$.message").value("Personal pause is already active"));
		endMyPause(workerToken, shift.id()).andExpect(status().isOk());
		endMyPause(workerToken, shift.id())
				.andExpect(status().isConflict())
				.andExpect(jsonPath("$.status").value(409))
				.andExpect(jsonPath("$.message").value("No active personal pause to end"));
	}

	/**
	 * Auto-ends active pause intervals at actualEndTime when the shift closes.
	 */
	@Test
	void closeAutoEndsActivePausesAtActualEndTime() throws Exception {
		String foremanToken = registerAndLogin("foreman@example.com", "FOREMAN");
		CreatedShift shift = createShift(foremanToken, 0, "20.00");
		String workerToken = registerAndLogin("worker@example.com", "WORKER");
		long attendanceId = joinAndGetAttendanceId(workerToken, shift.joinCode());
		approveAttendance(foremanToken, shift.id(), attendanceId).andExpect(status().isOk());
		startShift(foremanToken, shift.id()).andExpect(status().isOk());
		setActualStartTime(shift.id(), OffsetDateTime.now(ZoneOffset.UTC).minusMinutes(120));
		startMyPause(workerToken, shift.id()).andExpect(status().isOk());
		startAllPause(foremanToken, shift.id()).andExpect(status().isOk());

		closeShift(foremanToken, shift.id()).andExpect(status().isOk());

		ShiftSession closedShift = shiftSessionRepository.findById(shift.id()).orElseThrow();
		assertThat(closedShift.getStatus()).isEqualTo(ShiftStatus.CLOSED);
		assertThat(shiftPauseIntervalRepository.findAll()).hasSize(2)
				.allSatisfy((pauseInterval) ->
						assertThat(pauseInterval.getEndedAt()).isEqualTo(closedShift.getActualEndTime()));
	}

	/**
	 * Deducts pause minutes from approved worker salary and private foreman salary when closing.
	 */
	@Test
	void closeSubtractsPauseMinutesFromSalary() throws Exception {
		String foremanToken = registerAndLogin("foreman@example.com", "FOREMAN");
		CreatedShift shift = createShift(foremanToken, 0, "60.00");
		String workerToken = registerAndLogin("worker@example.com", "WORKER");
		long attendanceId = joinAndGetAttendanceId(workerToken, shift.joinCode());
		approveAttendance(foremanToken, shift.id(), attendanceId).andExpect(status().isOk());
		startShift(foremanToken, shift.id()).andExpect(status().isOk());
		OffsetDateTime actualStart = OffsetDateTime.now(ZoneOffset.UTC).minusMinutes(180);
		setActualStartTime(shift.id(), actualStart);
		User worker = userRepository.findByEmail("worker@example.com").orElseThrow();
		createPauseInterval(
				shift.id(),
				PauseScope.PERSONAL,
				worker,
				actualStart.plusMinutes(30),
				actualStart.plusMinutes(60)
		);

		closeShift(foremanToken, shift.id()).andExpect(status().isOk());

		ShiftSession closedShift = shiftSessionRepository.findById(shift.id()).orElseThrow();
		ShiftAttendance attendance = shiftAttendanceRepository.findById(attendanceId).orElseThrow();
		long durationMinutes = Duration.between(closedShift.getActualStartTime(), closedShift.getActualEndTime())
				.toMinutes();
		assertThat(attendance.getPauseMinutes()).isEqualTo(30);
		assertThat(attendance.getWorkedMinutes()).isEqualTo(Math.toIntExact(durationMinutes - 30));
		assertThat(attendance.getCalculatedSalary()).isEqualByComparingTo(
				BigDecimal.valueOf(durationMinutes - 30).setScale(2)
		);
		assertThat(closedShift.getForemanPauseMinutes()).isZero();
		assertThat(closedShift.getForemanCalculatedSalary()).isEqualByComparingTo(
				BigDecimal.valueOf(durationMinutes).multiply(new BigDecimal("25.00"))
						.divide(BigDecimal.valueOf(60), 2, java.math.RoundingMode.HALF_UP)
		);
	}

	/**
	 * Merges overlapping personal and all-pause intervals without double-counting salary deductions.
	 */
	@Test
	void overlappingPersonalAndAllPausesDoNotDoubleCount() throws Exception {
		String foremanToken = registerAndLogin("foreman@example.com", "FOREMAN");
		CreatedShift shift = createShift(foremanToken, 0, "60.00");
		String workerToken = registerAndLogin("worker@example.com", "WORKER");
		long attendanceId = joinAndGetAttendanceId(workerToken, shift.joinCode());
		approveAttendance(foremanToken, shift.id(), attendanceId).andExpect(status().isOk());
		startShift(foremanToken, shift.id()).andExpect(status().isOk());
		OffsetDateTime actualStart = OffsetDateTime.now(ZoneOffset.UTC).minusMinutes(180);
		setActualStartTime(shift.id(), actualStart);
		User worker = userRepository.findByEmail("worker@example.com").orElseThrow();
		createPauseInterval(
				shift.id(),
				PauseScope.ALL,
				null,
				actualStart.plusMinutes(30),
				actualStart.plusMinutes(90)
		);
		createPauseInterval(
				shift.id(),
				PauseScope.PERSONAL,
				worker,
				actualStart.plusMinutes(60),
				actualStart.plusMinutes(120)
		);

		closeShift(foremanToken, shift.id()).andExpect(status().isOk());

		ShiftSession closedShift = shiftSessionRepository.findById(shift.id()).orElseThrow();
		ShiftAttendance attendance = shiftAttendanceRepository.findById(attendanceId).orElseThrow();
		long durationMinutes = Duration.between(closedShift.getActualStartTime(), closedShift.getActualEndTime())
				.toMinutes();
		assertThat(attendance.getPauseMinutes()).isEqualTo(90);
		assertThat(attendance.getWorkedMinutes()).isEqualTo(Math.toIntExact(durationMinutes - 90));
		assertThat(closedShift.getForemanPauseMinutes()).isEqualTo(60);

		getSummary(foremanToken, shift.id())
				.andExpect(status().isOk())
				.andExpect(jsonPath("$.foremanPauseMinutes").value(60))
				.andExpect(jsonPath("$.workers[0].pauseMinutes").value(90))
				.andExpect(jsonPath("$.workers[0].workedMinutes").value(attendance.getWorkedMinutes()));
	}

	/**
	 * Keeps foreman private salary and rate fields out of worker history while exposing worker pause state.
	 */
	@Test
	void workerPauseDtosDoNotExposeForemanSalaryOrRate() throws Exception {
		String foremanToken = registerAndLogin("foreman@example.com", "FOREMAN");
		CreatedShift shift = createShift(foremanToken, 0, "20.00");
		String workerToken = registerAndLogin("worker@example.com", "WORKER");
		joinAndGetAttendanceId(workerToken, shift.joinCode());
		startShift(foremanToken, shift.id()).andExpect(status().isOk());
		startAllPause(foremanToken, shift.id()).andExpect(status().isOk());
		startMyPause(workerToken, shift.id()).andExpect(status().isOk());

		mockMvc.perform(get(MY_SHIFT_HISTORY_URL)
						.header(HttpHeaders.AUTHORIZATION, "Bearer " + workerToken))
				.andExpect(status().isOk())
				.andExpect(jsonPath("$", hasSize(1)))
				.andExpect(jsonPath("$[0].pauseState.allPaused").value(true))
				.andExpect(jsonPath("$[0].pauseState.personallyPaused").value(true))
				.andExpect(jsonPath("$[0].foremanHourlyRate").doesNotExist())
				.andExpect(jsonPath("$[0].foremanWorkedMinutes").doesNotExist())
				.andExpect(jsonPath("$[0].foremanPauseMinutes").doesNotExist())
				.andExpect(jsonPath("$[0].foremanSalary").doesNotExist());
	}

	private String registerAndLogin(String email, String role) throws Exception {
		String accessToken = registerAndLoginWithoutCompany(email, role);
		if ("FOREMAN".equals(role)) {
			createCompany(accessToken, "Acme Construction");
		}
		else if ("WORKER".equals(role)) {
			joinFirstCompany(accessToken);
		}
		return accessToken;
	}

	private String registerAndLoginWithoutCompany(String email, String role) throws Exception {
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

	private String createCompany(String accessToken, String companyName) throws Exception {
		MvcResult result = mockMvc.perform(post(CREATE_COMPANY_URL)
						.header(HttpHeaders.AUTHORIZATION, "Bearer " + accessToken)
						.contentType(MediaType.APPLICATION_JSON)
						.content("""
								{
								  "name": "%s"
								}
								""".formatted(companyName)))
				.andExpect(status().isCreated())
				.andReturn();
		return extractString(result.getResponse().getContentAsString(), JOIN_CODE_PATTERN);
	}

	private void joinFirstCompany(String accessToken) throws Exception {
		companyRepository.findAll().stream()
				.findFirst()
				.ifPresent((company) -> {
					try {
						joinCompany(accessToken, company.getJoinCode());
					}
					catch (Exception exception) {
						throw new IllegalStateException(exception);
					}
				});
	}

	private void joinCompany(String accessToken, String joinCode) throws Exception {
		mockMvc.perform(post(JOIN_COMPANY_URL)
						.header(HttpHeaders.AUTHORIZATION, "Bearer " + accessToken)
						.contentType(MediaType.APPLICATION_JSON)
						.content("""
								{
								  "joinCode": "%s"
								}
								""".formatted(joinCode)))
				.andExpect(status().isOk());
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
		return extractString(result.getResponse().getContentAsString(), ACCESS_TOKEN_PATTERN);
	}

	private CreatedShift createShift(String accessToken, int defaultBreakMinutes, String defaultHourlyRate)
			throws Exception {
		MvcResult result = mockMvc.perform(post(CREATE_SHIFT_URL)
						.header(HttpHeaders.AUTHORIZATION, "Bearer " + accessToken)
						.contentType(MediaType.APPLICATION_JSON)
						.content("""
								{
								  "location": "Cologne",
								  "defaultBreakMinutes": %d,
								  "defaultHourlyRate": %s,
								  "foremanHourlyRate": 25.00
								}
								""".formatted(defaultBreakMinutes, defaultHourlyRate)))
				.andExpect(status().isCreated())
				.andReturn();
		String response = result.getResponse().getContentAsString();
		return new CreatedShift(extractLong(response, SHIFT_ID_PATTERN), extractString(response, JOIN_CODE_PATTERN));
	}

	private ResultActions joinShift(String accessToken, String joinCode) throws Exception {
		return mockMvc.perform(post(JOIN_SHIFT_URL)
				.header(HttpHeaders.AUTHORIZATION, "Bearer " + accessToken)
				.contentType(MediaType.APPLICATION_JSON)
				.content("""
						{
						  "joinCode": "%s"
						}
						""".formatted(joinCode)));
	}

	private long joinAndGetAttendanceId(String accessToken, String joinCode) throws Exception {
		MvcResult result = joinShift(accessToken, joinCode)
				.andExpect(status().isOk())
				.andReturn();
		return extractLong(result.getResponse().getContentAsString(), ATTENDANCE_ID_PATTERN);
	}

	private ResultActions approveAttendance(String accessToken, long shiftId, long attendanceId) throws Exception {
		return mockMvc.perform(post(CREATE_SHIFT_URL + "/" + shiftId + "/attendance/" + attendanceId + "/approve")
				.header(HttpHeaders.AUTHORIZATION, "Bearer " + accessToken)
				.contentType(MediaType.APPLICATION_JSON)
				.content("{}"));
	}

	private ResultActions startShift(String accessToken, long shiftId) throws Exception {
		return mockMvc.perform(post(CREATE_SHIFT_URL + "/" + shiftId + "/start")
				.header(HttpHeaders.AUTHORIZATION, "Bearer " + accessToken));
	}

	private ResultActions cancelShift(String accessToken, long shiftId) throws Exception {
		return mockMvc.perform(post(CREATE_SHIFT_URL + "/" + shiftId + "/cancel")
				.header(HttpHeaders.AUTHORIZATION, "Bearer " + accessToken));
	}

	private ResultActions closeShift(String accessToken, long shiftId) throws Exception {
		return mockMvc.perform(post(CREATE_SHIFT_URL + "/" + shiftId + "/close")
				.header(HttpHeaders.AUTHORIZATION, "Bearer " + accessToken));
	}

	private ResultActions startMyPause(String accessToken, long shiftId) throws Exception {
		return mockMvc.perform(post(myPauseStartUrl(shiftId))
				.header(HttpHeaders.AUTHORIZATION, "Bearer " + accessToken));
	}

	private ResultActions endMyPause(String accessToken, long shiftId) throws Exception {
		return mockMvc.perform(post(CREATE_SHIFT_URL + "/" + shiftId + "/pauses/me/end")
				.header(HttpHeaders.AUTHORIZATION, "Bearer " + accessToken));
	}

	private ResultActions startAllPause(String accessToken, long shiftId) throws Exception {
		return mockMvc.perform(post(allPauseStartUrl(shiftId))
				.header(HttpHeaders.AUTHORIZATION, "Bearer " + accessToken));
	}

	private ResultActions endAllPause(String accessToken, long shiftId) throws Exception {
		return mockMvc.perform(post(CREATE_SHIFT_URL + "/" + shiftId + "/pauses/all/end")
				.header(HttpHeaders.AUTHORIZATION, "Bearer " + accessToken));
	}

	private ResultActions getSummary(String accessToken, long shiftId) throws Exception {
		return mockMvc.perform(get(CREATE_SHIFT_URL + "/" + shiftId + "/summary")
				.header(HttpHeaders.AUTHORIZATION, "Bearer " + accessToken));
	}

	private void setActualStartTime(long shiftId, OffsetDateTime actualStartTime) {
		ShiftSession shiftSession = shiftSessionRepository.findById(shiftId).orElseThrow();
		shiftSession.setActualStartTime(actualStartTime);
		shiftSessionRepository.saveAndFlush(shiftSession);
	}

	private void createPauseInterval(
			long shiftId,
			PauseScope scope,
			User user,
			OffsetDateTime startedAt,
			OffsetDateTime endedAt
	) {
		ShiftPauseInterval pauseInterval = new ShiftPauseInterval();
		pauseInterval.setShiftSession(shiftSessionRepository.findById(shiftId).orElseThrow());
		pauseInterval.setScope(scope);
		pauseInterval.setUser(user);
		pauseInterval.setStartedAt(startedAt);
		pauseInterval.setEndedAt(endedAt);
		shiftPauseIntervalRepository.saveAndFlush(pauseInterval);
	}

	private String myPauseStartUrl(long shiftId) {
		return CREATE_SHIFT_URL + "/" + shiftId + "/pauses/me/start";
	}

	private String allPauseStartUrl(long shiftId) {
		return CREATE_SHIFT_URL + "/" + shiftId + "/pauses/all/start";
	}

	private String attendanceUrl(long shiftId) {
		return CREATE_SHIFT_URL + "/" + shiftId + "/attendance";
	}

	private long extractLong(String response, Pattern pattern) {
		return Long.parseLong(extractString(response, pattern));
	}

	private String extractString(String response, Pattern pattern) {
		Matcher matcher = pattern.matcher(response);
		assertThat(matcher.find()).isTrue();
		return matcher.group(1);
	}

	private record CreatedShift(long id, String joinCode) {
	}
}
