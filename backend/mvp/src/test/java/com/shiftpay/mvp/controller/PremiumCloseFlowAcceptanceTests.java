package com.shiftpay.mvp.controller;

import com.shiftpay.mvp.TestDataCleaner;
import com.shiftpay.mvp.entity.PauseScope;
import com.shiftpay.mvp.entity.PayCalculation;
import com.shiftpay.mvp.entity.PayPolicyRuleType;
import com.shiftpay.mvp.entity.PaySegment;
import com.shiftpay.mvp.entity.ShiftAttendance;
import com.shiftpay.mvp.entity.ShiftPauseInterval;
import com.shiftpay.mvp.entity.ShiftSession;
import com.shiftpay.mvp.repository.CompanyRepository;
import com.shiftpay.mvp.repository.PayCalculationRepository;
import com.shiftpay.mvp.repository.ShiftAttendanceRepository;
import com.shiftpay.mvp.repository.ShiftPauseIntervalRepository;
import com.shiftpay.mvp.repository.ShiftSessionRepository;
import com.shiftpay.mvp.service.AppliedPremiumRulesJson;
import tools.jackson.core.JsonParser;
import tools.jackson.core.JsonToken;
import tools.jackson.databind.json.JsonMapper;
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
import java.util.HashSet;
import java.util.LinkedHashMap;
import java.util.Map;
import java.util.Set;
import java.util.concurrent.atomic.AtomicReference;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
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

	/** Scenario A: a regular eight-hour shift persists base-only audit values and settlement salary. */
	@Test
	void scenarioA_regularShiftClosesWithBaseOnlySnapshotAndMappedSettlement() throws Exception {
		String foremanToken = registerForeman("scenario.a.foreman@example.com");
		String workerToken = registerWorker("scenario.a.worker@example.com");
		putPolicy(foremanToken, emptyPolicy());

		ClosedShift closed = closeApprovedShift(
				foremanToken,
				workerToken,
				Instant.parse("2026-01-07T07:00:00Z"), // 08:00 Europe/Berlin
				Instant.parse("2026-01-07T15:00:00Z"), // 16:00 Europe/Berlin
				"20.00"
		);

		PayCalculation calculation = calculationFor(closed.attendanceId());
		assertCalculationAudit(calculation, "160.00000000", "0.00000000", "160.00000000");
		assertThat(calculation.getSegments()).hasSize(1);
		assertThat(calculation.getSegments().getFirst().getAppliedRulesSnapshot()).isEqualTo("[]");
		assertSettlementSalary(closed.attendanceId(), "160.00");
		assertWorkerHistoryMapping(workerToken, closed.attendanceId(), "160.00", "160.00000000", "0.00000000");
		assertForemanBaseOnlySalary(foremanToken, closed.shiftId(), "200.00");
		getSummary(foremanToken, closed.shiftId())
				.andExpect(status().isOk())
				.andExpect(jsonPath("$.totalSalary").value(160.00))
				.andExpect(jsonPath("$.totalBaseAmount").value(160.00))
				.andExpect(jsonPath("$.totalPremiumAmount").value(0.00))
				.andExpect(jsonPath("$.workers[0].salary").value(160.00))
				.andExpect(jsonPath("$.foremanSalary").value(200.00));
	}

	/** Scenario B: local 22:00 is a persisted regular/night segmentation boundary. */
	@Test
	void scenarioB_nightBoundaryPersistsRegularAndPremiumSegments() throws Exception {
		String foremanToken = registerForeman("scenario.b.foreman@example.com");
		String workerToken = registerWorker("scenario.b.worker@example.com");
		putPolicy(foremanToken, timeOfDayPolicy("25"));

		ClosedShift closed = closeApprovedShift(
				foremanToken, workerToken,
				Instant.parse("2026-01-05T17:00:00Z"), // 18:00 CET
				Instant.parse("2026-01-06T03:00:00Z"), // 04:00 CET
				"20.00"
		);

		PayCalculation calculation = calculationFor(closed.attendanceId());
		assertCalculationAudit(calculation, "200.00000000", "30.00000000", "230.00000000");
		assertSettlementSalary(closed.attendanceId(), "230.00");
		assertThat(calculation.getSegments()).hasSize(3); // midnight remains a deterministic calendar boundary
		PaySegment regular = segmentStartingAt(calculation, Instant.parse("2026-01-05T17:00:00Z"));
		PaySegment night = segmentStartingAt(calculation, Instant.parse("2026-01-05T21:00:00Z"));
		assertThat(regular.getEnd().toInstant()).isEqualTo(Instant.parse("2026-01-05T21:00:00Z"));
		assertThat(regular.getAppliedRulesSnapshot()).isEqualTo("[]");
		assertThat(night.getEnd().toInstant()).isEqualTo(Instant.parse("2026-01-05T23:00:00Z"));
		assertThat(night.getEffectivePremiumPercent()).isEqualByComparingTo("25.0000");
		assertThat(night.getAppliedRulesSnapshot()).contains("Night");
		assertThat(segmentStartingAt(calculation, Instant.parse("2026-01-05T23:00:00Z")).getEnd().toInstant())
				.isEqualTo(Instant.parse("2026-01-06T03:00:00Z"));
		assertWorkerHistoryMapping(workerToken, closed.attendanceId(), "230.00", "200.00000000", "30.00000000");
		assertForemanBaseOnlySalary(foremanToken, closed.shiftId(), "250.00");
		getSummary(foremanToken, closed.shiftId())
				.andExpect(status().isOk())
				.andExpect(jsonPath("$.workers[0].payCalculation.segments[1].effectiveHourlyRate").value(25.00));
	}

	/** Scenario C: the persisted close calculation uses the configured decimal percentage, not a night constant. */
	@Test
	void scenarioC_configurableDecimalNightPremiumSurvivesCloseAndMapping() throws Exception {
		String foremanToken = registerForeman("scenario.c.foreman@example.com");
		String workerToken = registerWorker("scenario.c.worker@example.com");
		putPolicy(foremanToken, timeOfDayPolicy("37.5"));

		ClosedShift closed = closeApprovedShift(
				foremanToken, workerToken,
				Instant.parse("2026-01-05T21:00:00Z"),
				Instant.parse("2026-01-05T22:00:00Z"),
				"20.00"
		);

		PayCalculation calculation = calculationFor(closed.attendanceId());
		assertCalculationAudit(calculation, "20.00000000", "7.50000000", "27.50000000");
		PaySegment night = calculation.getSegments().getFirst();
		assertThat(night.getEffectivePremiumPercent()).isEqualByComparingTo("37.5000");
		assertThat(night.getEffectiveHourlyRate()).isEqualByComparingTo("27.50000000");
		assertSettlementSalary(closed.attendanceId(), "27.50");
		assertWorkerHistoryMapping(workerToken, closed.attendanceId(), "27.50", "20.00000000", "7.50000000");
		assertForemanBaseOnlySalary(foremanToken, closed.shiftId(), "25.00");
		getSummary(foremanToken, closed.shiftId())
				.andExpect(status().isOk())
				.andExpect(jsonPath("$.workers[0].payCalculation.segments[0].effectivePremiumPercent").value(37.5));
	}

	/** Scenario D: a 12-hour shift applies daily overtime to its final four hours only. */
	@Test
	void scenarioD_dailyOvertimeSplitsFinalFourHoursAtClose() throws Exception {
		String foremanToken = registerForeman("scenario.d.foreman@example.com");
		String workerToken = registerWorker("scenario.d.worker@example.com");
		putPolicy(foremanToken, overtimePolicy("DAILY_OVERTIME", 480, "50"));

		ClosedShift closed = closeApprovedShift(
				foremanToken, workerToken,
				Instant.parse("2026-01-07T07:00:00Z"), // 08:00 CET
				Instant.parse("2026-01-07T19:00:00Z"), // 20:00 CET
				"20.00"
		);

		PayCalculation calculation = calculationFor(closed.attendanceId());
		assertCalculationAudit(calculation, "240.00000000", "40.00000000", "280.00000000");
		assertSettlementSalary(closed.attendanceId(), "280.00");
		assertThat(calculation.getSegments()).hasSize(2);
		assertThat(segmentStartingAt(calculation, Instant.parse("2026-01-07T07:00:00Z")).getAppliedRulesSnapshot())
				.isEqualTo("[]");
		PaySegment overtime = segmentStartingAt(calculation, Instant.parse("2026-01-07T15:00:00Z"));
		assertThat(overtime.getEnd().toInstant()).isEqualTo(Instant.parse("2026-01-07T19:00:00Z"));
		assertThat(overtime.getEffectivePremiumPercent()).isEqualByComparingTo("50.0000");
		assertWorkerHistoryMapping(workerToken, closed.attendanceId(), "280.00", "240.00000000", "40.00000000");
		assertForemanBaseOnlySalary(foremanToken, closed.shiftId(), "300.00");
		getSummary(foremanToken, closed.shiftId())
				.andExpect(status().isOk())
				.andExpect(jsonPath("$.workers[0].payCalculation.segments[1].appliedRules[0].name").value("Overtime"));
	}

	/** Scenario E: finalized previous attendance contributes to the second session's daily overtime context. */
	@Test
	void scenarioE_multipleSessionsApplyDailyOvertimeOnlyAfterCombinedThreshold() throws Exception {
		String foremanToken = registerForeman("scenario.e.foreman@example.com");
		String workerToken = registerWorker("scenario.e.worker@example.com");
		putPolicy(foremanToken, overtimePolicy("DAILY_OVERTIME", 480, "50"));

		ClosedShift first = closeApprovedShift(
				foremanToken, workerToken,
				Instant.parse("2026-01-07T07:00:00Z"),
				Instant.parse("2026-01-07T11:00:00Z"), "20.00"
		);
		ClosedShift second = closeApprovedShift(
				foremanToken, workerToken,
				Instant.parse("2026-01-07T13:00:00Z"),
				Instant.parse("2026-01-07T19:00:00Z"), "20.00"
		);

		assertCalculationAudit(calculationFor(first.attendanceId()), "80.00000000", "0.00000000", "80.00000000");
		assertSettlementSalary(first.attendanceId(), "80.00");
		assertWorkerHistorySettlementScale(workerToken, first.attendanceId(), "80.00");
		assertForemanBaseOnlySalary(foremanToken, first.shiftId(), "100.00");
		PayCalculation calculation = calculationFor(second.attendanceId());
		assertCalculationAudit(calculation, "120.00000000", "20.00000000", "140.00000000");
		assertSettlementSalary(second.attendanceId(), "140.00");
		assertThat(calculation.getSegments()).hasSize(2);
		assertThat(segmentStartingAt(calculation, Instant.parse("2026-01-07T13:00:00Z")).getAppliedRulesSnapshot())
				.isEqualTo("[]");
		assertThat(segmentStartingAt(calculation, Instant.parse("2026-01-07T17:00:00Z")).getAppliedRulesSnapshot())
				.contains("Overtime");
		assertWorkerHistoryMapping(workerToken, second.attendanceId(), "140.00", "120.00000000", "20.00000000");
		getSummary(foremanToken, second.shiftId())
				.andExpect(status().isOk())
				.andExpect(jsonPath("$.workers[0].salary").value(140.00));
		assertForemanBaseOnlySalary(foremanToken, second.shiftId(), "150.00");
	}

	/** Scenario F: ADD persists all matching night, Sunday, and daily-overtime rules on their overlap. */
	@Test
	void scenarioF_addStackingPersistsAllMatchingRulesAtEffectiveRate() throws Exception {
		String foremanToken = registerForeman("scenario.f.foreman@example.com");
		String workerToken = registerWorker("scenario.f.worker@example.com");
		Map<RuleIdentity, Long> policyRuleIds = putPolicy(foremanToken, combinedSundayNightOvertimePolicy("ADD"));

		ClosedShift closed = closeApprovedShift(
				foremanToken, workerToken,
				Instant.parse("2026-01-04T11:00:00Z"), // Sunday 12:00 CET
				Instant.parse("2026-01-04T22:00:00Z"), // Sunday 23:00 CET
				"20.00"
		);

		PayCalculation calculation = calculationFor(closed.attendanceId());
		assertCalculationAudit(calculation, "220.00000000", "145.00000000", "365.00000000");
		assertThat(calculation.getSegments()).hasSize(3);
		assertSegment(
				calculation,
				Instant.parse("2026-01-04T11:00:00Z"),
				Instant.parse("2026-01-04T19:00:00Z"),
				"160.00000000", "80.00000000", "240.00000000", "50.0000", "30.00000000",
				rule(policyRuleIds, "Sunday", PayPolicyRuleType.DAY_OF_WEEK, "50.0000")
		);
		assertSegment(
				calculation,
				Instant.parse("2026-01-04T19:00:00Z"),
				Instant.parse("2026-01-04T21:00:00Z"),
				"40.00000000", "40.00000000", "80.00000000", "100.0000", "40.00000000",
				rule(policyRuleIds, "Sunday", PayPolicyRuleType.DAY_OF_WEEK, "50.0000"),
				rule(policyRuleIds, "Overtime", PayPolicyRuleType.DAILY_OVERTIME, "50.0000")
		);
		assertSegment(
				calculation,
				Instant.parse("2026-01-04T21:00:00Z"),
				Instant.parse("2026-01-04T22:00:00Z"),
				"20.00000000", "25.00000000", "45.00000000", "125.0000", "45.00000000",
				rule(policyRuleIds, "Night", PayPolicyRuleType.TIME_OF_DAY, "25.0000"),
				rule(policyRuleIds, "Sunday", PayPolicyRuleType.DAY_OF_WEEK, "50.0000"),
				rule(policyRuleIds, "Overtime", PayPolicyRuleType.DAILY_OVERTIME, "50.0000")
		);
		assertSettlementSalary(closed.attendanceId(), "365.00");
		assertWorkerHistoryMapping(workerToken, closed.attendanceId(), "365.00", "220.00000000", "145.00000000");
		assertForemanBaseOnlySalary(foremanToken, closed.shiftId(), "275.00");
		getSummary(foremanToken, closed.shiftId())
				.andExpect(status().isOk())
				.andExpect(jsonPath("$.foremanSalary").value(275.00))
				.andExpect(jsonPath("$.workers[0].payCalculation.segments[2].effectiveHourlyRate").value(45.00));
	}

	/** Scenario G: HIGHEST_ONLY persists only tied highest rules, excluding the lower night premium. */
	@Test
	void scenarioG_highestOnlyStackingPersistsOnlyHighestMatchingRules() throws Exception {
		String foremanToken = registerForeman("scenario.g.foreman@example.com");
		String workerToken = registerWorker("scenario.g.worker@example.com");
		Map<RuleIdentity, Long> policyRuleIds = putPolicy(
				foremanToken,
				combinedSundayNightOvertimePolicy("HIGHEST_ONLY")
		);

		ClosedShift closed = closeApprovedShift(
				foremanToken, workerToken,
				Instant.parse("2026-01-04T11:00:00Z"),
				Instant.parse("2026-01-04T22:00:00Z"), "20.00"
		);

		PayCalculation calculation = calculationFor(closed.attendanceId());
		assertCalculationAudit(calculation, "220.00000000", "110.00000000", "330.00000000");
		assertThat(calculation.getSegments()).hasSize(3);
		assertSegment(
				calculation,
				Instant.parse("2026-01-04T11:00:00Z"),
				Instant.parse("2026-01-04T19:00:00Z"),
				"160.00000000", "80.00000000", "240.00000000", "50.0000", "30.00000000",
				rule(policyRuleIds, "Sunday", PayPolicyRuleType.DAY_OF_WEEK, "50.0000")
		);
		assertSegment(
				calculation,
				Instant.parse("2026-01-04T19:00:00Z"),
				Instant.parse("2026-01-04T21:00:00Z"),
				"40.00000000", "20.00000000", "60.00000000", "50.0000", "30.00000000",
				rule(policyRuleIds, "Sunday", PayPolicyRuleType.DAY_OF_WEEK, "50.0000"),
				rule(policyRuleIds, "Overtime", PayPolicyRuleType.DAILY_OVERTIME, "50.0000")
		);
		assertSegment(
				calculation,
				Instant.parse("2026-01-04T21:00:00Z"),
				Instant.parse("2026-01-04T22:00:00Z"),
				"20.00000000", "10.00000000", "30.00000000", "50.0000", "30.00000000",
				rule(policyRuleIds, "Sunday", PayPolicyRuleType.DAY_OF_WEEK, "50.0000"),
				rule(policyRuleIds, "Overtime", PayPolicyRuleType.DAILY_OVERTIME, "50.0000")
		);
		assertAppliedRuleIdsAbsent(
				segmentStartingAt(calculation, Instant.parse("2026-01-04T21:00:00Z")),
				policyRuleId(policyRuleIds, "Night", PayPolicyRuleType.TIME_OF_DAY)
		);
		assertSettlementSalary(closed.attendanceId(), "330.00");
		assertWorkerHistoryMapping(workerToken, closed.attendanceId(), "330.00", "220.00000000", "110.00000000");
		assertForemanBaseOnlySalary(foremanToken, closed.shiftId(), "275.00");
		getSummary(foremanToken, closed.shiftId())
				.andExpect(status().isOk())
				.andExpect(jsonPath("$.workers[0].payCalculation.segments[2].effectiveHourlyRate").value(30.00));
	}

	/** Scenario H: Sunday premium starts exactly at Europe/Berlin's local midnight across Saturday/Sunday. */
	@Test
	void scenarioH_saturdayToSundayStartsSundayPremiumAtCompanyLocalMidnight() throws Exception {
		String foremanToken = registerForeman("scenario.h.foreman@example.com", "Europe/Berlin");
		String workerToken = registerWorker("scenario.h.worker@example.com");
		putPolicy(foremanToken, sundayPolicy("50"));

		ClosedShift closed = closeApprovedShift(
				foremanToken, workerToken,
				Instant.parse("2026-01-03T22:00:00Z"), // Saturday 23:00 CET
				Instant.parse("2026-01-04T00:00:00Z"), // Sunday 01:00 CET
				"20.00"
		);

		PayCalculation calculation = calculationFor(closed.attendanceId());
		assertCalculationAudit(calculation, "40.00000000", "10.00000000", "50.00000000");
		assertThat(calculation.getSegments()).hasSize(2);
		assertThat(segmentStartingAt(calculation, Instant.parse("2026-01-03T22:00:00Z")).getAppliedRulesSnapshot())
				.isEqualTo("[]");
		PaySegment sunday = segmentStartingAt(calculation, Instant.parse("2026-01-03T23:00:00Z"));
		assertThat(sunday.getEnd().toInstant()).isEqualTo(Instant.parse("2026-01-04T00:00:00Z"));
		assertThat(sunday.getAppliedRulesSnapshot()).contains("Sunday");
		assertSettlementSalary(closed.attendanceId(), "50.00");
		assertWorkerHistoryMapping(workerToken, closed.attendanceId(), "50.00", "40.00000000", "10.00000000");
		assertForemanBaseOnlySalary(foremanToken, closed.shiftId(), "50.00");
		getSummary(foremanToken, closed.shiftId())
				.andExpect(status().isOk())
				.andExpect(jsonPath("$.workers[0].payCalculation.segments[1].effectivePremiumPercent").value(50.00));
	}

	/** Scenario I: old snapshots remain immutable after a policy update while a newly started shift uses the new version. */
	@Test
	void scenarioI_historicalPolicyVersionRemainsFrozenAfterCurrentPolicyUpdate() throws Exception {
		String foremanToken = registerForeman("scenario.i.foreman@example.com");
		String workerToken = registerWorker("scenario.i.worker@example.com");
		putPolicy(foremanToken, timeOfDayPolicy("25"));

		Instant oldStart = Instant.parse("2026-01-05T21:00:00Z");
		Instant oldEnd = Instant.parse("2026-01-05T22:00:00Z");
		clock.set(oldEnd);
		long oldShiftId = createShift(foremanToken, 0, "20.00");
		long oldAttendanceId = joinAndApprove(workerToken, foremanToken, oldShiftId);
		startShift(foremanToken, oldShiftId).andExpect(status().isOk());
		Long oldFrozenVersionId = shiftSessionRepository.findById(oldShiftId).orElseThrow().getPayPolicyVersion().getId();
		setShiftStart(oldShiftId, oldStart);
		closeShift(foremanToken, oldShiftId).andExpect(status().isOk());

		putPolicy(foremanToken, timeOfDayPolicy("40"));
		PayCalculation oldCalculation = calculationFor(oldAttendanceId);
		assertCalculationAudit(oldCalculation, "20.00000000", "5.00000000", "25.00000000");
		assertThat(oldCalculation.getPayPolicyVersion().getId()).isEqualTo(oldFrozenVersionId);
		assertThat(oldCalculation.getSegments().getFirst().getEffectivePremiumPercent()).isEqualByComparingTo("25.0000");
		assertSettlementSalary(oldAttendanceId, "25.00");
		assertWorkerHistoryMapping(workerToken, oldAttendanceId, "25.00", "20.00000000", "5.00000000");
		assertForemanBaseOnlySalary(foremanToken, oldShiftId, "25.00");
		getSummary(foremanToken, oldShiftId)
				.andExpect(status().isOk())
				.andExpect(jsonPath("$.workers[0].payCalculation.segments[0].effectivePremiumPercent").value(25.00));

		ClosedShift current = closeApprovedShift(
				foremanToken, workerToken,
				Instant.parse("2026-01-06T21:00:00Z"),
				Instant.parse("2026-01-06T22:00:00Z"), "20.00"
		);
		PayCalculation currentCalculation = calculationFor(current.attendanceId());
		assertCalculationAudit(currentCalculation, "20.00000000", "8.00000000", "28.00000000");
		assertThat(currentCalculation.getPayPolicyVersion().getId()).isNotEqualTo(oldFrozenVersionId);
		assertThat(currentCalculation.getSegments().getFirst().getEffectivePremiumPercent()).isEqualByComparingTo("40.0000");
		assertSettlementSalary(current.attendanceId(), "28.00");
		assertWorkerHistoryMapping(workerToken, current.attendanceId(), "28.00", "20.00000000", "8.00000000");
		assertForemanBaseOnlySalary(foremanToken, current.shiftId(), "25.00");
		getSummary(foremanToken, current.shiftId())
				.andExpect(status().isOk())
				.andExpect(jsonPath("$.workers[0].payCalculation.segments[0].effectivePremiumPercent").value(40.00));
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
		return closeApprovedShift(foremanToken, workerToken, start, end, "60.00").attendanceId();
	}

	private ClosedShift closeApprovedShift(
			String foremanToken,
			String workerToken,
			Instant start,
			Instant end,
			String hourlyRate
	) throws Exception {
		clock.set(end);
		long shiftId = createShift(foremanToken, 0, hourlyRate);
		long attendanceId = joinAndApprove(workerToken, foremanToken, shiftId);
		startShift(foremanToken, shiftId).andExpect(status().isOk());
		setShiftStart(shiftId, start);
		closeShift(foremanToken, shiftId).andExpect(status().isOk());
		return new ClosedShift(shiftId, attendanceId);
	}

	private Map<RuleIdentity, Long> putPolicy(String token, String payload) throws Exception {
		MvcResult response = mockMvc.perform(put(PAY_POLICY_URL).header(HttpHeaders.AUTHORIZATION, "Bearer " + token)
				.contentType(MediaType.APPLICATION_JSON).content(payload))
				.andExpect(status().isOk())
				.andReturn();
		return policyRuleIds(response.getResponse().getContentAsString());
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

	private String combinedSundayNightOvertimePolicy(String stackingStrategy) {
		return """
				{"weekStartsOn":"MONDAY","stackingStrategy":"%s","rules":[
				 {"name":"Night","type":"TIME_OF_DAY","enabled":true,"premiumPercent":25,
				  "condition":{"startTime":"22:00:00","endTime":"06:00:00"}},
				 {"name":"Sunday","type":"DAY_OF_WEEK","enabled":true,"premiumPercent":50,
				  "condition":{"weekdays":["SUNDAY"]}},
				 {"name":"Overtime","type":"DAILY_OVERTIME","enabled":true,"premiumPercent":50,
				  "condition":{"thresholdMinutes":480}}]}""".formatted(stackingStrategy);
	}

	private String sundayPolicy(String premiumPercent) {
		return """
				{"weekStartsOn":"MONDAY","stackingStrategy":"ADD","rules":[
				 {"name":"Sunday","type":"DAY_OF_WEEK","enabled":true,"premiumPercent":%s,
				  "condition":{"weekdays":["SUNDAY"]}}]}""".formatted(premiumPercent);
	}

	private String emptyPolicy() {
		return "{\"weekStartsOn\":\"MONDAY\",\"stackingStrategy\":\"ADD\",\"rules\":[]}";
	}

	private String registerForeman(String email) throws Exception {
		return registerForeman(email, "Europe/Berlin");
	}

	private String registerForeman(String email, String timeZone) throws Exception {
		String token = register(email, "FOREMAN");
		mockMvc.perform(post(CREATE_COMPANY_URL).header(HttpHeaders.AUTHORIZATION, "Bearer " + token)
				.contentType(MediaType.APPLICATION_JSON)
				.content("{\"name\":\"Acceptance Co\",\"timeZone\":\"" + timeZone + "\"}"))
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

	private PayCalculation calculationFor(long attendanceId) {
		return payCalculationRepository.findByAttendanceIdWithSegments(attendanceId).orElseThrow();
	}

	private PaySegment segmentStartingAt(PayCalculation calculation, Instant start) {
		return calculation.getSegments().stream()
				.filter((segment) -> segment.getStart().toInstant().equals(start))
				.findFirst()
				.orElseThrow();
	}

	private void assertSegment(
			PayCalculation calculation,
			Instant expectedStart,
			Instant expectedEnd,
			String expectedBase,
			String expectedPremium,
			String expectedTotal,
			String expectedEffectivePremiumPercent,
			String expectedEffectiveHourlyRate,
			ExpectedRule... expectedRules
	) {
		PaySegment segment = segmentStartingAt(calculation, expectedStart);
		assertThat(segment.getStart().toInstant()).isEqualTo(expectedStart);
		assertThat(segment.getEnd().toInstant()).isEqualTo(expectedEnd);
		assertAuditAmount(segment.getBaseAmount(), expectedBase);
		assertAuditAmount(segment.getPremiumAmount(), expectedPremium);
		assertAuditAmount(segment.getTotalAmount(), expectedTotal);
		assertThat(segment.getTotalAmount()).isEqualByComparingTo(
				segment.getBaseAmount().add(segment.getPremiumAmount())
		);
		assertThat(segment.getEffectivePremiumPercent()).isEqualByComparingTo(expectedEffectivePremiumPercent);
		assertThat(segment.getEffectiveHourlyRate()).isEqualByComparingTo(expectedEffectiveHourlyRate);
		assertStructuredAppliedRules(segment, expectedRules);
	}

	private void assertAuditAmount(BigDecimal actual, String expected) {
		assertThat(actual).isEqualByComparingTo(expected);
		assertThat(actual.scale()).isEqualTo(8);
	}

	private void assertStructuredAppliedRules(PaySegment segment, ExpectedRule... expectedRules) {
		AppliedPremiumRulesJson.ReadResult result = AppliedPremiumRulesJson.read(
				segment.getAppliedRulesSnapshot(),
				segment.getId()
		);
		assertThat(result.snapshotStatus().name()).isEqualTo("COMPLETE");
		assertThat(result.appliedRules()).hasSize(expectedRules.length);
		Set<Long> actualIds = new HashSet<>();
		for (int index = 0; index < expectedRules.length; index++) {
			ExpectedRule expected = expectedRules[index];
			var actual = result.appliedRules().get(index);
			assertThat(actual.id()).isNotNull();
			assertThat(actualIds.add(actual.id())).isTrue();
			assertThat(actual.id()).isEqualTo(expected.id());
			assertThat(actual.name()).isEqualTo(expected.name());
			assertThat(actual.type()).isEqualTo(expected.type());
			assertThat(actual.premiumPercent()).isEqualByComparingTo(expected.premiumPercent());
		}
	}

	private void assertAppliedRuleIdsAbsent(PaySegment segment, Long... forbiddenIds) {
		AppliedPremiumRulesJson.ReadResult result = AppliedPremiumRulesJson.read(
				segment.getAppliedRulesSnapshot(),
				segment.getId()
		);
		assertThat(result.snapshotStatus().name()).isEqualTo("COMPLETE");
		Set<Long> actualIds = result.appliedRules().stream()
				.map((rule) -> rule.id())
				.collect(java.util.stream.Collectors.toSet());
		assertThat(actualIds).doesNotContain(forbiddenIds);
	}

	private ExpectedRule rule(
			Map<RuleIdentity, Long> policyRuleIds,
			String name,
			PayPolicyRuleType type,
			String premiumPercent
	) {
		return new ExpectedRule(policyRuleId(policyRuleIds, name, type), name, type, premiumPercent);
	}

	private Long policyRuleId(Map<RuleIdentity, Long> policyRuleIds, String name, PayPolicyRuleType type) {
		Long ruleId = policyRuleIds.get(new RuleIdentity(name, type));
		assertThat(ruleId).isNotNull();
		return ruleId;
	}

	private void assertCalculationAudit(
			PayCalculation calculation,
			String expectedBase,
			String expectedPremium,
			String expectedTotal
	) {
		assertThat(calculation.getTotalBaseAmount()).isEqualByComparingTo(expectedBase);
		assertThat(calculation.getTotalPremiumAmount()).isEqualByComparingTo(expectedPremium);
		assertThat(calculation.getTotalAmount()).isEqualByComparingTo(expectedTotal);
		assertThat(calculation.getTotalBaseAmount().scale()).isEqualTo(8);
		assertThat(calculation.getTotalPremiumAmount().scale()).isEqualTo(8);
		assertThat(calculation.getTotalAmount().scale()).isEqualTo(8);
		assertThat(sumSegments(calculation, true, false)).isEqualByComparingTo(calculation.getTotalBaseAmount());
		assertThat(sumSegments(calculation, false, true)).isEqualByComparingTo(calculation.getTotalPremiumAmount());
		assertThat(sumSegments(calculation, false, false)).isEqualByComparingTo(calculation.getTotalAmount());
		assertThat(calculation.getTotalAmount()).isEqualByComparingTo(
				calculation.getTotalBaseAmount().add(calculation.getTotalPremiumAmount())
		);
		assertThat(calculation.getSegments()).allSatisfy((segment) -> {
			assertThat(segment.getBaseAmount().scale()).isEqualTo(8);
			assertThat(segment.getPremiumAmount().scale()).isEqualTo(8);
			assertThat(segment.getTotalAmount().scale()).isEqualTo(8);
			assertThat(segment.getTotalAmount()).isEqualByComparingTo(
					segment.getBaseAmount().add(segment.getPremiumAmount())
			);
		});
	}

	private void assertSettlementSalary(long attendanceId, String expectedSalary) {
		BigDecimal salary = shiftAttendanceRepository.findById(attendanceId).orElseThrow().getCalculatedSalary();
		assertThat(salary).isEqualByComparingTo(expectedSalary);
		assertThat(salary.scale()).isEqualTo(2);
	}

	private void assertWorkerHistoryMapping(
			String workerToken,
			long attendanceId,
			String expectedSalary,
			String expectedBase,
			String expectedPremium
	) throws Exception {
		MvcResult history = mockMvc.perform(get(HISTORY_URL).header(HttpHeaders.AUTHORIZATION, "Bearer " + workerToken))
				.andExpect(status().isOk())
				.andExpect(jsonPath("$[0].attendanceId").value(attendanceId))
				.andExpect(jsonPath("$[0].payCalculation.totalBaseAmount").value(Double.parseDouble(expectedBase)))
				.andExpect(jsonPath("$[0].payCalculation.totalPremiumAmount").value(Double.parseDouble(expectedPremium)))
				.andExpect(jsonPath("$[0].payCalculation.totalAmount").value(
						new BigDecimal(expectedBase).add(new BigDecimal(expectedPremium)).doubleValue()))
				.andExpect(jsonPath("$[0].payCalculation.snapshotStatus").value("COMPLETE"))
				.andReturn();
		assertHistorySalaryToken(history.getResponse().getContentAsString(), attendanceId, expectedSalary);
	}

	private void assertWorkerHistorySettlementScale(String workerToken, long attendanceId, String expectedSalary) throws Exception {
		MvcResult history = mockMvc.perform(get(HISTORY_URL).header(HttpHeaders.AUTHORIZATION, "Bearer " + workerToken))
				.andExpect(status().isOk())
				.andReturn();
		assertHistorySalaryToken(history.getResponse().getContentAsString(), attendanceId, expectedSalary);
	}

	private void assertHistorySalaryToken(String response, long attendanceId, String expectedSalary) {
		int matchingItems = 0;
		TopLevelHistoryItem matchingItem = null;
		try (JsonParser parser = JsonMapper.shared().createParser(response)) {
			assertThat(parser.nextToken()).isEqualTo(JsonToken.START_ARRAY);
			while (parser.nextToken() != JsonToken.END_ARRAY) {
				assertThat(parser.currentToken()).isEqualTo(JsonToken.START_OBJECT);
				Long itemAttendanceId = null;
				JsonToken itemSalaryTokenKind = null;
				String itemSalaryTokenText = null;
				while (parser.nextToken() != JsonToken.END_OBJECT) {
					String fieldName = parser.currentName();
					JsonToken valueToken = parser.nextToken();
					if ("attendanceId".equals(fieldName)) {
						if (valueToken == JsonToken.VALUE_NUMBER_INT) {
							itemAttendanceId = parser.getLongValue();
						}
					}
					else if ("calculatedSalary".equals(fieldName)) {
						itemSalaryTokenKind = valueToken;
						if (valueToken.isNumeric()) {
							itemSalaryTokenText = parser.getText();
						}
					}
					// This skips complete nested values, so only direct history-item fields participate.
					parser.skipChildren();
				}
				if (Long.valueOf(attendanceId).equals(itemAttendanceId)) {
					matchingItems++;
					matchingItem = new TopLevelHistoryItem(itemAttendanceId, itemSalaryTokenKind, itemSalaryTokenText);
				}
			}
		}
		catch (Exception exception) {
			throw new AssertionError("Could not parse worker history response", exception);
		}
		if (matchingItems == 0) {
			throw new AssertionError("Worker history did not contain top-level attendanceId " + attendanceId);
		}
		if (matchingItems > 1) {
			throw new AssertionError(
					"Worker history contains duplicate top-level attendanceId " + attendanceId + " (" + matchingItems + " matches)"
			);
		}
		if (matchingItem.calculatedSalaryTokenKind() == null || !matchingItem.calculatedSalaryTokenKind().isNumeric()) {
			throw new AssertionError(
					"Worker history attendanceId " + attendanceId + " has non-numeric calculatedSalary token "
							+ matchingItem.calculatedSalaryTokenKind()
			);
		}
		if (!expectedSalary.equals(matchingItem.calculatedSalaryTokenText())) {
			throw new AssertionError(
					"Worker history attendanceId " + attendanceId + " calculatedSalary token must be " + expectedSalary
							+ " but was " + matchingItem.calculatedSalaryTokenText()
			);
		}
	}

	@Test
	void historySalaryTokenAllowsUnrelatedNullSalaryBeforeTarget() {
		assertHistorySalaryToken("""
				[{"attendanceId":7,"calculatedSalary":null},{"attendanceId":42,"calculatedSalary":365.00}]
				""", 42L, "365.00");
	}

	@Test
	void historySalaryTokenMatchesTargetWhenFieldsAreReversed() {
		assertHistorySalaryToken("""
				[{"calculatedSalary":80.00,"attendanceId":42}]
				""", 42L, "80.00");
	}

	@Test
	void historySalaryTokenIgnoresNestedAttendanceAndSalaryFields() {
		assertHistorySalaryToken("""
				[{"attendanceId":7,"calculatedSalary":null,"payCalculation":{"attendanceId":42,"calculatedSalary":365.00}},
				 {"attendanceId":42,"payCalculation":{"attendanceId":7,"calculatedSalary":1.00},"calculatedSalary":365.00}]
				""", 42L, "365.00");
	}

	@Test
	void historySalaryTokenRejectsDuplicateTopLevelAttendanceIds() {
		assertThatThrownBy(() -> assertHistorySalaryToken("""
				[{"attendanceId":42,"calculatedSalary":365.00},{"attendanceId":42,"calculatedSalary":365.00}]
				""", 42L, "365.00"))
				.isInstanceOf(AssertionError.class)
				.hasMessageContaining("duplicate top-level attendanceId 42");
	}

	@Test
	void historySalaryTokenRejectsMissingTargetAndNullTargetSalaryClearly() {
		assertThatThrownBy(() -> assertHistorySalaryToken("""
				[{"attendanceId":7,"calculatedSalary":null}]
				""", 42L, "365.00"))
				.isInstanceOf(AssertionError.class)
				.hasMessageContaining("did not contain top-level attendanceId 42");
		assertThatThrownBy(() -> assertHistorySalaryToken("""
				[{"attendanceId":42,"calculatedSalary":null}]
				""", 42L, "365.00"))
				.isInstanceOf(AssertionError.class)
				.hasMessageContaining("attendanceId 42 has non-numeric calculatedSalary token VALUE_NULL");
	}

	@Test
	void historySalaryTokenRejectsNumericTokensThatDoNotPreserveSettlementScale() {
		for (String actualToken : new String[]{"365", "365.0", "365.000"}) {
			assertThatThrownBy(() -> assertHistorySalaryToken(
						"[{\"attendanceId\":42,\"calculatedSalary\":" + actualToken + "}]",
						42L,
						"365.00"
				))
					.isInstanceOf(AssertionError.class)
					.hasMessageContaining("attendanceId 42 calculatedSalary token must be 365.00 but was " + actualToken);
		}
	}

	private Map<RuleIdentity, Long> policyRuleIds(String response) throws Exception {
		Map<RuleIdentity, Long> ruleIds = new LinkedHashMap<>();
		try (JsonParser parser = JsonMapper.shared().createParser(response)) {
			assertThat(parser.nextToken()).isEqualTo(JsonToken.START_OBJECT);
			while (parser.nextToken() != JsonToken.END_OBJECT) {
				String fieldName = parser.currentName();
				JsonToken valueToken = parser.nextToken();
				if (!"rules".equals(fieldName)) {
					parser.skipChildren();
					continue;
				}
				assertThat(valueToken).isEqualTo(JsonToken.START_ARRAY);
				while (parser.nextToken() != JsonToken.END_ARRAY) {
					assertThat(parser.currentToken()).isEqualTo(JsonToken.START_OBJECT);
					Long id = null;
					String name = null;
					PayPolicyRuleType type = null;
					while (parser.nextToken() != JsonToken.END_OBJECT) {
						String ruleFieldName = parser.currentName();
						JsonToken ruleValueToken = parser.nextToken();
						if ("id".equals(ruleFieldName)) {
							assertThat(ruleValueToken.isNumeric()).isTrue();
							id = parser.getLongValue();
						}
						else if ("name".equals(ruleFieldName)) {
							name = parser.getText();
						}
						else if ("type".equals(ruleFieldName)) {
							type = PayPolicyRuleType.valueOf(parser.getText());
						}
						else {
							parser.skipChildren();
						}
					}
					assertThat(id).isNotNull();
					assertThat(name).isNotNull();
					assertThat(type).isNotNull();
					assertThat(ruleIds.put(new RuleIdentity(name, type), id)).isNull();
				}
			}
		}
		return Map.copyOf(ruleIds);
	}

	private void assertForemanBaseOnlySalary(String foremanToken, long shiftId, String expectedSalary) throws Exception {
		BigDecimal persistedSalary = shiftSessionRepository.findById(shiftId).orElseThrow().getForemanCalculatedSalary();
		assertThat(persistedSalary).isEqualByComparingTo(expectedSalary);
		assertThat(persistedSalary.scale()).isEqualTo(2);
		MvcResult summary = getSummary(foremanToken, shiftId)
				.andExpect(status().isOk())
				.andReturn();
		assertThat(summary.getResponse().getContentAsString())
				.contains("\"foremanSalary\":" + expectedSalary);
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

	private record ClosedShift(long shiftId, long attendanceId) {
	}

	private record RuleIdentity(String name, PayPolicyRuleType type) {
	}

	private record ExpectedRule(Long id, String name, PayPolicyRuleType type, String premiumPercent) {
	}

	private record TopLevelHistoryItem(
			Long attendanceId,
			JsonToken calculatedSalaryTokenKind,
			String calculatedSalaryTokenText
	) {
	}
}
