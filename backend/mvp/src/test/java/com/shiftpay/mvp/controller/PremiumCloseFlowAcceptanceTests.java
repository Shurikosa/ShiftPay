package com.shiftpay.mvp.controller;

import com.shiftpay.mvp.TestDataCleaner;
import com.shiftpay.mvp.entity.PauseScope;
import com.shiftpay.mvp.entity.PayCalculation;
import com.shiftpay.mvp.entity.ShiftAttendance;
import com.shiftpay.mvp.entity.ShiftPauseInterval;
import com.shiftpay.mvp.entity.ShiftSession;
import com.shiftpay.mvp.repository.CompanyRepository;
import com.shiftpay.mvp.repository.PayCalculationRepository;
import com.shiftpay.mvp.repository.ShiftAttendanceRepository;
import com.shiftpay.mvp.repository.ShiftPauseIntervalRepository;
import com.shiftpay.mvp.repository.ShiftSessionRepository;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.context.TestConfiguration;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Import;
import org.springframework.context.annotation.Primary;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.MvcResult;
import org.springframework.test.web.servlet.ResultActions;

import java.math.BigDecimal;
import java.time.Clock;
import java.time.Instant;
import java.time.ZoneId;
import java.time.ZoneOffset;
import java.time.OffsetDateTime;
import java.util.Comparator;
import java.util.concurrent.atomic.AtomicReference;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/**
 * Production acceptance coverage for the Phase 2C close-time premium path.
 *
 * <p>These tests intentionally use the same controller endpoints as clients and only move lifecycle timestamps
 * after {@code start}. The mutable test clock makes close timestamps deterministic while leaving production's
 * system UTC clock unchanged.</p>
 */
@SpringBootTest
@AutoConfigureMockMvc
@Import(PremiumCloseFlowAcceptanceTests.AcceptanceClockConfiguration.class)
class PremiumCloseFlowAcceptanceTests {

	private static final String REGISTER_URL = "/api/v1/auth/register";
	private static final String LOGIN_URL = "/api/v1/auth/login";
	private static final String CREATE_COMPANY_URL = "/api/v1/companies";
	private static final String CREATE_SHIFT_URL = "/api/v1/shifts";
	private static final String PAY_POLICY_URL = "/api/v1/me/pay-policy";
	private static final String HISTORY_URL = "/api/v1/me/shifts";
	private static final String PAYABLE_URL = "/api/v1/me/payable-attendances";
	private static final String PAYOUT_PREVIEW_URL = "/api/v1/me/payout-requests/preview";
	private static final String PAYOUT_URL = "/api/v1/me/payout-requests";
	private static final String MANAGED_PAYOUT_URL = "/api/v1/me/managed-payout-requests";
	private static final Pattern ACCESS_TOKEN = Pattern.compile("\\\"accessToken\\\":\\\"([^\\\"]+)\\\"");
	private static final Pattern ID = Pattern.compile("\\\"id\\\":(\\d+)");
	private static final Pattern ATTENDANCE_ID = Pattern.compile("\\\"attendanceId\\\":(\\d+)");

	@Autowired
	private MockMvc mockMvc;

	@Autowired
	private JdbcTemplate jdbcTemplate;

	@Autowired
	private CompanyRepository companyRepository;

	@Autowired
	private ShiftSessionRepository shiftSessionRepository;

	@Autowired
	private ShiftAttendanceRepository shiftAttendanceRepository;

	@Autowired
	private ShiftPauseIntervalRepository shiftPauseIntervalRepository;

	@Autowired
	private PayCalculationRepository payCalculationRepository;

	@Autowired
	private MutableClock clock;

	@BeforeEach
	void setUp() {
		TestDataCleaner.clean(jdbcTemplate);
		clock.reset();
	}

	@AfterEach
	void resetClock() {
		clock.reset();
	}

