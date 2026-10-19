package com.shiftpay.mvp.controller;

import com.shiftpay.mvp.TestDataCleaner;
import com.shiftpay.mvp.entity.AttendanceStatus;
import com.shiftpay.mvp.entity.Company;
import com.shiftpay.mvp.entity.Role;
import com.shiftpay.mvp.entity.ShiftAttendance;
import com.shiftpay.mvp.entity.ShiftSession;
import com.shiftpay.mvp.entity.ShiftStatus;
import com.shiftpay.mvp.entity.User;
import com.shiftpay.mvp.repository.CompanyRepository;
import com.shiftpay.mvp.repository.ShiftAttendanceRepository;
import com.shiftpay.mvp.repository.ShiftSessionRepository;
import com.shiftpay.mvp.repository.UserRepository;
import com.shiftpay.mvp.security.JwtService;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.http.HttpHeaders;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.MvcResult;

import java.math.BigDecimal;
import java.sql.Timestamp;
import java.time.Instant;
import java.time.OffsetDateTime;
import java.time.ZoneOffset;
import java.util.ArrayList;
import java.util.List;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@SpringBootTest
@AutoConfigureMockMvc
class HistoryPaginationControllerTests {

	private static final Pattern NEXT_CURSOR = Pattern.compile("\"nextCursor\":\"([^\"]+)\"");
	private static final OffsetDateTime JOINED_AT = OffsetDateTime.of(
			2026, 10, 1, 10, 0, 0, 0, ZoneOffset.UTC);

	@Autowired MockMvc mockMvc;
	@Autowired JdbcTemplate jdbcTemplate;
	@Autowired UserRepository userRepository;
	@Autowired CompanyRepository companyRepository;
	@Autowired ShiftSessionRepository shiftRepository;
	@Autowired ShiftAttendanceRepository attendanceRepository;
	@Autowired PasswordEncoder passwordEncoder;
	@Autowired JwtService jwtService;

	private User worker;
	private User foreman;
	private Company company;
	private final List<ShiftSession> shifts = new ArrayList<>();
	private final List<ShiftAttendance> attendances = new ArrayList<>();

	@BeforeEach
	void setUp() {
		TestDataCleaner.clean(jdbcTemplate);
		shifts.clear();
		attendances.clear();

		company = new Company();
		company.setName("Acme");
		company.setJoinCode("ACME01");
		company.setTimeZone("Europe/Berlin");
		company.setCurrencyLabel("EUR");
		company.setDefaultWorkerHourlyRate(new BigDecimal("20.00"));
		company.setDefaultForemanHourlyRate(new BigDecimal("30.00"));
		company = companyRepository.saveAndFlush(company);

		worker = createUser("worker@example.com", Role.WORKER, company);
		foreman = createUser("foreman@example.com", Role.FOREMAN, company);
		for (int index = 1; index <= 4; index++) {
			createShiftAndAttendance(index, JOINED_AT);
		}
		jdbcTemplate.update(
				"update shift_sessions set created_at = ?",
				Timestamp.from(Instant.parse("2026-10-01T10:00:00Z")));
	}

	@Test
	void personalCursorTraversalIsStableAndLegacyArrayStaysCompatible() throws Exception {
		String token = jwtService.generateAccessToken(worker);
		MvcResult firstPage = mockMvc.perform(get("/api/v1/me/shifts/page")
					.param("limit", "2")
					.header(HttpHeaders.AUTHORIZATION, bearer(token)))
				.andExpect(status().isOk())
				.andExpect(jsonPath("$.items.length()").value(2))
				.andExpect(jsonPath("$.items[0].attendanceId").value(attendances.get(3).getId()))
				.andExpect(jsonPath("$.items[1].attendanceId").value(attendances.get(2).getId()))
				.andExpect(jsonPath("$.hasMore").value(true))
				.andReturn();

		String cursor = extractCursor(firstPage);
		ShiftAttendance newer = createShiftAndAttendance(5, JOINED_AT.plusDays(1));
		mockMvc.perform(get("/api/v1/me/shifts/page")
					.param("limit", "2")
					.param("cursor", cursor)
					.header(HttpHeaders.AUTHORIZATION, bearer(token)))
				.andExpect(status().isOk())
				.andExpect(jsonPath("$.items.length()").value(2))
				.andExpect(jsonPath("$.items[0].attendanceId").value(attendances.get(1).getId()))
				.andExpect(jsonPath("$.items[1].attendanceId").value(attendances.get(0).getId()))
				.andExpect(jsonPath("$.items[?(@.attendanceId == %d)]".formatted(newer.getId())).isEmpty())
				.andExpect(jsonPath("$.nextCursor").value(org.hamcrest.Matchers.nullValue()))
				.andExpect(jsonPath("$.hasMore").value(false));

		mockMvc.perform(get("/api/v1/me/shifts")
					.header(HttpHeaders.AUTHORIZATION, bearer(token)))
				.andExpect(status().isOk())
				.andExpect(jsonPath("$").isArray())
				.andExpect(jsonPath("$.length()").value(5));
	}

