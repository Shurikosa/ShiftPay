package com.shiftpay.mvp.service;

import com.shiftpay.mvp.dto.HolidayDateCondition;
import com.shiftpay.mvp.entity.Company;
import com.shiftpay.mvp.entity.PayPolicyRule;
import com.shiftpay.mvp.entity.PayPolicyRuleType;
import com.shiftpay.mvp.entity.PayPolicyStackingStrategy;
import com.shiftpay.mvp.entity.PayPolicyVersion;
import org.junit.jupiter.api.Test;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.DayOfWeek;
import java.time.Instant;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.LocalTime;
import java.time.ZoneId;
import java.time.ZoneOffset;
import java.time.ZonedDateTime;
import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

/**
 * Unit tests for the internal Phase 2A/2B premium pay calculation foundation.
 */
class PremiumPayCalculationServiceTests {

	private static final ZoneId BERLIN = ZoneId.of("Europe/Berlin");
	private static final BigDecimal BASE_20 = new BigDecimal("20.00");
	private static final BigDecimal BASE_36 = new BigDecimal("36.00");
	private static final BigDecimal BASE_60 = new BigDecimal("60.00");
	private static final long WORKER_ID = 10L;
	private static final long COMPANY_ID = 20L;

	private final PremiumPayCalculationService service = new PremiumPayCalculationService();

	/**
	 * A regular shift with no premium rules produces only base pay.
	 */
	@Test
	void regularShiftWithoutPremiumProducesBasePay() {
		PremiumPayCalculationResult result = calculate(
				policy(PayPolicyStackingStrategy.ADD),
				localInstant(2026, 7, 6, 8, 0),
				localInstant(2026, 7, 6, 16, 0)
		);

		assertThat(result.segments()).hasSize(1);
		assertThat(result.totalRawMinutes()).isEqualTo(480);
		assertMoney(result.totalBaseAmount(), "160.00000000");
		assertMoney(result.totalPremiumAmount(), "0.00000000");
		assertMoney(result.totalAmount(), "160.00000000");
		assertMoney(result.segments().getFirst().effectiveHourlyRate(), "20.00000000");
	}

	/**
	 * Night premium starts exactly at the configured local 22:00 boundary.
	 */
	@Test
	void nightBoundarySplitsRegularThenNightPremium() {
		PayPolicyVersion policy = policy(
				PayPolicyStackingStrategy.ADD,
				timeOfDayRule("Night", "25.0000", LocalTime.of(22, 0), LocalTime.of(6, 0), true)
		);

		PremiumPayCalculationResult result = calculate(
				policy,
				localInstant(2026, 7, 6, 18, 0),
				localInstant(2026, 7, 7, 4, 0)
		);

		assertThat(result.segments()).hasSize(3);
		assertThat(result.segments().get(0).payableMinutes()).isEqualTo(240);
		assertThat(result.segments().get(0).appliedRules()).isEmpty();
		assertThat(result.segments().get(1).payableMinutes()).isEqualTo(120);
		assertThat(result.segments().get(1).appliedRules()).extracting(AppliedPremiumRule::name)
				.containsExactly("Night");
		assertThat(result.segments().get(2).payableMinutes()).isEqualTo(240);
		assertThat(result.segments().get(2).appliedRules()).extracting(AppliedPremiumRule::name)
				.containsExactly("Night");
		assertMoney(result.totalBaseAmount(), "200.00000000");
		assertMoney(result.totalPremiumAmount(), "30.00000000");
		assertMoney(result.totalAmount(), "230.00000000");
	}

	/**
	 * Sub-minute splits keep exact seconds and amounts instead of dropping each truncated segment.
	 */
	@Test
	void subMinuteTimeOfDayBoundaryKeepsBothThirtySecondSegments() {
		PayPolicyVersion policy = policy(
				PayPolicyStackingStrategy.ADD,
				timeOfDayRule("Night", "25.0000", LocalTime.of(22, 0), LocalTime.of(6, 0), true)
		);
		Instant start = localInstant(2026, 7, 6, 21, 59, 30);
		Instant end = localInstant(2026, 7, 6, 22, 0, 30);

		PremiumPayCalculationResult result = calculate(policy, start, end, BASE_60);

		assertContiguousCoverage(result, start, end, "60.000000000");
		assertExactDecimal(result.totalRawMinutesExact(), "1.00000000");
		assertThat(result.totalRawMinutes()).isEqualTo(1);
		assertThat(result.segments()).hasSize(2);
		assertThat(result.segments()).allSatisfy((segment) -> assertThat(segment.payableSeconds()).isPositive());

		PremiumPaySegment regular = result.segments().get(0);
		assertExactDecimal(regular.payableSeconds(), "30.000000000");
		assertExactDecimal(regular.payableMinutesExact(), "0.50000000");
		assertThat(regular.payableMinutes()).isZero();
		assertThat(regular.appliedRules()).isEmpty();
		assertMoney(regular.baseAmount(), "0.50000000");
		assertMoney(regular.premiumAmount(), "0.00000000");
		assertMoney(regular.totalAmount(), "0.50000000");

		PremiumPaySegment premium = result.segments().get(1);
		assertExactDecimal(premium.payableSeconds(), "30.000000000");
		assertExactDecimal(premium.payableMinutesExact(), "0.50000000");
		assertThat(premium.payableMinutes()).isZero();
		assertThat(premium.appliedRules()).extracting(AppliedPremiumRule::name)
				.containsExactly("Night");
		assertMoney(premium.baseAmount(), "0.50000000");
		assertMoney(premium.premiumAmount(), "0.12500000");
		assertMoney(premium.totalAmount(), "0.62500000");

		assertMoney(result.totalBaseAmount(), "1.00000000");
		assertMoney(result.totalPremiumAmount(), "0.12500000");
		assertMoney(result.totalAmount(), "1.12500000");
	}

	/**
	 * A segment starting exactly on the TIME_OF_DAY start boundary is premium from the first second.
	 */
	@Test
	void exactTimeOfDayStartBoundaryAppliesPremiumImmediately() {
		PayPolicyVersion policy = policy(
				PayPolicyStackingStrategy.ADD,
				timeOfDayRule("Night", "25.0000", LocalTime.of(22, 0), LocalTime.of(6, 0), true)
		);
		Instant start = localInstant(2026, 7, 6, 22, 0, 0);
		Instant end = localInstant(2026, 7, 6, 22, 1, 0);

		PremiumPayCalculationResult result = calculate(policy, start, end, BASE_60);

		assertContiguousCoverage(result, start, end, "60.000000000");
		assertThat(result.segments()).hasSize(1);
		PremiumPaySegment segment = result.segments().getFirst();
		assertExactDecimal(segment.payableSeconds(), "60.000000000");
		assertExactDecimal(segment.payableMinutesExact(), "1.00000000");
		assertThat(segment.payableMinutes()).isEqualTo(1);
		assertThat(segment.appliedRules()).extracting(AppliedPremiumRule::name)
				.containsExactly("Night");
		assertMoney(segment.baseAmount(), "1.00000000");
		assertMoney(segment.premiumAmount(), "0.25000000");
		assertMoney(segment.totalAmount(), "1.25000000");
	}