	/**
	 * Exercises close, frozen policy lookup, persisted breakdown, worker history, foreman summary, and every payout
	 * transition. A 63-minute premium shift deliberately rounds to 65 minutes: its 94.50 stored salary must remain
	 * the payout basis instead of being recomputed from those rounded minutes.
	 */
	@Test
	void closePersistsFrozenPremiumSnapshotAndUsesStoredSalaryAcrossPayoutWorkflow() throws Exception {
		Instant closeAt = Instant.parse("2026-03-30T21:03:00Z"); // 23:03 Europe/Berlin, inside 22:00-06:00
		clock.set(closeAt);
		String foremanToken = registerForeman("premium.foreman@example.com");
		String workerToken = registerWorker("premium.worker@example.com");
		putPolicy(foremanToken, timeOfDayPolicy("50"));

		long shiftId = createShift(foremanToken, 0, "60.00");
		long attendanceId = joinAndApprove(workerToken, foremanToken, shiftId);
		startShift(foremanToken, shiftId).andExpect(status().isOk());
		Long frozenVersionId = shiftSessionRepository.findById(shiftId).orElseThrow().getPayPolicyVersion().getId();
		setShiftStart(shiftId, closeAt.minusSeconds(63 * 60L));
		putPolicy(foremanToken, emptyPolicy());

		closeShift(foremanToken, shiftId).andExpect(status().isOk());

		PayCalculation calculation = payCalculationRepository.findByAttendanceIdWithSegments(attendanceId).orElseThrow();
		assertThat(calculation.getPayPolicyVersion().getId()).isEqualTo(frozenVersionId);
		assertThat(calculation.getSegments()).isNotEmpty();
		assertThat(calculation.getTotalBaseAmount()).isEqualByComparingTo("63.00");
		assertThat(calculation.getTotalPremiumAmount()).isEqualByComparingTo("31.50");
		assertThat(calculation.getTotalAmount()).isEqualByComparingTo("94.50");

		mockMvc.perform(get(HISTORY_URL).header(HttpHeaders.AUTHORIZATION, "Bearer " + workerToken))
				.andExpect(status().isOk())
				.andExpect(jsonPath("$[0].attendanceId").value(attendanceId))
				.andExpect(jsonPath("$[0].calculatedSalary").value(94.50))
				.andExpect(jsonPath("$[0].payCalculation.snapshotStatus").value("COMPLETE"))
				.andExpect(jsonPath("$[0].payCalculation.totalBaseAmount").value(63.00))
				.andExpect(jsonPath("$[0].payCalculation.totalPremiumAmount").value(31.50))
				.andExpect(jsonPath("$[0].payCalculation.segments[0].appliedRules[0].name").value("Night"));
		getSummary(foremanToken, shiftId)
				.andExpect(status().isOk())
				.andExpect(jsonPath("$.totalSalary").value(94.50))
				.andExpect(jsonPath("$.totalBaseAmount").value(63.00))
				.andExpect(jsonPath("$.totalPremiumAmount").value(31.50))
				.andExpect(jsonPath("$.workers[0].payCalculation.totalPremiumAmount").value(31.50));
		getSummary(workerToken, shiftId).andExpect(status().isForbidden());

		mockMvc.perform(get(PAYABLE_URL).header(HttpHeaders.AUTHORIZATION, "Bearer " + workerToken))
				.andExpect(status().isOk())
				.andExpect(jsonPath("$[0].rawPayableMinutes").value(63))
				.andExpect(jsonPath("$[0].payoutRoundedMinutes").value(65))
				.andExpect(jsonPath("$[0].calculatedSalary").value(94.50))
				.andExpect(jsonPath("$[0].totalBaseAmount").value(63.00))
				.andExpect(jsonPath("$[0].totalPremiumAmount").value(31.50))
				.andExpect(jsonPath("$[0].payoutAmount").value(95));
		previewPayout(workerToken, attendanceId)
				.andExpect(status().isOk())
				.andExpect(jsonPath("$.exactCalculatedAmount").value(94.50))
				.andExpect(jsonPath("$.totalBaseAmount").value(63.00))
				.andExpect(jsonPath("$.totalPremiumAmount").value(31.50))
				.andExpect(jsonPath("$.payoutAmount").value(95));
		long requestId = extractId(createPayout(workerToken, attendanceId).andExpect(status().isCreated()).andReturn());
		getPayouts(workerToken).andExpect(status().isOk())
				.andExpect(jsonPath("$[0].status").value("PENDING"))
				.andExpect(jsonPath("$[0].exactCalculatedAmount").value(94.50))
				.andExpect(jsonPath("$[0].totalPremiumAmount").value(31.50));
		getManagedPayouts(foremanToken).andExpect(status().isOk())
				.andExpect(jsonPath("$[0].items[0].totalBaseAmount").value(63.00))
				.andExpect(jsonPath("$[0].items[0].totalPremiumAmount").value(31.50));
		mockMvc.perform(post(MANAGED_PAYOUT_URL + "/" + requestId + "/approve")
				.header(HttpHeaders.AUTHORIZATION, "Bearer " + foremanToken))
				.andExpect(status().isOk())
				.andExpect(jsonPath("$.status").value("APPROVED"))
				.andExpect(jsonPath("$.exactCalculatedAmount").value(94.50));
	}

