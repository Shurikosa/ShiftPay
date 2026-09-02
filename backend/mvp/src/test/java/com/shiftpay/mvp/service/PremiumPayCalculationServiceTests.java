package com.shiftpay.mvp.service;

import com.shiftpay.mvp.dto.HolidayDateCondition;
import com.shiftpay.mvp.entity.Company;
import com.shiftpay.mvp.entity.PayPolicyRule;
import com.shiftpay.mvp.entity.PayPolicyRuleType;
import com.shiftpay.mvp.entity.PayPolicyStackingStrategy;
import com.shiftpay.mvp.entity.PayPolicyVersion;
import org.junit.jupiter.api.Test;

import java.math.BigDecimal;
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

/**
 * Unit tests for the internal Phase 2A premium pay calculation foundation.
 */
class PremiumPayCalculationServiceTests {

	private static final ZoneId BERLIN = ZoneId.of("Europe/Berlin");
	private static final BigDecimal BASE_20 = new BigDecimal("20.00");
	private static final BigDecimal BASE_60 = new BigDecimal("60.00");

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
	 * Overtime rules are intentionally deferred in Phase 2A.
	 */
	@Test
	void overtimeRulesAreDeferredAndDoNotAffectPremiums() {
		PayPolicyVersion policy = policy(
				PayPolicyStackingStrategy.ADD,
				overtimeRule("Daily overtime", PayPolicyRuleType.DAILY_OVERTIME, "100.0000", 480),
				overtimeRule("Weekly overtime", PayPolicyRuleType.WEEKLY_OVERTIME, "200.0000", 2400)
		);

		PremiumPayCalculationResult result = calculate(
				policy,
				localInstant(2026, 7, 6, 8, 0),
				localInstant(2026, 7, 6, 18, 0)
		);

		assertThat(result.segments()).hasSize(1);
		assertThat(result.segments().getFirst().appliedRules()).isEmpty();
		assertThat(result.segments().getFirst().effectivePremiumPercent()).isEqualByComparingTo("0.0000");
		assertMoney(result.totalBaseAmount(), "200.00000000");
		assertMoney(result.totalPremiumAmount(), "0.00000000");
		assertMoney(result.totalAmount(), "200.00000000");
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

	private PayPolicyVersion policy(PayPolicyStackingStrategy stackingStrategy, PayPolicyRule... rules) {
		Company company = new Company();
		company.setName("Acme");
		company.setJoinCode("ACME123");
		company.setTimeZone(BERLIN.getId());

		PayPolicyVersion policy = new PayPolicyVersion();
		policy.setCompany(company);
		policy.setVersion(1);
		policy.setWeekStartsOn(DayOfWeek.MONDAY);
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
		PayPolicyRule rule = baseRule(name, type, premiumPercent, true);
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

	private void assertMoney(BigDecimal actual, String expected) {
		assertThat(actual).isEqualByComparingTo(new BigDecimal(expected));
		assertThat(actual.toPlainString()).isEqualTo(expected);
	}

	private void assertExactDecimal(BigDecimal actual, String expected) {
		assertThat(actual).isEqualByComparingTo(new BigDecimal(expected));
		assertThat(actual.toPlainString()).isEqualTo(expected);
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