	/**
	 * A segment starting exactly on the TIME_OF_DAY end boundary is regular from the first second.
	 */
	@Test
	void exactTimeOfDayEndBoundaryStopsPremiumImmediately() {
		PayPolicyVersion policy = policy(
				PayPolicyStackingStrategy.ADD,
				timeOfDayRule("Night", "25.0000", LocalTime.of(22, 0), LocalTime.of(6, 0), true)
		);
		Instant start = localInstant(2026, 7, 7, 5, 59, 0);
		Instant end = localInstant(2026, 7, 7, 6, 1, 0);

		PremiumPayCalculationResult result = calculate(policy, start, end, BASE_60);

		assertContiguousCoverage(result, start, end, "120.000000000");
		assertThat(result.segments()).hasSize(2);
		PremiumPaySegment premium = result.segments().get(0);
		assertThat(premium.start()).isEqualTo(start);
		assertThat(premium.end()).isEqualTo(localInstant(2026, 7, 7, 6, 0, 0));
		assertExactDecimal(premium.payableSeconds(), "60.000000000");
		assertExactDecimal(premium.payableMinutesExact(), "1.00000000");
		assertThat(premium.appliedRules()).extracting(AppliedPremiumRule::name)
				.containsExactly("Night");
		assertMoney(premium.baseAmount(), "1.00000000");
		assertMoney(premium.premiumAmount(), "0.25000000");

		PremiumPaySegment regular = result.segments().get(1);
		assertThat(regular.start()).isEqualTo(localInstant(2026, 7, 7, 6, 0, 0));
		assertThat(regular.end()).isEqualTo(end);
		assertExactDecimal(regular.payableSeconds(), "60.000000000");
		assertExactDecimal(regular.payableMinutesExact(), "1.00000000");
		assertThat(regular.appliedRules()).isEmpty();
		assertMoney(regular.baseAmount(), "1.00000000");
		assertMoney(regular.premiumAmount(), "0.00000000");
		assertMoney(result.totalBaseAmount(), "2.00000000");
		assertMoney(result.totalPremiumAmount(), "0.25000000");
		assertMoney(result.totalAmount(), "2.25000000");
	}

	/**
	 * Configurable decimal percentages are carried through as BigDecimal values.
	 */
	@Test
	void configurableDecimalPremiumPercentIsUsedExactly() {
		PayPolicyVersion policy = policy(
				PayPolicyStackingStrategy.ADD,
				timeOfDayRule("Custom", "37.5000", LocalTime.of(22, 0), LocalTime.of(6, 0), true)
		);

		PremiumPayCalculationResult result = calculate(
				policy,
				localInstant(2026, 7, 6, 22, 0),
				localInstant(2026, 7, 6, 23, 0)
		);

		PremiumPaySegment segment = result.segments().getFirst();
		assertThat(segment.effectivePremiumPercent()).isEqualByComparingTo("37.5000");
		assertMoney(segment.effectiveHourlyRate(), "27.50000000");
		assertMoney(segment.baseAmount(), "20.00000000");
		assertMoney(segment.premiumAmount(), "7.50000000");
		assertMoney(segment.totalAmount(), "27.50000000");
		assertThat(segment.premiumAmount().toPlainString()).isEqualTo("7.50000000");
	}

	/**
	 * ADD stacking sums overlapping premium percentages.
	 */
	@Test
	void addStackingSumsOverlappingPremiums() {
		PayPolicyVersion policy = policy(
				PayPolicyStackingStrategy.ADD,
				timeOfDayRule("Night", "25.0000", LocalTime.of(22, 0), LocalTime.of(6, 0), true),
				dayOfWeekRule("Sunday", "50.0000", List.of(DayOfWeek.SUNDAY), true)
		);

		PremiumPayCalculationResult result = calculate(
				policy,
				localInstant(2026, 7, 5, 22, 0),
				localInstant(2026, 7, 5, 23, 0)
		);

		PremiumPaySegment segment = result.segments().getFirst();
		assertThat(segment.appliedRules()).extracting(AppliedPremiumRule::name)
				.containsExactly("Night", "Sunday");
		assertThat(segment.effectivePremiumPercent()).isEqualByComparingTo("75.0000");
		assertMoney(segment.effectiveHourlyRate(), "35.00000000");
		assertMoney(segment.baseAmount(), "20.00000000");
		assertMoney(segment.premiumAmount(), "15.00000000");
		assertMoney(segment.totalAmount(), "35.00000000");
	}

	/**
	 * HIGHEST_ONLY stacking keeps only the matching rule or rules with the highest premium.
	 */
	@Test
	void highestOnlyStackingUsesHighestOverlappingPremium() {
		PayPolicyVersion policy = policy(
				PayPolicyStackingStrategy.HIGHEST_ONLY,
				timeOfDayRule("Night", "25.0000", LocalTime.of(22, 0), LocalTime.of(6, 0), true),
				dayOfWeekRule("Sunday", "50.0000", List.of(DayOfWeek.SUNDAY), true)
		);

		PremiumPayCalculationResult result = calculate(
				policy,
				localInstant(2026, 7, 5, 22, 0),
				localInstant(2026, 7, 5, 23, 0)
		);

		PremiumPaySegment segment = result.segments().getFirst();
		assertThat(segment.appliedRules()).extracting(AppliedPremiumRule::name)
				.containsExactly("Sunday");
		assertThat(segment.effectivePremiumPercent()).isEqualByComparingTo("50.0000");
		assertMoney(segment.effectiveHourlyRate(), "30.00000000");
		assertMoney(segment.premiumAmount(), "10.00000000");
		assertMoney(segment.totalAmount(), "30.00000000");
	}

	/**
	 * DAY_OF_WEEK premiums change at midnight in the policy company's timezone.
	 */
	@Test
	void saturdayToSundayPremiumStartsAtPolicyTimezoneMidnight() {
		PayPolicyVersion policy = policy(
				PayPolicyStackingStrategy.ADD,
				dayOfWeekRule("Sunday", "50.0000", List.of(DayOfWeek.SUNDAY), true)
		);

		PremiumPayCalculationResult result = calculate(
				policy,
				localInstant(2026, 7, 4, 23, 0),
				localInstant(2026, 7, 5, 1, 0)
		);

		assertThat(result.segments()).hasSize(2);
		assertThat(result.segments().get(0).start()).isEqualTo(localInstant(2026, 7, 4, 23, 0));
		assertThat(result.segments().get(0).end()).isEqualTo(localInstant(2026, 7, 5, 0, 0));
		assertThat(result.segments().get(0).appliedRules()).isEmpty();
		assertThat(result.segments().get(1).start()).isEqualTo(localInstant(2026, 7, 5, 0, 0));
		assertThat(result.segments().get(1).appliedRules()).extracting(AppliedPremiumRule::name)
				.containsExactly("Sunday");
	}

	/**
	 * TIME_OF_DAY windows crossing midnight match both sides of local midnight.
	 */
	@Test
	void timeOfDayCrossingMidnightMatchesAfterAndBeforeMidnight() {
		PayPolicyVersion policy = policy(
				PayPolicyStackingStrategy.ADD,
				timeOfDayRule("Night", "25.0000", LocalTime.of(22, 0), LocalTime.of(6, 0), true)
		);

		PremiumPayCalculationResult result = calculate(
				policy,
				localInstant(2026, 7, 6, 23, 0),
				localInstant(2026, 7, 7, 1, 0)
		);

		assertThat(result.segments()).hasSize(2);
		assertThat(result.segments().get(0).payableMinutes()).isEqualTo(60);
		assertThat(result.segments().get(0).appliedRules()).extracting(AppliedPremiumRule::name)
				.containsExactly("Night");
		assertThat(result.segments().get(1).payableMinutes()).isEqualTo(60);
		assertThat(result.segments().get(1).appliedRules()).extracting(AppliedPremiumRule::name)
				.containsExactly("Night");
		assertMoney(result.totalPremiumAmount(), "10.00000000");
	}