	@Test
	void closeUsesFinalizedAttendanceForDailyAndWeeklyOvertime() throws Exception {
		String foremanToken = registerForeman("overtime.foreman@example.com");
		String workerToken = registerWorker("overtime.worker@example.com");
		putPolicy(foremanToken, overtimePolicy("DAILY_OVERTIME", 60, "100"));

		long dailyFirst = closeAttendance(foremanToken, workerToken,
				Instant.parse("2026-03-30T08:00:00Z"), Instant.parse("2026-03-30T09:00:00Z"));
		long dailySecond = closeAttendance(foremanToken, workerToken,
				Instant.parse("2026-03-30T10:00:00Z"), Instant.parse("2026-03-30T10:30:00Z"));
		assertThat(payCalculationRepository.findByAttendanceIdWithSegments(dailyFirst).orElseThrow().getTotalPremiumAmount())
				.isEqualByComparingTo("0.00");
		assertThat(payCalculationRepository.findByAttendanceIdWithSegments(dailySecond).orElseThrow().getTotalPremiumAmount())
				.isEqualByComparingTo("30.00");

		putPolicy(foremanToken, overtimePolicy("WEEKLY_OVERTIME", 60, "100"));
		long weeklyFirst = closeAttendance(foremanToken, workerToken,
				Instant.parse("2026-04-06T08:00:00Z"), Instant.parse("2026-04-06T09:00:00Z"));
		long weeklySecond = closeAttendance(foremanToken, workerToken,
				Instant.parse("2026-04-07T08:00:00Z"), Instant.parse("2026-04-07T08:30:00Z"));
		assertThat(payCalculationRepository.findByAttendanceIdWithSegments(weeklyFirst).orElseThrow().getTotalPremiumAmount())
				.isEqualByComparingTo("0.00");
		assertThat(payCalculationRepository.findByAttendanceIdWithSegments(weeklySecond).orElseThrow().getTotalPremiumAmount())
				.isEqualByComparingTo("30.00");
	}

	/** Covers real-instant DST duration, pause clipping at a late payable start, and earliest-first static break. */
	@Test
	void closeClipsDynamicPauseThenDeductsStaticBreakAcrossDstBoundary() throws Exception {
		Instant start = Instant.parse("2026-03-29T00:30:00Z"); // 01:30 CET; local clock jumps to 03:00
		Instant end = Instant.parse("2026-03-29T02:30:00Z");   // 04:30 CEST; exactly 120 real minutes later
		clock.set(end);
		String foremanToken = registerForeman("dst.foreman@example.com");
		String workerToken = registerWorker("dst.worker@example.com");
		putPolicy(foremanToken, timeOfDayPolicy("50"));
		long shiftId = createShift(foremanToken, 15, "60.00");
		long attendanceId = joinAndApprove(workerToken, foremanToken, shiftId);
		startShift(foremanToken, shiftId).andExpect(status().isOk());
		setShiftStart(shiftId, start);
		setPayableStart(attendanceId, start.plusSeconds(15 * 60L));
		persistPersonalPause(shiftId, attendanceId, start.plusSeconds(5 * 60L), start.plusSeconds(25 * 60L));

		closeShift(foremanToken, shiftId).andExpect(status().isOk());

		PayCalculation calculation = payCalculationRepository.findByAttendanceIdWithSegments(attendanceId).orElseThrow();
		assertThat(calculation.getTotalRawSeconds()).isEqualByComparingTo("4800.000000000");
		assertThat(calculation.getTotalBaseAmount()).isEqualByComparingTo("80.00");
		assertThat(calculation.getTotalPremiumAmount()).isEqualByComparingTo("40.00");
		assertThat(calculation.getTotalAmount()).isEqualByComparingTo("120.00");
		assertThat(calculation.getSegments().stream().map(segment -> segment.getStart().toInstant())
				.min(Comparator.naturalOrder()).orElseThrow()).isEqualTo(start.plusSeconds(40 * 60L));
		ShiftAttendance attendance = shiftAttendanceRepository.findById(attendanceId).orElseThrow();
		assertThat(attendance.getWorkedMinutes()).isEqualTo(80);
		assertThat(attendance.getPauseMinutes()).isEqualTo(10);
	}