	@Test
	void managedCursorIsEndpointSpecificAndWorkerRemainsForbidden() throws Exception {
		String foremanToken = jwtService.generateAccessToken(foreman);
		String workerToken = jwtService.generateAccessToken(worker);
		MvcResult firstPage = mockMvc.perform(get("/api/v1/me/managed-shifts/page")
					.param("limit", "2")
					.header(HttpHeaders.AUTHORIZATION, bearer(foremanToken)))
				.andExpect(status().isOk())
				.andExpect(jsonPath("$.items[0].id").value(shifts.get(3).getId()))
				.andExpect(jsonPath("$.items[1].id").value(shifts.get(2).getId()))
				.andExpect(jsonPath("$.hasMore").value(true))
				.andReturn();

		String managedCursor = extractCursor(firstPage);
		ShiftSession newer = createShiftAndAttendance(5, JOINED_AT.plusDays(1)).getShiftSession();
		mockMvc.perform(get("/api/v1/me/managed-shifts/page")
					.param("limit", "2")
					.param("cursor", managedCursor)
					.header(HttpHeaders.AUTHORIZATION, bearer(foremanToken)))
				.andExpect(status().isOk())
				.andExpect(jsonPath("$.items.length()").value(2))
				.andExpect(jsonPath("$.items[0].id").value(shifts.get(1).getId()))
				.andExpect(jsonPath("$.items[1].id").value(shifts.get(0).getId()))
				.andExpect(jsonPath("$.items[?(@.id == %d)]".formatted(newer.getId())).isEmpty())
				.andExpect(jsonPath("$.nextCursor").value(org.hamcrest.Matchers.nullValue()))
				.andExpect(jsonPath("$.hasMore").value(false));

		mockMvc.perform(get("/api/v1/me/shifts/page")
					.param("cursor", managedCursor)
					.header(HttpHeaders.AUTHORIZATION, bearer(workerToken)))
				.andExpect(status().isBadRequest());
		mockMvc.perform(get("/api/v1/me/managed-shifts/page")
					.param("limit", "21")
					.header(HttpHeaders.AUTHORIZATION, bearer(foremanToken)))
				.andExpect(status().isBadRequest());
		mockMvc.perform(get("/api/v1/me/managed-shifts/page")
					.header(HttpHeaders.AUTHORIZATION, bearer(workerToken)))
				.andExpect(status().isForbidden());

		mockMvc.perform(get("/api/v1/me/managed-shifts")
					.header(HttpHeaders.AUTHORIZATION, bearer(foremanToken)))
				.andExpect(status().isOk())
				.andExpect(jsonPath("$").isArray())
				.andExpect(jsonPath("$.length()").value(5));
	}

	@Test
	void signedCursorsCannotBeReusedByAnotherAuthenticatedUser() throws Exception {
		String workerCursor = extractCursor(mockMvc.perform(get("/api/v1/me/shifts/page")
					.param("limit", "2")
					.header(HttpHeaders.AUTHORIZATION, bearer(jwtService.generateAccessToken(worker))))
				.andExpect(status().isOk())
				.andExpect(jsonPath("$.hasMore").value(true))
				.andReturn());
		User otherWorker = createUser("other.worker@example.com", Role.WORKER, company);

		mockMvc.perform(get("/api/v1/me/shifts/page")
					.param("cursor", workerCursor)
					.header(HttpHeaders.AUTHORIZATION, bearer(jwtService.generateAccessToken(otherWorker))))
				.andExpect(status().isBadRequest());

		String foremanCursor = extractCursor(mockMvc.perform(get("/api/v1/me/managed-shifts/page")
					.param("limit", "2")
					.header(HttpHeaders.AUTHORIZATION, bearer(jwtService.generateAccessToken(foreman))))
				.andExpect(status().isOk())
				.andExpect(jsonPath("$.hasMore").value(true))
				.andReturn());
		User otherForeman = createUser("other.foreman@example.com", Role.FOREMAN, company);

		mockMvc.perform(get("/api/v1/me/managed-shifts/page")
					.param("cursor", foremanCursor)
					.header(HttpHeaders.AUTHORIZATION, bearer(jwtService.generateAccessToken(otherForeman))))
				.andExpect(status().isBadRequest());
	}

	private User createUser(String email, Role role, Company assignedCompany) {
		User user = new User();
		user.setEmail(email);
		user.setPasswordHash(passwordEncoder.encode("password123"));
		user.setFirstName(role == Role.WORKER ? "Wendy" : "Frank");
		user.setLastName(role.name());
		user.setRole(role);
		user.setCompany(assignedCompany);
		return userRepository.saveAndFlush(user);
	}

	private ShiftAttendance createShiftAndAttendance(int index, OffsetDateTime joinedAt) {
		ShiftSession shift = new ShiftSession();
		shift.setCompany(company);
		shift.setTitle("Shift " + index);
		shift.setJoinCode("SHIFT" + index);
		shift.setStatus(ShiftStatus.OPEN);
		shift.setDefaultBreakMinutes(0);
		shift.setDefaultHourlyRate(new BigDecimal("20.00"));
		shift.setForemanHourlyRate(new BigDecimal("30.00"));
		shift.setCurrencyLabel("EUR");
		shift.setCreatedBy(foreman);
		shift = shiftRepository.saveAndFlush(shift);
		shifts.add(shift);

		ShiftAttendance attendance = new ShiftAttendance();
		attendance.setShiftSession(shift);
		attendance.setWorker(worker);
		attendance.setStatus(AttendanceStatus.JOINED);
		attendance.setHourlyRate(new BigDecimal("20.00"));
		attendance.setBreakMinutes(0);
		attendance.setJoinedAt(joinedAt);
		attendance = attendanceRepository.saveAndFlush(attendance);
		attendances.add(attendance);
		return attendance;
	}

	private String extractCursor(MvcResult result) throws Exception {
		Matcher matcher = NEXT_CURSOR.matcher(result.getResponse().getContentAsString());
		assertThat(matcher.find()).isTrue();
		return matcher.group(1);
	}

	private String bearer(String token) {
		return "Bearer " + token;
	}
}