	/**
	 * Manual holidays match only the configured local calendar date.
	 */
	@Test
	void holidayManualDateAppliesOnlyOnConfiguredLocalDate() {
		PayPolicyVersion policy = policy(
				PayPolicyStackingStrategy.ADD,
				holidayRule("Christmas", "100.0000", LocalDate.of(2026, 12, 25), true)
		);

		PremiumPayCalculationResult result = calculate(
				policy,
				localInstant(2026, 12, 24, 23, 0),
				localInstant(2026, 12, 25, 1, 0)
		);

		assertThat(result.segments()).hasSize(2);
		assertThat(result.segments().get(0).appliedRules()).isEmpty();
		assertThat(result.segments().get(1).appliedRules()).extracting(AppliedPremiumRule::name)
				.containsExactly("Christmas");
		assertMoney(result.totalBaseAmount(), "40.00000000");
		assertMoney(result.totalPremiumAmount(), "20.00000000");
	}

	/**
	 * DAY_OF_WEEK supports arbitrary non-weekend weekdays from policy config.
	 */
	@Test
	void arbitraryWeekdayDayOfWeekRuleApplies() {
		PayPolicyVersion policy = policy(
				PayPolicyStackingStrategy.ADD,
				dayOfWeekRule("Tuesday", "12.5000", List.of(DayOfWeek.TUESDAY), true)
		);

		PremiumPayCalculationResult result = calculate(
				policy,
				localInstant(2026, 7, 7, 9, 0),
				localInstant(2026, 7, 7, 10, 0)
		);

		PremiumPaySegment segment = result.segments().getFirst();
		assertThat(segment.appliedRules()).extracting(AppliedPremiumRule::name)
				.containsExactly("Tuesday");
		assertThat(segment.effectivePremiumPercent()).isEqualByComparingTo("12.5000");
		assertMoney(segment.premiumAmount(), "2.50000000");
	}

	/**
	 * Durations use instants, so spring-forward DST gaps do not create phantom payable time.
	 */
	@Test
	void dstSpringForwardUsesElapsedInstantDuration() {
		PremiumPayCalculationResult result = calculate(
				policy(PayPolicyStackingStrategy.ADD),
				localInstant(2026, 3, 29, 1, 30),
				localInstant(2026, 3, 29, 3, 30)
		);

		assertThat(result.totalRawMinutes()).isEqualTo(60);
		assertMoney(result.totalBaseAmount(), "20.00000000");
		assertMoney(result.totalAmount(), "20.00000000");
	}

	/**
	 * Fall-back overlap counts elapsed instants and applies local 02:00 premium in both repeated hours.
	 */
	@Test
	void dstFallBackOverlapKeepsRepeatedPremiumHourCoverage() {
		PayPolicyVersion policy = policy(
				PayPolicyStackingStrategy.ADD,
				timeOfDayRule("Night", "25.0000", LocalTime.of(2, 0), LocalTime.of(3, 0), true)
		);
		Instant start = localInstantWithOffset(2026, 10, 25, 1, 30, "+02:00");
		Instant end = localInstantWithOffset(2026, 10, 25, 2, 30, "+01:00");

		PremiumPayCalculationResult result = calculate(policy, start, end);

		assertContiguousCoverage(result, start, end, "7200.000000000");
		assertExactDecimal(result.totalRawMinutesExact(), "120.00000000");
		assertThat(result.segments()).hasSize(3);
		assertThat(result.segments().get(0).appliedRules()).isEmpty();
		assertThat(result.segments().get(1).appliedRules()).extracting(AppliedPremiumRule::name)
				.containsExactly("Night");
		assertThat(result.segments().get(2).appliedRules()).extracting(AppliedPremiumRule::name)
				.containsExactly("Night");
		assertMoney(result.totalBaseAmount(), "40.00000000");
		assertMoney(result.totalPremiumAmount(), "7.50000000");
		assertMoney(result.totalAmount(), "47.50000000");
	}

	/**
	 * Disabled rules are ignored even when their conditions match the segment.
	 */
	@Test
	void disabledRulesAreIgnored() {
		PayPolicyVersion policy = policy(
				PayPolicyStackingStrategy.ADD,
				dayOfWeekRule("Disabled Sunday", "50.0000", List.of(DayOfWeek.SUNDAY), false)
		);

		PremiumPayCalculationResult result = calculate(
				policy,
				localInstant(2026, 7, 5, 9, 0),
				localInstant(2026, 7, 5, 10, 0)
		);

		assertThat(result.segments().getFirst().appliedRules()).isEmpty();
		assertThat(result.segments().getFirst().effectivePremiumPercent()).isEqualByComparingTo(BigDecimal.ZERO);
		assertMoney(result.totalPremiumAmount(), "0.00000000");
	}

	/**
	 * Overtime rules are evaluated in Phase 2B without production close integration.
	 */
	@Test
	void overtimeRulesApplyInsideCalculationFoundation() {
		PayPolicyVersion policy = policy(
				PayPolicyStackingStrategy.ADD,
				overtimeRule("Daily overtime", PayPolicyRuleType.DAILY_OVERTIME, "50.0000", 480),
				overtimeRule("Weekly overtime", PayPolicyRuleType.WEEKLY_OVERTIME, "200.0000", 2400)
		);

		PremiumPayCalculationResult result = calculate(
				policy,
				localInstant(2026, 7, 6, 8, 0),
				localInstant(2026, 7, 6, 18, 0)
		);

		assertThat(result.segments()).hasSize(2);
		assertThat(result.segments().get(0).payableMinutes()).isEqualTo(480);
		assertThat(result.segments().get(0).appliedRules()).isEmpty();
		assertThat(result.segments().get(1).payableMinutes()).isEqualTo(120);
		assertThat(result.segments().get(1).appliedRules()).extracting(AppliedPremiumRule::type)
				.containsExactly(PayPolicyRuleType.DAILY_OVERTIME);
		assertMoney(result.totalBaseAmount(), "200.00000000");
		assertMoney(result.totalPremiumAmount(), "20.00000000");
		assertMoney(result.totalAmount(), "220.00000000");
	}

	/**
	 * Scenario D: one 12h day applies daily overtime only after the first 8 elapsed hours.
	 */
	@Test
	void dailyOvertimeScenarioDStartsAfterEightHours() {
		PayPolicyVersion policy = policy(
				PayPolicyStackingStrategy.ADD,
				overtimeRule("Daily overtime", PayPolicyRuleType.DAILY_OVERTIME, "50.0000", 480)
		);
		Instant start = localInstant(2026, 7, 6, 8, 0);
		Instant end = localInstant(2026, 7, 6, 20, 0);

		PremiumPayCalculationResult result = calculate(policy, start, end);

		assertContiguousCoverage(result, start, end, "43200.000000000");
		assertThat(result.segments()).hasSize(2);
		assertSegment(result.segments().get(0), start, localInstant(2026, 7, 6, 16, 0), "28800.000000000");
		assertThat(result.segments().get(0).appliedRules()).isEmpty();
		assertSegment(result.segments().get(1), localInstant(2026, 7, 6, 16, 0), end, "14400.000000000");
		assertThat(result.segments().get(1).appliedRules()).extracting(AppliedPremiumRule::name)
				.containsExactly("Daily overtime");
		assertMoney(result.totalBaseAmount(), "240.00000000");
		assertMoney(result.totalPremiumAmount(), "40.00000000");
		assertMoney(result.totalAmount(), "280.00000000");
	}