	/**
	 * Keeps sub-minute audit values through close, persistence, API mapping, and payout snapshots. The two one-second
	 * segments deliberately cross the night-rule boundary, making a scale-two-per-segment implementation visibly
	 * wrong while the final attendance settlement still rounds only once.
	 */
	@Test
	void subMinutePremiumAuditAmountsRemainScaleEightUntilSingleAttendanceSettlementRound() throws Exception {
		Instant start = Instant.parse("2026-03-30T19:59:59Z"); // 21:59:59 CEST
		Instant end = Instant.parse("2026-03-30T20:00:01Z");   // 22:00:01 CEST
		clock.set(end);
		String foremanToken = registerForeman("rounding.foreman@example.com");
		String workerToken = registerWorker("rounding.worker@example.com");
		putPolicy(foremanToken, timeOfDayPolicy("50"));
		long shiftId = createShift(foremanToken, 0, "60.00");
		long attendanceId = joinAndApprove(workerToken, foremanToken, shiftId);
		startShift(foremanToken, shiftId).andExpect(status().isOk());
		setShiftStart(shiftId, start);

		closeShortShift(foremanToken, shiftId).andExpect(status().isOk());

		PayCalculation calculation = payCalculationRepository.findByAttendanceIdWithSegments(attendanceId).orElseThrow();
		assertThat(calculation.getSegments()).hasSize(2).allSatisfy((segment) -> {
			assertThat(segment.getBaseAmount().scale()).isEqualTo(8);
			assertThat(segment.getPremiumAmount().scale()).isEqualTo(8);
			assertThat(segment.getTotalAmount().scale()).isEqualTo(8);
			assertThat(segment.getTotalAmount()).isEqualByComparingTo(
					segment.getBaseAmount().add(segment.getPremiumAmount()));
		});
		assertThat(calculation.getTotalBaseAmount()).isEqualByComparingTo("0.03333334");
		assertThat(calculation.getTotalPremiumAmount()).isEqualByComparingTo("0.00833334");
		assertThat(calculation.getTotalAmount()).isEqualByComparingTo("0.04166668");
		assertThat(calculation.getTotalBaseAmount().scale()).isEqualTo(8);
		assertThat(calculation.getTotalPremiumAmount().scale()).isEqualTo(8);
		assertThat(calculation.getTotalAmount().scale()).isEqualTo(8);
		assertThat(sumSegments(calculation, true, false)).isEqualByComparingTo(calculation.getTotalBaseAmount());
		assertThat(sumSegments(calculation, false, true)).isEqualByComparingTo(calculation.getTotalPremiumAmount());
		assertThat(sumSegments(calculation, false, false)).isEqualByComparingTo(calculation.getTotalAmount());
		assertThat(calculation.getTotalAmount()).isEqualByComparingTo(
				calculation.getTotalBaseAmount().add(calculation.getTotalPremiumAmount()));
		assertThat(shiftAttendanceRepository.findById(attendanceId).orElseThrow().getCalculatedSalary())
				.isEqualByComparingTo("0.04");

		mockMvc.perform(get(HISTORY_URL).header(HttpHeaders.AUTHORIZATION, "Bearer " + workerToken))
				.andExpect(status().isOk())
				.andExpect(jsonPath("$[0].calculatedSalary").value(0.04))
				.andExpect(jsonPath("$[0].payCalculation.totalBaseAmount").value(0.03333334))
				.andExpect(jsonPath("$[0].payCalculation.totalPremiumAmount").value(0.00833334))
				.andExpect(jsonPath("$[0].payCalculation.totalAmount").value(0.04166668))
				.andExpect(jsonPath("$[0].payCalculation.segments[0].baseAmount").value(0.01666667));
		previewPayout(workerToken, attendanceId)
				.andExpect(status().isOk())
				.andExpect(jsonPath("$.rawPayableMinutes").value(0))
				.andExpect(jsonPath("$.exactCalculatedAmount").value(0.04))
				.andExpect(jsonPath("$.totalBaseAmount").value(0.03333334))
				.andExpect(jsonPath("$.totalPremiumAmount").value(0.00833334))
				.andExpect(jsonPath("$.payoutAmount").value(1));
		long requestId = extractId(createPayout(workerToken, attendanceId).andExpect(status().isCreated()).andReturn());
		BigDecimal persistedRequestBase = jdbcTemplate.queryForObject(
				"select total_base_amount from payout_requests where id = ?", BigDecimal.class, requestId
		);
		BigDecimal persistedItemPremium = jdbcTemplate.queryForObject(
				"select total_premium_amount from payout_request_items where payout_request_id = ?", BigDecimal.class, requestId
		);
		assertThat(persistedRequestBase).isEqualByComparingTo("0.03333334");
		assertThat(persistedRequestBase.scale()).isEqualTo(8);
		assertThat(persistedItemPremium).isEqualByComparingTo("0.00833334");
		assertThat(persistedItemPremium.scale()).isEqualTo(8);
		getPayouts(workerToken).andExpect(status().isOk())
				.andExpect(jsonPath("$[0].exactCalculatedAmount").value(0.04))
				.andExpect(jsonPath("$[0].totalBaseAmount").value(0.03333334))
				.andExpect(jsonPath("$[0].totalPremiumAmount").value(0.00833334))
				.andExpect(jsonPath("$[0].payoutAmount").value(1));
	}

