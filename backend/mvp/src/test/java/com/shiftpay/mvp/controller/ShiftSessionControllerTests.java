package com.shiftpay.mvp.controller;

import com.shiftpay.mvp.TestDataCleaner;
import com.shiftpay.mvp.entity.Role;
import com.shiftpay.mvp.entity.ShiftSession;
import com.shiftpay.mvp.entity.ShiftStatus;
import com.shiftpay.mvp.entity.User;
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
	private static final Pattern ACCESS_TOKEN_PATTERN = Pattern.compile("\"accessToken\":\"([^\"]+)\"");
	private static final Pattern SHIFT_ID_PATTERN = Pattern.compile("\"id\":(\\d+)");
	private static final Pattern JOIN_CODE_PATTERN = Pattern.compile("\"joinCode\":\"([^\"]+)\"");

	@Autowired
	private MockMvc mockMvc;

	@Autowired
	private JdbcTemplate jdbcTemplate;

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
				.andExpect(jsonPath("$.createdBy").isNumber());

		assertThat(shiftSessionRepository.count()).isEqualTo(1);
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
				.andExpect(jsonPath("$.status").value("OPEN"));
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
								  "defaultBreakMinutes": -1
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
								  "defaultBreakMinutes": 60
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
				.andExpect(jsonPath("$.createdBy").isNumber())
				.andExpect(jsonPath("$.*", hasSize(11)))
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

	private String validCreateShiftPayload(String title) {
		return """
				{
				  "title": "%s",
				  "location": "Cologne",
				  "plannedStartTime": "2026-07-01T08:00:00",
				  "plannedEndTime": "2026-07-01T17:00:00",
				  "defaultBreakMinutes": 60
				}
				""".formatted(title);
	}

	private long createShift(String accessToken, String title) throws Exception {
		MvcResult result = mockMvc.perform(post(CREATE_SHIFT_URL)
						.header(HttpHeaders.AUTHORIZATION, "Bearer " + accessToken)
						.contentType(MediaType.APPLICATION_JSON)
						.content(validCreateShiftPayload(title)))
				.andExpect(status().isCreated())
				.andReturn();

		Matcher matcher = SHIFT_ID_PATTERN.matcher(result.getResponse().getContentAsString());
		assertThat(matcher.find()).isTrue();
		return Long.parseLong(matcher.group(1));
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

	private String extractJoinCode(MvcResult result) throws Exception {
		Matcher matcher = JOIN_CODE_PATTERN.matcher(result.getResponse().getContentAsString());
		assertThat(matcher.find()).isTrue();
		return matcher.group(1);
	}
}