	/**
	 * Scenario E: previous finalized payable context pushes the current interval into overtime.
	 */
	@Test
	void dailyOvertimeScenarioEUsesPreviousFinalizedContext() {
		PayPolicyVersion policy = policy(
				PayPolicyStackingStrategy.ADD,
				overtimeRule("Daily overtime", PayPolicyRuleType.DAILY_OVERTIME, "50.0000", 480)
		);
		Instant previousStart = localInstant(2026, 7, 6, 8, 0);
		Instant previousEnd = localInstant(2026, 7, 6, 12, 0);
		Instant currentStart = localInstant(2026, 7, 6, 14, 0);
		Instant currentEnd = localInstant(2026, 7, 6, 20, 0);

		PremiumPayCalculationResult result = calculateWithContext(
				policy,
				currentStart,
				currentEnd,
				previous(previousStart, previousEnd)
		);

		assertContiguousCoverage(result, currentStart, currentEnd, "21600.000000000");
		assertThat(result.segments()).hasSize(2);
		assertSegment(result.segments().get(0), currentStart, localInstant(2026, 7, 6, 18, 0), "14400.000000000");
		assertThat(result.segments().get(0).appliedRules()).isEmpty();
		assertSegment(result.segments().get(1), localInstant(2026, 7, 6, 18, 0), currentEnd, "7200.000000000");
		assertThat(result.segments().get(1).appliedRules()).extracting(AppliedPremiumRule::name)
				.containsExactly("Daily overtime");
		assertMoney(result.totalBaseAmount(), "120.00000000");
		assertMoney(result.totalPremiumAmount(), "20.00000000");
		assertMoney(result.totalAmount(), "140.00000000");
	}

	/**
	 * Overtime context is scoped to the current worker/company when those ids are provided.
	 */
	@Test
	void overtimeContextIgnoresDifferentWorkerAndCompanyIntervals() {
		PayPolicyVersion policy = policy(
				PayPolicyStackingStrategy.ADD,
				overtimeRule("Daily overtime", PayPolicyRuleType.DAILY_OVERTIME, "50.0000", 480)
		);
		Instant currentStart = localInstant(2026, 7, 6, 16, 0);
		Instant currentEnd = localInstant(2026, 7, 6, 18, 0);

		PremiumPayCalculationResult result = calculateWithContext(
				policy,
				currentStart,
				currentEnd,
				previousFor(WORKER_ID + 1, COMPANY_ID, localInstant(2026, 7, 6, 8, 0), currentStart),
				previousFor(WORKER_ID, COMPANY_ID + 1, localInstant(2026, 7, 6, 8, 0), currentStart)
		);

		assertContiguousCoverage(result, currentStart, currentEnd, "7200.000000000");
		assertThat(result.segments()).hasSize(1);
		assertThat(result.segments().getFirst().appliedRules()).isEmpty();
		assertMoney(result.totalBaseAmount(), "40.00000000");
		assertMoney(result.totalPremiumAmount(), "0.00000000");
	}

	/**
	 * Weekly overtime uses previous finalized intervals from the same local policy week.
	 */
	@Test
	void weeklyOvertimeUsesPreviousFinalizedContext() {
		PayPolicyVersion policy = policy(
				PayPolicyStackingStrategy.ADD,
				overtimeRule("Weekly overtime", PayPolicyRuleType.WEEKLY_OVERTIME, "50.0000", 2400)
		);
		Instant currentStart = localInstant(2026, 7, 10, 8, 0);
		Instant currentEnd = localInstant(2026, 7, 10, 12, 0);

		PremiumPayCalculationResult result = calculateWithContext(
				policy,
				currentStart,
				currentEnd,
				previous(localInstant(2026, 7, 6, 8, 0), localInstant(2026, 7, 6, 18, 0)),
				previous(localInstant(2026, 7, 7, 8, 0), localInstant(2026, 7, 7, 18, 0)),
				previous(localInstant(2026, 7, 8, 8, 0), localInstant(2026, 7, 8, 18, 0)),
				previous(localInstant(2026, 7, 9, 8, 0), localInstant(2026, 7, 9, 18, 0))
		);

		assertContiguousCoverage(result, currentStart, currentEnd, "14400.000000000");
		assertThat(result.segments()).hasSize(1);
		assertThat(result.segments().getFirst().appliedRules()).extracting(AppliedPremiumRule::name)
				.containsExactly("Weekly overtime");
		assertMoney(result.totalBaseAmount(), "80.00000000");
		assertMoney(result.totalPremiumAmount(), "40.00000000");
		assertMoney(result.totalAmount(), "120.00000000");
	}

	/**
	 * PayPolicy.weekStartsOn changes which previous intervals count toward weekly overtime.
	 */
	@Test
	void weekStartsOnBoundaryControlsWeeklyOvertimePeriod() {
		PayPolicyVersion mondayPolicy = policyWithWeekStart(
				DayOfWeek.MONDAY,
				PayPolicyStackingStrategy.ADD,
				overtimeRule("Weekly overtime", PayPolicyRuleType.WEEKLY_OVERTIME, "50.0000", 600)
		);
		PayPolicyVersion sundayPolicy = policyWithWeekStart(
				DayOfWeek.SUNDAY,
				PayPolicyStackingStrategy.ADD,
				overtimeRule("Weekly overtime", PayPolicyRuleType.WEEKLY_OVERTIME, "50.0000", 600)
		);
		Instant previousStart = localInstant(2026, 7, 5, 8, 0);
		Instant previousEnd = localInstant(2026, 7, 5, 18, 0);
		Instant currentStart = localInstant(2026, 7, 6, 8, 0);
		Instant currentEnd = localInstant(2026, 7, 6, 10, 0);

		PremiumPayCalculationResult mondayResult = calculateWithContext(
				mondayPolicy,
				currentStart,
				currentEnd,
				previous(previousStart, previousEnd)
		);
		PremiumPayCalculationResult sundayResult = calculateWithContext(
				sundayPolicy,
				currentStart,
				currentEnd,
				previous(previousStart, previousEnd)
		);

		assertThat(mondayResult.segments()).hasSize(1);
		assertThat(mondayResult.segments().getFirst().appliedRules()).isEmpty();
		assertMoney(mondayResult.totalPremiumAmount(), "0.00000000");
		assertThat(sundayResult.segments()).hasSize(1);
		assertThat(sundayResult.segments().getFirst().appliedRules()).extracting(AppliedPremiumRule::name)
				.containsExactly("Weekly overtime");
		assertMoney(sundayResult.totalPremiumAmount(), "20.00000000");
	}

	/**
	 * Daily overtime resets at local midnight in the company timezone.
	 */
	@Test
	void dailyOvertimeResetsAtLocalDayBoundary() {
		PayPolicyVersion policy = policy(
				PayPolicyStackingStrategy.ADD,
				overtimeRule("Daily overtime", PayPolicyRuleType.DAILY_OVERTIME, "50.0000", 480)
		);
		Instant start = localInstant(2026, 7, 6, 22, 0);
		Instant end = localInstant(2026, 7, 7, 2, 0);

		PremiumPayCalculationResult result = calculateWithContext(
				policy,
				start,
				end,
				previous(localInstant(2026, 7, 6, 8, 0), localInstant(2026, 7, 6, 16, 0))
		);

		assertContiguousCoverage(result, start, end, "14400.000000000");
		assertThat(result.segments()).hasSize(2);
		assertThat(result.segments().get(0).appliedRules()).extracting(AppliedPremiumRule::name)
				.containsExactly("Daily overtime");
		assertThat(result.segments().get(1).appliedRules()).isEmpty();
		assertMoney(result.totalPremiumAmount(), "20.00000000");
	}