	private long closeAttendance(String foremanToken, String workerToken, Instant start, Instant end) throws Exception {
		clock.set(end);
		long shiftId = createShift(foremanToken, 0, "60.00");
		long attendanceId = joinAndApprove(workerToken, foremanToken, shiftId);
		startShift(foremanToken, shiftId).andExpect(status().isOk());
		setShiftStart(shiftId, start);
		closeShift(foremanToken, shiftId).andExpect(status().isOk());
		return attendanceId;
	}

	private void putPolicy(String token, String payload) throws Exception {
		mockMvc.perform(put(PAY_POLICY_URL).header(HttpHeaders.AUTHORIZATION, "Bearer " + token)
				.contentType(MediaType.APPLICATION_JSON).content(payload)).andExpect(status().isOk());
	}

	private String timeOfDayPolicy(String premiumPercent) {
		return """
				{"weekStartsOn":"MONDAY","stackingStrategy":"ADD","rules":[
				 {"name":"Night","type":"TIME_OF_DAY","enabled":true,"premiumPercent":%s,
				  "condition":{"startTime":"22:00:00","endTime":"06:00:00"}}]}""".formatted(premiumPercent);
	}

	private String overtimePolicy(String type, int thresholdMinutes, String premiumPercent) {
		return """
				{"weekStartsOn":"MONDAY","stackingStrategy":"ADD","rules":[
				 {"name":"Overtime","type":"%s","enabled":true,"premiumPercent":%s,
				  "condition":{"thresholdMinutes":%d}}]}""".formatted(type, premiumPercent, thresholdMinutes);
	}

	private String emptyPolicy() {
		return "{\"weekStartsOn\":\"MONDAY\",\"stackingStrategy\":\"ADD\",\"rules\":[]}";
	}