	/**
	 * Weekly overtime resets at the configured local week boundary.
	 */
	@Test
	void weeklyOvertimeResetsAtConfiguredWeekBoundary() {
		PayPolicyVersion policy = policyWithWeekStart(
				DayOfWeek.MONDAY,
				PayPolicyStackingStrategy.ADD,
				overtimeRule("Weekly overtime", PayPolicyRuleType.WEEKLY_OVERTIME, "50.0000", 2400)
		);
		Instant start = localInstant(2026, 7, 5, 22, 0);
		Instant end = localInstant(2026, 7, 6, 2, 0);

		PremiumPayCalculationResult result = calculateWithContext(
				policy,
				start,
				end,
				previous(localInstant(2026, 6, 29, 8, 0), localInstant(2026, 6, 29, 18, 0)),
				previous(localInstant(2026, 6, 30, 8, 0), localInstant(2026, 6, 30, 18, 0)),
				previous(localInstant(2026, 7, 1, 8, 0), localInstant(2026, 7, 1, 18, 0)),
				previous(localInstant(2026, 7, 2, 8, 0), localInstant(2026, 7, 2, 18, 0))
		);

		assertContiguousCoverage(result, start, end, "14400.000000000");
		assertThat(result.segments()).hasSize(2);
		assertThat(result.segments().get(0).appliedRules()).extracting(AppliedPremiumRule::name)
				.containsExactly("Weekly overtime");
		assertThat(result.segments().get(1).appliedRules()).isEmpty();
		assertMoney(result.totalPremiumAmount(), "20.00000000");
	}

	/**
	 * Overtime across midnight splits by local day before applying per-day thresholds.
	 */
	@Test
	void dailyOvertimeAcrossMidnightUsesLocalDaySegments() {
		PayPolicyVersion policy = policy(
				PayPolicyStackingStrategy.ADD,
				overtimeRule("Daily overtime", PayPolicyRuleType.DAILY_OVERTIME, "50.0000", 120)
		);
		Instant start = localInstant(2026, 7, 6, 21, 0);
		Instant end = localInstant(2026, 7, 7, 3, 0);

		PremiumPayCalculationResult result = calculate(policy, start, end);

		assertContiguousCoverage(result, start, end, "21600.000000000");
		assertThat(result.segments()).hasSize(4);
		assertThat(result.segments().get(0).appliedRules()).isEmpty();
		assertThat(result.segments().get(1).appliedRules()).extracting(AppliedPremiumRule::name)
				.containsExactly("Daily overtime");
		assertThat(result.segments().get(2).appliedRules()).isEmpty();
		assertThat(result.segments().get(3).appliedRules()).extracting(AppliedPremiumRule::name)
				.containsExactly("Daily overtime");
		assertMoney(result.totalPremiumAmount(), "20.00000000");
	}

	/**
	 * ADD stacking sums daily overtime, night, and day-of-week percentages on the same segment.
	 */
	@Test
	void dailyOvertimeNightAndDayOfWeekAddStacking() {
		PayPolicyVersion policy = policy(
				PayPolicyStackingStrategy.ADD,
				overtimeRule("Daily overtime", PayPolicyRuleType.DAILY_OVERTIME, "50.0000", 480),
				timeOfDayRule("Night", "25.0000", LocalTime.of(22, 0), LocalTime.of(6, 0), true),
				dayOfWeekRule("Sunday", "50.0000", List.of(DayOfWeek.SUNDAY), true)
		);

		PremiumPayCalculationResult result = calculate(
				policy,
				localInstant(2026, 7, 5, 14, 0),
				localInstant(2026, 7, 5, 23, 0)
		);

		PremiumPaySegment stacked = result.segments().getLast();
		assertThat(stacked.appliedRules()).extracting(AppliedPremiumRule::name)
				.containsExactly("Daily overtime", "Night", "Sunday");
		assertThat(stacked.effectivePremiumPercent()).isEqualByComparingTo("125.0000");
		assertMoney(stacked.effectiveHourlyRate(), "45.00000000");
		assertMoney(stacked.premiumAmount(), "25.00000000");
	}

	/**
	 * HIGHEST_ONLY stacking keeps only the largest premium among overtime, night, and day-of-week rules.
	 */
	@Test
	void dailyOvertimeNightAndDayOfWeekHighestOnlyStacking() {
		PayPolicyVersion policy = policy(
				PayPolicyStackingStrategy.HIGHEST_ONLY,
				overtimeRule("Daily overtime", PayPolicyRuleType.DAILY_OVERTIME, "50.0000", 480),
				timeOfDayRule("Night", "25.0000", LocalTime.of(22, 0), LocalTime.of(6, 0), true),
				dayOfWeekRule("Sunday", "75.0000", List.of(DayOfWeek.SUNDAY), true)
		);

		PremiumPayCalculationResult result = calculate(
				policy,
				localInstant(2026, 7, 5, 14, 0),
				localInstant(2026, 7, 5, 23, 0)
		);

		PremiumPaySegment stacked = result.segments().getLast();
		assertThat(stacked.appliedRules()).extracting(AppliedPremiumRule::name)
				.containsExactly("Sunday");
		assertThat(stacked.effectivePremiumPercent()).isEqualByComparingTo("75.0000");
		assertMoney(stacked.effectiveHourlyRate(), "35.00000000");
		assertMoney(stacked.premiumAmount(), "15.00000000");
	}

	/**
	 * Daily and weekly overtime are both applicable rules; stacking decides the effective premium.
	 */
	@Test
	void dailyAndWeeklyOvertimeCanApplyToSameSegment() {
		PayPolicyVersion policy = policy(
				PayPolicyStackingStrategy.ADD,
				overtimeRule("Daily overtime", PayPolicyRuleType.DAILY_OVERTIME, "50.0000", 480),
				overtimeRule("Weekly overtime", PayPolicyRuleType.WEEKLY_OVERTIME, "25.0000", 2400)
		);
		Instant start = localInstant(2026, 7, 10, 8, 0);
		Instant end = localInstant(2026, 7, 10, 18, 0);

		PremiumPayCalculationResult result = calculateWithContext(
				policy,
				start,
				end,
				previous(localInstant(2026, 7, 6, 8, 0), localInstant(2026, 7, 6, 18, 0)),
				previous(localInstant(2026, 7, 7, 8, 0), localInstant(2026, 7, 7, 18, 0)),
				previous(localInstant(2026, 7, 8, 8, 0), localInstant(2026, 7, 8, 18, 0)),
				previous(localInstant(2026, 7, 9, 8, 0), localInstant(2026, 7, 9, 18, 0))
		);

		assertThat(result.segments()).hasSize(2);
		assertThat(result.segments().get(0).appliedRules()).extracting(AppliedPremiumRule::name)
				.containsExactly("Weekly overtime");
		assertThat(result.segments().get(1).appliedRules()).extracting(AppliedPremiumRule::name)
				.containsExactly("Daily overtime", "Weekly overtime");
		assertThat(result.segments().get(1).effectivePremiumPercent()).isEqualByComparingTo("75.0000");
		assertMoney(result.totalPremiumAmount(), "70.00000000");
	}

	/**
	 * Disabled overtime rules are ignored even when threshold conditions match.
	 */
	@Test
	void disabledOvertimeRulesAreIgnored() {
		PayPolicyVersion policy = policy(
				PayPolicyStackingStrategy.ADD,
				overtimeRule("Disabled daily overtime", PayPolicyRuleType.DAILY_OVERTIME, "50.0000", 480, false)
		);

		PremiumPayCalculationResult result = calculate(
				policy,
				localInstant(2026, 7, 6, 8, 0),
				localInstant(2026, 7, 6, 20, 0)
		);

		assertThat(result.segments()).hasSize(1);
		assertThat(result.segments().getFirst().appliedRules()).isEmpty();
		assertMoney(result.totalPremiumAmount(), "0.00000000");
		assertMoney(result.totalAmount(), "240.00000000");
	}

	/**
	 * Exact threshold boundary is regular before the threshold and overtime after it.
	 */
	@Test
	void overtimeStartsExactlyAfterThresholdBoundary() {
		PayPolicyVersion policy = policy(
				PayPolicyStackingStrategy.ADD,
				overtimeRule("Daily overtime", PayPolicyRuleType.DAILY_OVERTIME, "50.0000", 480)
		);
		Instant start = localInstant(2026, 7, 6, 8, 0);
		Instant threshold = localInstant(2026, 7, 6, 16, 0);
		Instant end = localInstant(2026, 7, 6, 17, 0);

		PremiumPayCalculationResult exactThreshold = calculate(policy, start, threshold);
		PremiumPayCalculationResult afterThreshold = calculate(policy, start, end);

		assertThat(exactThreshold.segments()).hasSize(1);
		assertThat(exactThreshold.segments().getFirst().appliedRules()).isEmpty();
		assertMoney(exactThreshold.totalPremiumAmount(), "0.00000000");
		assertThat(afterThreshold.segments()).hasSize(2);
		assertThat(afterThreshold.segments().get(1).start()).isEqualTo(threshold);
		assertThat(afterThreshold.segments().get(1).appliedRules()).extracting(AppliedPremiumRule::name)
				.containsExactly("Daily overtime");
		assertMoney(afterThreshold.totalPremiumAmount(), "10.00000000");
	}

	/**
	 * Sub-minute threshold crossing keeps both exact regular and overtime seconds.
	 */
	@Test
	void subMinuteOvertimeThresholdDoesNotLoseSeconds() {
		PayPolicyVersion policy = policy(
				PayPolicyStackingStrategy.ADD,
				overtimeRule("Daily overtime", PayPolicyRuleType.DAILY_OVERTIME, "50.0000", 1)
		);
		Instant start = localInstant(2026, 7, 6, 8, 0, 30);
		Instant end = localInstant(2026, 7, 6, 8, 1, 30);

		PremiumPayCalculationResult result = calculate(policy, start, end, BASE_36);

		assertContiguousCoverage(result, start, end, "60.000000000");
		assertThat(result.segments()).hasSize(1);
		assertExactDecimal(result.segments().getFirst().payableSeconds(), "60.000000000");
		assertThat(result.segments().getFirst().appliedRules()).isEmpty();
		assertMoney(result.totalBaseAmount(), "0.60000000");
		assertMoney(result.totalPremiumAmount(), "0.00000000");

		PremiumPayCalculationResult crossed = calculate(
				policy,
				start,
				localInstant(2026, 7, 6, 8, 1, 31),
				BASE_36
		);

		assertContiguousCoverage(crossed, start, localInstant(2026, 7, 6, 8, 1, 31), "61.000000000");
		assertThat(crossed.segments()).hasSize(2);
		assertExactDecimal(crossed.segments().get(0).payableSeconds(), "60.000000000");
		assertExactDecimal(crossed.segments().get(1).payableSeconds(), "1.000000000");
		assertThat(crossed.segments().get(1).appliedRules()).extracting(AppliedPremiumRule::name)
				.containsExactly("Daily overtime");
		assertMoney(crossed.totalBaseAmount(), "0.61000000");
		assertMoney(crossed.totalPremiumAmount(), "0.00500000");
		assertMoney(crossed.totalAmount(), "0.61500000");
	}

	/**
	 * DST transition overtime allocation uses elapsed instants, not naive local-hour subtraction.
	 */
	@Test
	void dstTransitionOvertimeContextUsesElapsedDuration() {
		PayPolicyVersion policy = policy(
				PayPolicyStackingStrategy.ADD,
				overtimeRule("Daily overtime", PayPolicyRuleType.DAILY_OVERTIME, "50.0000", 30)
		);
		Instant start = localInstant(2026, 3, 29, 1, 30);
		Instant end = localInstant(2026, 3, 29, 3, 30);

		PremiumPayCalculationResult result = calculate(policy, start, end);

		assertContiguousCoverage(result, start, end, "3600.000000000");
		assertThat(result.segments()).hasSize(2);
		assertThat(result.segments().get(0).appliedRules()).isEmpty();
		assertExactDecimal(result.segments().get(0).payableSeconds(), "1800.000000000");
		assertExactDecimal(result.segments().get(1).payableSeconds(), "1800.000000000");
		assertThat(result.segments().get(1).appliedRules()).extracting(AppliedPremiumRule::name)
				.containsExactly("Daily overtime");
		assertMoney(result.totalBaseAmount(), "20.00000000");
		assertMoney(result.totalPremiumAmount(), "5.00000000");
	}

	/**
	 * The context models MVP close-order limitations without querying or rewriting prior finalized shifts.
	 */
	@Test
	void closeOrderLimitationIsRepresentedByExplicitContext() {
		PayPolicyVersion policy = policy(
				PayPolicyStackingStrategy.ADD,
				overtimeRule("Daily overtime", PayPolicyRuleType.DAILY_OVERTIME, "50.0000", 480)
		);
		Instant earlyStart = localInstant(2026, 7, 6, 8, 0);
		Instant earlyEnd = localInstant(2026, 7, 6, 16, 0);
		Instant lateStart = localInstant(2026, 7, 6, 16, 0);
		Instant lateEnd = localInstant(2026, 7, 6, 20, 0);

		PremiumPayCalculationResult lateClosedFirst = calculate(policy, lateStart, lateEnd);
		PremiumPayCalculationResult lateWithEarlierContext = calculateWithContext(
				policy,
				lateStart,
				lateEnd,
				previous(earlyStart, earlyEnd)
		);

		assertThat(lateClosedFirst.segments()).hasSize(1);
		assertThat(lateClosedFirst.segments().getFirst().appliedRules()).isEmpty();
		assertMoney(lateClosedFirst.totalPremiumAmount(), "0.00000000");
		assertThat(lateWithEarlierContext.segments()).hasSize(1);
		assertThat(lateWithEarlierContext.segments().getFirst().appliedRules()).extracting(AppliedPremiumRule::name)
				.containsExactly("Daily overtime");
		assertMoney(lateWithEarlierContext.totalPremiumAmount(), "40.00000000");
	}

	/**
	 * Overtime ties use payable start, attendance/payable start, and stable id; shift start cannot win the tie.
	 */
	@Test
	void samePayableStartAllocatesOvertimeByStableIdBeforeShiftActualStart() {
		PayPolicyVersion policy = policy(
				PayPolicyStackingStrategy.ADD,
				overtimeRule("Daily overtime", PayPolicyRuleType.DAILY_OVERTIME, "50.0000", 60)
		);
		Instant payableStart = localInstant(2026, 7, 6, 8, 0);
		Instant payableEnd = localInstant(2026, 7, 6, 9, 0);
		PremiumPayableInterval previousLowerStableId = previousWithStableId(
				10L,
				localInstant(2026, 7, 6, 8, 30),
				payableStart,
				payableStart,
				payableEnd
		);
		PremiumPayableInterval currentHigherStableId = currentWithStableId(
				20L,
				localInstant(2026, 7, 6, 7, 0),
				payableStart,
				payableStart,
				payableEnd
		);

		PremiumPayCalculationResult result = calculateWithExplicitContext(
				policy,
				payableStart,
				payableEnd,
				currentHigherStableId,
				List.of(previousLowerStableId)
		);

		assertThat(result.segments()).hasSize(1);
		assertThat(result.segments().getFirst().appliedRules()).extracting(AppliedPremiumRule::name)
				.containsExactly("Daily overtime");
		assertMoney(result.totalBaseAmount(), "20.00000000");
		assertMoney(result.totalPremiumAmount(), "10.00000000");
		assertMoney(result.totalAmount(), "30.00000000");
	}