	private String registerForeman(String email) throws Exception {
		String token = register(email, "FOREMAN");
		mockMvc.perform(post(CREATE_COMPANY_URL).header(HttpHeaders.AUTHORIZATION, "Bearer " + token)
				.contentType(MediaType.APPLICATION_JSON).content("{\"name\":\"Acceptance Co\"}"))
				.andExpect(status().isCreated());
		return token;
	}

	private String registerWorker(String email) throws Exception {
		String token = register(email, "WORKER");
		String joinCode = companyRepository.findAll().getFirst().getJoinCode();
		mockMvc.perform(post("/api/v1/companies/join").header(HttpHeaders.AUTHORIZATION, "Bearer " + token)
				.contentType(MediaType.APPLICATION_JSON).content("{\"joinCode\":\"" + joinCode + "\"}"))
				.andExpect(status().isOk());
		return token;
	}

	private String register(String email, String role) throws Exception {
		mockMvc.perform(post(REGISTER_URL).contentType(MediaType.APPLICATION_JSON).content("""
				{"email":"%s","password":"password123","firstName":"Acceptance","lastName":"User","role":"%s"}
				""".formatted(email, role))).andExpect(status().isCreated());
		MvcResult login = mockMvc.perform(post(LOGIN_URL).contentType(MediaType.APPLICATION_JSON)
				.content("{\"email\":\"" + email + "\",\"password\":\"password123\"}"))
				.andExpect(status().isOk()).andReturn();
		return extract(login, ACCESS_TOKEN);
	}

	private long createShift(String token, int breakMinutes, String hourlyRate) throws Exception {
		MvcResult result = mockMvc.perform(post(CREATE_SHIFT_URL).header(HttpHeaders.AUTHORIZATION, "Bearer " + token)
				.contentType(MediaType.APPLICATION_JSON).content("""
						{"location":"Berlin","defaultBreakMinutes":%d,"defaultHourlyRate":%s,"foremanHourlyRate":25}
						""".formatted(breakMinutes, hourlyRate)))
				.andExpect(status().isCreated()).andReturn();
		return Long.parseLong(extract(result, ID));
	}

	private long joinAndApprove(String workerToken, String foremanToken, long shiftId) throws Exception {
		String code = shiftSessionRepository.findById(shiftId).orElseThrow().getJoinCode();
		MvcResult result = mockMvc.perform(post("/api/v1/shifts/join").header(HttpHeaders.AUTHORIZATION, "Bearer " + workerToken)
				.contentType(MediaType.APPLICATION_JSON).content("{\"joinCode\":\"" + code + "\"}"))
				.andExpect(status().isOk()).andReturn();
		long attendanceId = Long.parseLong(extract(result, ATTENDANCE_ID));
		mockMvc.perform(post(CREATE_SHIFT_URL + "/" + shiftId + "/attendance/" + attendanceId + "/approve")
				.header(HttpHeaders.AUTHORIZATION, "Bearer " + foremanToken).contentType(MediaType.APPLICATION_JSON).content("{}"))
				.andExpect(status().isOk());
		return attendanceId;
	}

	private ResultActions startShift(String token, long shiftId) throws Exception {
		return mockMvc.perform(post(CREATE_SHIFT_URL + "/" + shiftId + "/start")
				.header(HttpHeaders.AUTHORIZATION, "Bearer " + token));
	}

	private ResultActions closeShift(String token, long shiftId) throws Exception {
		return mockMvc.perform(post(CREATE_SHIFT_URL + "/" + shiftId + "/close")
				.header(HttpHeaders.AUTHORIZATION, "Bearer " + token));
	}

	private ResultActions closeShortShift(String token, long shiftId) throws Exception {
		return mockMvc.perform(post(CREATE_SHIFT_URL + "/" + shiftId + "/close")
				.header(HttpHeaders.AUTHORIZATION, "Bearer " + token)
				.contentType(MediaType.APPLICATION_JSON)
				.content("{\"saveShortShift\":true}"));
	}

	private ResultActions getSummary(String token, long shiftId) throws Exception {
		return mockMvc.perform(get(CREATE_SHIFT_URL + "/" + shiftId + "/summary")
				.header(HttpHeaders.AUTHORIZATION, "Bearer " + token));
	}