	/**
	 * Equal payable-start ties are deterministic regardless of previous interval input order.
	 */
	@Test
	void samePayableStartStableIdOrderingIsIndependentOfInputOrder() {
		PayPolicyVersion policy = policy(
				PayPolicyStackingStrategy.ADD,
				overtimeRule("Daily overtime", PayPolicyRuleType.DAILY_OVERTIME, "50.0000", 90)
		);
		Instant payableStart = localInstant(2026, 7, 6, 8, 0);
		Instant payableEnd = localInstant(2026, 7, 6, 9, 0);
		PremiumPayableInterval lowerPrevious = previousWithStableId(
				10L,
				payableStart,
				payableStart,
				payableStart,
				payableEnd
		);
		PremiumPayableInterval higherPrevious = previousWithStableId(
				30L,
				payableStart,
				payableStart,
				payableStart,
				payableEnd
		);
		PremiumPayableInterval current = currentWithStableId(
				20L,
				payableStart,
				payableStart,
				payableStart,
				payableEnd
		);

		PremiumPayCalculationResult ordered = calculateWithExplicitContext(
				policy,
				payableStart,
				payableEnd,
				current,
				List.of(lowerPrevious, higherPrevious)
		);
		PremiumPayCalculationResult reversed = calculateWithExplicitContext(
				policy,
				payableStart,
				payableEnd,
				current,
				List.of(higherPrevious, lowerPrevious)
		);

		assertThat(reversed).isEqualTo(ordered);
		assertThat(ordered.segments()).hasSize(2);
		assertExactDecimal(ordered.segments().get(0).payableSeconds(), "1800.000000000");
		assertThat(ordered.segments().get(0).appliedRules()).isEmpty();
		assertExactDecimal(ordered.segments().get(1).payableSeconds(), "1800.000000000");
		assertThat(ordered.segments().get(1).appliedRules()).extracting(AppliedPremiumRule::name)
				.containsExactly("Daily overtime");
		assertMoney(ordered.totalBaseAmount(), "20.00000000");
		assertMoney(ordered.totalPremiumAmount(), "5.00000000");
		assertMoney(ordered.totalAmount(), "25.00000000");
	}

	/**
	 * Overtime context intervals require a stable id so ordering cannot fall back to stream order.
	 */
	@Test
	void nullStableIdInOvertimeContextFailsFast() {
		Instant start = localInstant(2026, 7, 6, 8, 0);
		Instant end = localInstant(2026, 7, 6, 9, 0);

		assertThatThrownBy(() -> PremiumPayableInterval.previousFinalized(
				WORKER_ID,
				COMPANY_ID,
				null,
				start,
				start,
				start,
				end
		))
				.isInstanceOf(IllegalArgumentException.class)
				.hasMessage("stableId is required for overtime context ordering");
	}

	/**
	 * Stable ids must be unique across the context to provide a complete deterministic tie-break.
	 */
	@Test
	void duplicateStableIdInOvertimeContextFailsFast() {
		Instant start = localInstant(2026, 7, 6, 8, 0);
		Instant end = localInstant(2026, 7, 6, 9, 0);
		PremiumPayableInterval previous = previousWithStableId(10L, start, start, start, end);
		PremiumPayableInterval current = currentWithStableId(10L, start, start, start, end);

		assertThatThrownBy(() -> PremiumPayCalculationContext.of(List.of(previous), current))
				.isInstanceOf(IllegalArgumentException.class)
				.hasMessage("stableId must be unique across calculation context");
	}

	/**
	 * Matching zero-percent rules remain explainable while producing no premium.
	 */
	@Test
	void zeroPremiumRuleIsAppliedDeterministicallyWithoutChangingPay() {
		PayPolicyVersion policy = policy(
				PayPolicyStackingStrategy.ADD,
				dayOfWeekRule("Zero Sunday", "0.0000", List.of(DayOfWeek.SUNDAY), true)
		);

		PremiumPayCalculationResult result = calculate(
				policy,
				localInstant(2026, 7, 5, 9, 0),
				localInstant(2026, 7, 5, 10, 0)
		);

		PremiumPaySegment segment = result.segments().getFirst();
		assertThat(segment.appliedRules()).extracting(AppliedPremiumRule::name)
				.containsExactly("Zero Sunday");
		assertThat(segment.effectivePremiumPercent()).isEqualByComparingTo("0.0000");
		assertMoney(segment.premiumAmount(), "0.00000000");
		assertMoney(segment.totalAmount(), "20.00000000");
	}

	/**
	 * Decimal math is performed with BigDecimal and stable decimal output.
	 */
	@Test
	void bigDecimalPrecisionDoesNotExposeFloatingPointArtifacts() {
		PayPolicyVersion policy = policy(
				PayPolicyStackingStrategy.ADD,
				dayOfWeekRule("Precise", "33.3333", List.of(DayOfWeek.MONDAY), true)
		);

		PremiumPayCalculationResult result = calculate(
				policy,
				localInstant(2026, 7, 6, 9, 0),
				localInstant(2026, 7, 6, 9, 20)
		);

		PremiumPaySegment segment = result.segments().getFirst();
		assertMoney(segment.baseAmount(), "6.66666667");
		assertMoney(segment.premiumAmount(), "2.22222000");
		assertMoney(segment.totalAmount(), "8.88888667");
		assertThat(segment.premiumAmount().toPlainString()).isEqualTo("2.22222000");
		assertThat(segment.totalAmount().toPlainString()).doesNotContain("999999");
	}

	private PremiumPayCalculationResult calculate(PayPolicyVersion policy, Instant start, Instant end) {
		return service.calculate(start, end, BASE_20, policy);
	}

	private PremiumPayCalculationResult calculate(
			PayPolicyVersion policy,
			Instant start,
			Instant end,
			BigDecimal baseHourlyRate
	) {
		return service.calculate(start, end, baseHourlyRate, policy);
	}

	private PremiumPayCalculationResult calculateWithContext(
			PayPolicyVersion policy,
			Instant start,
			Instant end,
			PremiumPayableInterval... previousFinalizedIntervals
	) {
		PremiumPayableInterval currentInterval = PremiumPayableInterval.current(
				WORKER_ID,
				COMPANY_ID,
				999_999L,
				start,
				start,
				start,
				end
		);
		return service.calculate(
				start,
				end,
				BASE_20,
				policy,
				PremiumPayCalculationContext.of(List.of(previousFinalizedIntervals), currentInterval)
		);
	}

	private PremiumPayCalculationResult calculateWithExplicitContext(
			PayPolicyVersion policy,
			Instant start,
			Instant end,
			PremiumPayableInterval currentInterval,
			List<PremiumPayableInterval> previousFinalizedIntervals
	) {
		return service.calculate(
				start,
				end,
				BASE_20,
				policy,
				PremiumPayCalculationContext.of(previousFinalizedIntervals, currentInterval)
		);
	}

	private PayPolicyVersion policy(PayPolicyStackingStrategy stackingStrategy, PayPolicyRule... rules) {
		return policyWithWeekStart(DayOfWeek.MONDAY, stackingStrategy, rules);
	}

	private PayPolicyVersion policyWithWeekStart(
			DayOfWeek weekStartsOn,
			PayPolicyStackingStrategy stackingStrategy,
			PayPolicyRule... rules
	) {
		Company company = new Company();
		company.setName("Acme");
		company.setJoinCode("ACME123");
		company.setTimeZone(BERLIN.getId());

		PayPolicyVersion policy = new PayPolicyVersion();
		policy.setCompany(company);
		policy.setVersion(1);
		policy.setWeekStartsOn(weekStartsOn);
		policy.setStackingStrategy(stackingStrategy);
		for (int index = 0; index < rules.length; index++) {
			rules[index].setSortOrder(index);
			policy.addRule(rules[index]);
		}
		return policy;
	}

	private PayPolicyRule timeOfDayRule(
			String name,
			String premiumPercent,
			LocalTime startTime,
			LocalTime endTime,
			boolean enabled
	) {
		PayPolicyRule rule = baseRule(name, PayPolicyRuleType.TIME_OF_DAY, premiumPercent, enabled);
		rule.setConditionConfig(PayPolicyConditionJson.write(PayPolicyConditionJson.timeOfDay(startTime, endTime)));
		return rule;
	}

	private PayPolicyRule dayOfWeekRule(
			String name,
			String premiumPercent,
			List<DayOfWeek> weekdays,
			boolean enabled
	) {
		PayPolicyRule rule = baseRule(name, PayPolicyRuleType.DAY_OF_WEEK, premiumPercent, enabled);
		rule.setConditionConfig(PayPolicyConditionJson.write(PayPolicyConditionJson.dayOfWeek(weekdays)));
		return rule;
	}

	private PayPolicyRule holidayRule(String name, String premiumPercent, LocalDate holidayDate, boolean enabled) {
		PayPolicyRule rule = baseRule(name, PayPolicyRuleType.HOLIDAY, premiumPercent, enabled);
		rule.setConditionConfig(PayPolicyConditionJson.write(PayPolicyConditionJson.holiday(
				List.of(new HolidayDateCondition(holidayDate, "Holiday"))
		)));
		return rule;
	}

	private PayPolicyRule overtimeRule(
			String name,
			PayPolicyRuleType type,
			String premiumPercent,
			int thresholdMinutes
	) {
		return overtimeRule(name, type, premiumPercent, thresholdMinutes, true);
	}

	private PayPolicyRule overtimeRule(
			String name,
			PayPolicyRuleType type,
			String premiumPercent,
			int thresholdMinutes,
			boolean enabled
	) {
		PayPolicyRule rule = baseRule(name, type, premiumPercent, enabled);
		rule.setConditionConfig(PayPolicyConditionJson.write(PayPolicyConditionJson.overtime(thresholdMinutes)));
		return rule;
	}

	private PayPolicyRule baseRule(
			String name,
			PayPolicyRuleType type,
			String premiumPercent,
			boolean enabled
	) {
		PayPolicyRule rule = new PayPolicyRule();
		rule.setName(name);
		rule.setType(type);
		rule.setEnabled(enabled);
		rule.setPremiumPercent(new BigDecimal(premiumPercent));
		return rule;
	}

	private Instant localInstant(int year, int month, int day, int hour, int minute) {
		return localInstant(year, month, day, hour, minute, 0);
	}

	private Instant localInstant(int year, int month, int day, int hour, int minute, int second) {
		return ZonedDateTime.of(year, month, day, hour, minute, second, 0, BERLIN).toInstant();
	}

	private Instant localInstantWithOffset(
			int year,
			int month,
			int day,
			int hour,
			int minute,
			String offset
	) {
		LocalDateTime localDateTime = LocalDateTime.of(year, month, day, hour, minute);
		return ZonedDateTime.ofLocal(localDateTime, BERLIN, ZoneOffset.of(offset)).toInstant();
	}

	private PremiumPayableInterval previous(Instant start, Instant end) {
		return previousFor(WORKER_ID, COMPANY_ID, start, end);
	}

	private PremiumPayableInterval previousFor(long workerId, long companyId, Instant start, Instant end) {
		return PremiumPayableInterval.previousFinalized(
				workerId,
				companyId,
				stableIdFor(workerId, companyId, start),
				start,
				start,
				start,
				end
		);
	}

	private PremiumPayableInterval previousWithStableId(
			long stableId,
			Instant shiftActualStartTime,
			Instant attendancePayableStartTime,
			Instant start,
			Instant end
	) {
		return PremiumPayableInterval.previousFinalized(
				WORKER_ID,
				COMPANY_ID,
				stableId,
				shiftActualStartTime,
				attendancePayableStartTime,
				start,
				end
		);
	}

	private PremiumPayableInterval currentWithStableId(
			long stableId,
			Instant shiftActualStartTime,
			Instant attendancePayableStartTime,
			Instant start,
			Instant end
	) {
		return PremiumPayableInterval.current(
				WORKER_ID,
				COMPANY_ID,
				stableId,
				shiftActualStartTime,
				attendancePayableStartTime,
				start,
				end
		);
	}

	private long stableIdFor(long workerId, long companyId, Instant start) {
		return workerId * 1_000_000_000_000L
				+ companyId * 1_000_000L
				+ Math.floorMod(start.toEpochMilli(), 1_000_000L);
	}

	private void assertMoney(BigDecimal actual, String expected) {
		assertThat(actual).isEqualByComparingTo(new BigDecimal(expected));
		assertThat(actual.toPlainString()).isEqualTo(expected);
	}

	private void assertExactDecimal(BigDecimal actual, String expected) {
		assertThat(actual).isEqualByComparingTo(new BigDecimal(expected));
		assertThat(actual.toPlainString()).isEqualTo(expected);
	}

	private void assertSegment(
			PremiumPaySegment segment,
			Instant expectedStart,
			Instant expectedEnd,
			String expectedSeconds
	) {
		assertThat(segment.start()).isEqualTo(expectedStart);
		assertThat(segment.end()).isEqualTo(expectedEnd);
		assertExactDecimal(segment.payableSeconds(), expectedSeconds);
		BigDecimal expectedMinutes = new BigDecimal(expectedSeconds)
				.divide(new BigDecimal("60"), 8, RoundingMode.HALF_UP);
		assertExactDecimal(segment.payableMinutesExact(), expectedMinutes.toPlainString());
	}

	private void assertContiguousCoverage(
			PremiumPayCalculationResult result,
			Instant expectedStart,
			Instant expectedEnd,
			String expectedSeconds
	) {
		assertThat(result.segments()).isNotEmpty();
		assertThat(result.segments().getFirst().start()).isEqualTo(expectedStart);
		for (int index = 1; index < result.segments().size(); index++) {
			assertThat(result.segments().get(index).start()).isEqualTo(result.segments().get(index - 1).end());
		}
		assertThat(result.segments().getLast().end()).isEqualTo(expectedEnd);
		assertExactDecimal(result.totalRawSeconds(), expectedSeconds);
		BigDecimal segmentSeconds = result.segments()
				.stream()
				.map(PremiumPaySegment::payableSeconds)
				.reduce(new BigDecimal("0.000000000"), BigDecimal::add);
		assertExactDecimal(segmentSeconds, expectedSeconds);
	}
}