	private ResultActions previewPayout(String token, long attendanceId) throws Exception {
		return mockMvc.perform(post(PAYOUT_PREVIEW_URL).header(HttpHeaders.AUTHORIZATION, "Bearer " + token)
				.contentType(MediaType.APPLICATION_JSON).content(selection(attendanceId)));
	}

	private ResultActions createPayout(String token, long attendanceId) throws Exception {
		return mockMvc.perform(post(PAYOUT_URL).header(HttpHeaders.AUTHORIZATION, "Bearer " + token)
				.contentType(MediaType.APPLICATION_JSON).content(selection(attendanceId)));
	}

	private ResultActions getPayouts(String token) throws Exception {
		return mockMvc.perform(get(PAYOUT_URL).header(HttpHeaders.AUTHORIZATION, "Bearer " + token));
	}

	private ResultActions getManagedPayouts(String token) throws Exception {
		return mockMvc.perform(get(MANAGED_PAYOUT_URL).header(HttpHeaders.AUTHORIZATION, "Bearer " + token));
	}

	private String selection(long attendanceId) {
		return "{\"attendanceIds\":[" + attendanceId + "]}";
	}

	private BigDecimal sumSegments(PayCalculation calculation, boolean base, boolean premium) {
		return calculation.getSegments().stream()
				.map((segment) -> base ? segment.getBaseAmount()
						: premium ? segment.getPremiumAmount() : segment.getTotalAmount())
				.reduce(BigDecimal.ZERO, BigDecimal::add)
				.setScale(8);
	}

	private void setShiftStart(long shiftId, Instant start) {
		ShiftSession shift = shiftSessionRepository.findById(shiftId).orElseThrow();
		shift.setActualStartTime(OffsetDateTime.ofInstant(start, ZoneOffset.UTC));
		shiftSessionRepository.saveAndFlush(shift);
	}

	private void setPayableStart(long attendanceId, Instant start) {
		ShiftAttendance attendance = shiftAttendanceRepository.findById(attendanceId).orElseThrow();
		attendance.setPayableStartTime(OffsetDateTime.ofInstant(start, ZoneOffset.UTC));
		shiftAttendanceRepository.saveAndFlush(attendance);
	}

	private void persistPersonalPause(long shiftId, long attendanceId, Instant start, Instant end) {
		ShiftAttendance attendance = shiftAttendanceRepository.findById(attendanceId).orElseThrow();
		ShiftPauseInterval pause = new ShiftPauseInterval();
		pause.setShiftSession(shiftSessionRepository.findById(shiftId).orElseThrow());
		pause.setUser(attendance.getWorker());
		pause.setScope(PauseScope.PERSONAL);
		pause.setStartedAt(OffsetDateTime.ofInstant(start, ZoneOffset.UTC));
		pause.setEndedAt(OffsetDateTime.ofInstant(end, ZoneOffset.UTC));
		shiftPauseIntervalRepository.saveAndFlush(pause);
	}

	private long extractId(MvcResult result) throws Exception {
		return Long.parseLong(extract(result, ID));
	}

	private String extract(MvcResult result, Pattern pattern) throws Exception {
		return extract(result.getResponse().getContentAsString(), pattern);
	}

	private String extract(String response, Pattern pattern) {
		Matcher matcher = pattern.matcher(response);
		assertThat(matcher.find()).isTrue();
		return matcher.group(1);
	}

	@TestConfiguration
	static class AcceptanceClockConfiguration {
		@Bean
		@Primary
		MutableClock acceptanceClock() {
			return new MutableClock();
		}
	}

	static final class MutableClock extends Clock {
		private final AtomicReference<Instant> instant = new AtomicReference<>();

		void set(Instant value) {
			instant.set(value);
		}

		void reset() {
			instant.set(null);
		}

		@Override
		public ZoneId getZone() {
			return ZoneOffset.UTC;
		}

		@Override
		public Clock withZone(ZoneId zone) {
			return ZoneOffset.UTC.equals(zone) ? this : Clock.fixed(instant(), zone);
		}

		@Override
		public Instant instant() {
			Instant value = instant.get();
			return value == null ? Instant.now() : value;
		}
	}
}
