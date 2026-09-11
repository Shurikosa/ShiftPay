package com.shiftpay.mvp.service;

import com.shiftpay.mvp.dto.HolidayDateCondition;
import com.shiftpay.mvp.dto.PayPolicyRuleCondition;
import com.shiftpay.mvp.entity.PayPolicyRule;
import com.shiftpay.mvp.entity.PayPolicyRuleType;
import com.shiftpay.mvp.entity.PayPolicyStackingStrategy;
import com.shiftpay.mvp.entity.PayPolicyVersion;
import org.springframework.stereotype.Service;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.Duration;
import java.time.Instant;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.LocalTime;
import java.time.ZoneId;
import java.time.ZoneOffset;
import java.time.ZonedDateTime;
import java.time.zone.ZoneOffsetTransition;
import java.time.zone.ZoneRules;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.EnumSet;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.Set;
import java.util.TreeSet;
import java.util.stream.IntStream;

/**
 * Internal Phase 2A/2B premium calculation foundation.
 */
@Service
public class PremiumPayCalculationService {

	private static final int DURATION_SCALE = 9;
	private static final int CALCULATION_SCALE = 8;
	private static final BigDecimal SECONDS_PER_MINUTE = BigDecimal.valueOf(60);
	private static final BigDecimal SECONDS_PER_HOUR = BigDecimal.valueOf(3600);
	private static final BigDecimal PERCENT_DIVISOR = BigDecimal.valueOf(100);
	private static final Set<PayPolicyRuleType> SUPPORTED_RULE_TYPES = EnumSet.of(
			PayPolicyRuleType.TIME_OF_DAY,
			PayPolicyRuleType.DAY_OF_WEEK,
			PayPolicyRuleType.HOLIDAY,
			PayPolicyRuleType.DAILY_OVERTIME,
			PayPolicyRuleType.WEEKLY_OVERTIME
	);

	/**
	 * Calculates explainable premium pay for one interval using a frozen policy version.
	 *
	 * @param intervalStart interval start instant
	 * @param intervalEnd interval end instant
	 * @param baseHourlyRate base hourly rate
	 * @param policyVersion frozen pay policy version
	 * @return segmented premium calculation result
	 */
	public PremiumPayCalculationResult calculate(
			Instant intervalStart,
			Instant intervalEnd,
			BigDecimal baseHourlyRate,
			PayPolicyVersion policyVersion
	) {
		validateInputs(intervalStart, intervalEnd, baseHourlyRate, policyVersion);
		return calculate(
				intervalStart,
				intervalEnd,
				baseHourlyRate,
				policyVersion,
				PremiumPayCalculationContext.currentOnly(intervalStart, intervalEnd)
		);
	}

	/**
	 * Calculates explainable premium pay for one interval using explicit overtime context.
	 *
	 * @param intervalStart interval start instant
	 * @param intervalEnd interval end instant
	 * @param baseHourlyRate base hourly rate
	 * @param policyVersion frozen pay policy version
	 * @param calculationContext previous finalized intervals plus current interval metadata
	 * @return segmented premium calculation result
	 */
	public PremiumPayCalculationResult calculate(
			Instant intervalStart,
			Instant intervalEnd,
			BigDecimal baseHourlyRate,
			PayPolicyVersion policyVersion,
			PremiumPayCalculationContext calculationContext
	) {
		validateInputs(intervalStart, intervalEnd, baseHourlyRate, policyVersion);
		validateCalculationContext(intervalStart, intervalEnd, calculationContext);
		if (!intervalStart.isBefore(intervalEnd)) {
			return new PremiumPayCalculationResult(
					List.of(),
					zeroSeconds(),
					0,
					zeroAmount(),
					zeroAmount(),
					zeroAmount(),
					zeroAmount()
			);
		}

		ZoneId zone = ZoneId.of(policyVersion.getCompany().getTimeZone());
		List<RuleSnapshot> rules = supportedEnabledRules(policyVersion);
		Map<RuleSnapshot, List<InstantRange>> overtimeRanges = overtimeRanges(
				intervalStart,
				intervalEnd,
				zone,
				policyVersion.getWeekStartsOn(),
				rules,
				calculationContext
		);
		List<Instant> boundaries = calculationBoundaries(intervalStart, intervalEnd, zone, rules, overtimeRanges);
		List<PremiumPaySegment> segments = segments(
				boundaries,
				zone,
				baseHourlyRate,
				policyVersion.getStackingStrategy(),
				rules,
				overtimeRanges
		);

		BigDecimal totalBaseAmount = sumBaseAmounts(segments);
		BigDecimal totalPremiumAmount = sumPremiumAmounts(segments);
		BigDecimal totalAmount = sumTotalAmounts(segments);
		if (totalAmount.compareTo(totalBaseAmount.add(totalPremiumAmount).setScale(CALCULATION_SCALE, RoundingMode.HALF_UP)) != 0) {
			throw new IllegalStateException("Premium pay segment amounts do not balance");
		}
		BigDecimal totalRawSeconds = sumPayableSeconds(segments);
		long totalRawMinutes = wholeMinutes(totalRawSeconds);
		BigDecimal totalRawMinutesExact = minutesExact(totalRawSeconds);

		return new PremiumPayCalculationResult(
				segments,
				totalRawSeconds,
				totalRawMinutes,
				totalRawMinutesExact,
				totalBaseAmount,
				totalPremiumAmount,
				totalAmount
		);
	}

	private void validateInputs(
			Instant intervalStart,
			Instant intervalEnd,
			BigDecimal baseHourlyRate,
			PayPolicyVersion policyVersion
	) {
		Objects.requireNonNull(intervalStart, "intervalStart");
		Objects.requireNonNull(intervalEnd, "intervalEnd");
		Objects.requireNonNull(baseHourlyRate, "baseHourlyRate");
		Objects.requireNonNull(policyVersion, "policyVersion");
		Objects.requireNonNull(policyVersion.getCompany(), "policyVersion.company");
		Objects.requireNonNull(policyVersion.getCompany().getTimeZone(), "policyVersion.company.timeZone");
		Objects.requireNonNull(policyVersion.getWeekStartsOn(), "policyVersion.weekStartsOn");
		Objects.requireNonNull(policyVersion.getStackingStrategy(), "policyVersion.stackingStrategy");
		if (intervalEnd.isBefore(intervalStart)) {
			throw new IllegalArgumentException("intervalEnd must not be before intervalStart");
		}
		if (baseHourlyRate.signum() < 0) {
			throw new IllegalArgumentException("baseHourlyRate must not be negative");
		}
	}

	private void validateCalculationContext(
			Instant intervalStart,
			Instant intervalEnd,
			PremiumPayCalculationContext calculationContext
	) {
		Objects.requireNonNull(calculationContext, "calculationContext");
		PremiumPayableInterval currentInterval = calculationContext.currentInterval();
		if (!currentInterval.start().equals(intervalStart) || !currentInterval.end().equals(intervalEnd)) {
			throw new IllegalArgumentException("calculationContext current interval must match intervalStart and intervalEnd");
		}
	}

	private List<RuleSnapshot> supportedEnabledRules(PayPolicyVersion policyVersion) {
		return policyVersion.sortedRules()
				.stream()
				.filter(PayPolicyRule::isEnabled)
				.filter((rule) -> SUPPORTED_RULE_TYPES.contains(rule.getType()))
				.map((rule) -> new RuleSnapshot(
						rule.getId(),
						rule.getName(),
						rule.getType(),
						rule.getPremiumPercent(),
						PayPolicyConditionJson.read(rule.getConditionConfig())
				))
				.toList();
	}

	private List<Instant> calculationBoundaries(
			Instant intervalStart,
			Instant intervalEnd,
			ZoneId zone,
			List<RuleSnapshot> rules,
			Map<RuleSnapshot, List<InstantRange>> overtimeRanges
	) {
		TreeSet<Instant> boundaries = new TreeSet<>();
		boundaries.add(intervalStart);
		boundaries.add(intervalEnd);

		ZonedDateTime localStart = intervalStart.atZone(zone);
		ZonedDateTime localEnd = intervalEnd.atZone(zone);
		LocalDate firstDate = localStart.toLocalDate().minusDays(1);
		LocalDate lastDate = localEnd.toLocalDate().plusDays(1);

		for (LocalDate date = firstDate; !date.isAfter(lastDate); date = date.plusDays(1)) {
			addBoundaryIfInside(boundaries, date.atStartOfDay(zone).toInstant(), intervalStart, intervalEnd);
			for (RuleSnapshot rule : rules) {
				if (rule.type() == PayPolicyRuleType.TIME_OF_DAY) {
					addTimeOfDayBoundaries(boundaries, date, zone, intervalStart, intervalEnd, rule.condition());
				}
			}
		}
		addZoneTransitionBoundaries(boundaries, zone, intervalStart, intervalEnd);
		addOvertimeBoundaries(boundaries, intervalStart, intervalEnd, overtimeRanges);
		return List.copyOf(boundaries);
	}

	private void addTimeOfDayBoundaries(
			TreeSet<Instant> boundaries,
			LocalDate date,
			ZoneId zone,
			Instant intervalStart,
			Instant intervalEnd,
			PayPolicyRuleCondition condition
	) {
		for (Instant instant : toInstants(date, condition.startTime(), zone)) {
			addBoundaryIfInside(boundaries, instant, intervalStart, intervalEnd);
		}
		for (Instant instant : toInstants(date, condition.endTime(), zone)) {
			addBoundaryIfInside(boundaries, instant, intervalStart, intervalEnd);
		}
	}

	private List<Instant> toInstants(LocalDate date, LocalTime time, ZoneId zone) {
		LocalDateTime localDateTime = date.atTime(time);
		ZoneRules rules = zone.getRules();
		List<ZoneOffset> validOffsets = rules.getValidOffsets(localDateTime);
		if (!validOffsets.isEmpty()) {
			return validOffsets.stream()
					.map((offset) -> localDateTime.atOffset(offset).toInstant())
					.toList();
		}
		ZoneOffsetTransition transition = rules.getTransition(localDateTime);
		if (transition != null) {
			return List.of(transition.getInstant(), localDateTime.atZone(zone).toInstant());
		}
		return List.of(localDateTime.atZone(zone).toInstant());
	}

	private void addZoneTransitionBoundaries(
			TreeSet<Instant> boundaries,
			ZoneId zone,
			Instant intervalStart,
			Instant intervalEnd
	) {
		ZoneRules rules = zone.getRules();
		ZoneOffsetTransition transition = rules.nextTransition(intervalStart.minusNanos(1));
		while (transition != null && transition.getInstant().isBefore(intervalEnd)) {
			addBoundaryIfInside(boundaries, transition.getInstant(), intervalStart, intervalEnd);
			transition = rules.nextTransition(transition.getInstant());
		}
	}

	private void addOvertimeBoundaries(
			TreeSet<Instant> boundaries,
			Instant intervalStart,
			Instant intervalEnd,
			Map<RuleSnapshot, List<InstantRange>> overtimeRanges
	) {
		for (List<InstantRange> ranges : overtimeRanges.values()) {
			for (InstantRange range : ranges) {
				addBoundaryIfInside(boundaries, range.start(), intervalStart, intervalEnd);
				addBoundaryIfInside(boundaries, range.end(), intervalStart, intervalEnd);
			}
		}
	}

	private void addBoundaryIfInside(
			TreeSet<Instant> boundaries,
			Instant candidate,
			Instant intervalStart,
			Instant intervalEnd
	) {
		if (candidate.isAfter(intervalStart) && candidate.isBefore(intervalEnd)) {
			boundaries.add(candidate);
		}
	}

	private List<PremiumPaySegment> segments(
			List<Instant> boundaries,
			ZoneId zone,
			BigDecimal baseHourlyRate,
			PayPolicyStackingStrategy stackingStrategy,
			List<RuleSnapshot> rules,
			Map<RuleSnapshot, List<InstantRange>> overtimeRanges
	) {
		return IntStream.range(0, boundaries.size() - 1)
				.mapToObj((index) -> segment(
						boundaries.get(index),
						boundaries.get(index + 1),
						zone,
						baseHourlyRate,
						stackingStrategy,
						rules,
						overtimeRanges
				))
				.filter(Objects::nonNull)
				.toList();
	}

	private PremiumPaySegment segment(
			Instant segmentStart,
			Instant segmentEnd,
			ZoneId zone,
			BigDecimal baseHourlyRate,
			PayPolicyStackingStrategy stackingStrategy,
			List<RuleSnapshot> rules,
			Map<RuleSnapshot, List<InstantRange>> overtimeRanges
	) {
		Duration duration = Duration.between(segmentStart, segmentEnd);
		if (duration.isZero() || duration.isNegative()) {
			return null;
		}
		BigDecimal payableSeconds = secondsExact(duration);
		BigDecimal payableMinutesExact = minutesExact(payableSeconds);
		long payableMinutes = wholeMinutes(payableSeconds);

		List<AppliedPremiumRule> matchingRules = rules.stream()
				.filter((rule) -> applies(rule, segmentStart, zone, overtimeRanges))
				.map(RuleSnapshot::toAppliedRule)
				.toList();
		List<AppliedPremiumRule> appliedRules = appliedRules(matchingRules, stackingStrategy);
		BigDecimal effectivePremiumPercent = effectivePremiumPercent(appliedRules, stackingStrategy);
		BigDecimal baseAmount = amountForSeconds(baseHourlyRate, payableSeconds);
		BigDecimal premiumAmount = premiumAmount(baseAmount, effectivePremiumPercent);
		BigDecimal totalAmount = baseAmount.add(premiumAmount).setScale(CALCULATION_SCALE, RoundingMode.HALF_UP);
		BigDecimal effectiveHourlyRate = effectiveHourlyRate(baseHourlyRate, effectivePremiumPercent);

		return new PremiumPaySegment(
				segmentStart,
				segmentEnd,
				payableSeconds,
				payableMinutesExact,
				payableMinutes,
				baseHourlyRate,
				appliedRules,
				stackingStrategy,
				effectivePremiumPercent,
				effectiveHourlyRate,
				baseAmount,
				premiumAmount,
				totalAmount
		);
	}

	private boolean applies(
			RuleSnapshot rule,
			Instant segmentStart,
			ZoneId zone,
			Map<RuleSnapshot, List<InstantRange>> overtimeRanges
	) {
		ZonedDateTime localStart = segmentStart.atZone(zone);
		return switch (rule.type()) {
			case TIME_OF_DAY -> appliesTimeOfDay(rule.condition(), localStart.toLocalTime());
			case DAY_OF_WEEK -> appliesDayOfWeek(rule.condition(), localStart);
			case HOLIDAY -> appliesHoliday(rule.condition(), localStart);
			case DAILY_OVERTIME, WEEKLY_OVERTIME -> appliesOvertime(rule, segmentStart, overtimeRanges);
		};
	}

	private boolean appliesTimeOfDay(PayPolicyRuleCondition condition, LocalTime localTime) {
		LocalTime startTime = condition.startTime();
		LocalTime endTime = condition.endTime();
		if (startTime == null || endTime == null || startTime.equals(endTime)) {
			return false;
		}
		if (startTime.isBefore(endTime)) {
			return !localTime.isBefore(startTime) && localTime.isBefore(endTime);
		}
		return !localTime.isBefore(startTime) || localTime.isBefore(endTime);
	}

	private boolean appliesDayOfWeek(PayPolicyRuleCondition condition, ZonedDateTime localStart) {
		return condition.weekdays() != null && condition.weekdays().contains(localStart.getDayOfWeek());
	}

	private boolean appliesHoliday(PayPolicyRuleCondition condition, ZonedDateTime localStart) {
		if (condition.dates() == null) {
			return false;
		}
		LocalDate localDate = localStart.toLocalDate();
		return condition.dates()
				.stream()
				.filter(Objects::nonNull)
				.map(HolidayDateCondition::date)
				.anyMatch(localDate::equals);
	}

	private boolean appliesOvertime(
			RuleSnapshot rule,
			Instant segmentStart,
			Map<RuleSnapshot, List<InstantRange>> overtimeRanges
	) {
		return overtimeRanges.getOrDefault(rule, List.of())
				.stream()
				.anyMatch((range) -> !segmentStart.isBefore(range.start()) && segmentStart.isBefore(range.end()));
	}

	private Map<RuleSnapshot, List<InstantRange>> overtimeRanges(
			Instant intervalStart,
			Instant intervalEnd,
			ZoneId zone,
			java.time.DayOfWeek weekStartsOn,
			List<RuleSnapshot> rules,
			PremiumPayCalculationContext calculationContext
	) {
		Map<RuleSnapshot, List<InstantRange>> ranges = new HashMap<>();
		for (RuleSnapshot rule : rules) {
			if (rule.type() == PayPolicyRuleType.DAILY_OVERTIME || rule.type() == PayPolicyRuleType.WEEKLY_OVERTIME) {
				ranges.put(rule, overtimeRanges(intervalStart, intervalEnd, zone, weekStartsOn, rule, calculationContext));
			}
		}
		return ranges;
	}

	private List<InstantRange> overtimeRanges(
			Instant intervalStart,
			Instant intervalEnd,
			ZoneId zone,
			java.time.DayOfWeek weekStartsOn,
			RuleSnapshot rule,
			PremiumPayCalculationContext calculationContext
	) {
		BigDecimal thresholdSeconds = BigDecimal.valueOf(rule.condition().thresholdMinutes())
				.multiply(SECONDS_PER_MINUTE)
				.setScale(DURATION_SCALE, RoundingMode.HALF_UP);
		List<OvertimePiece> pieces = scopedIntervals(calculationContext)
				.stream()
				.flatMap((interval) -> overtimePieces(interval, zone, weekStartsOn, rule.type()).stream())
				.filter((piece) -> piece.end().isAfter(piece.start()))
				.toList();
		return pieces.stream()
				.map(OvertimePiece::periodStart)
				.distinct()
				.sorted()
				.flatMap((periodStart) -> overtimeRangesForPeriod(
						periodStart,
						pieces,
						thresholdSeconds,
						intervalStart,
						intervalEnd
				).stream())
				.toList();
	}

	private List<PremiumPayableInterval> scopedIntervals(PremiumPayCalculationContext calculationContext) {
		PremiumPayableInterval currentInterval = calculationContext.currentInterval();
		return calculationContext.allIntervals()
				.stream()
				.filter((interval) -> interval.current() || sameScope(currentInterval.workerId(), interval.workerId()))
				.filter((interval) -> interval.current() || sameScope(currentInterval.companyId(), interval.companyId()))
				.toList();
	}

	private boolean sameScope(Long currentScopeId, Long candidateScopeId) {
		return currentScopeId == null || Objects.equals(currentScopeId, candidateScopeId);
	}

	private List<InstantRange> overtimeRangesForPeriod(
			Instant periodStart,
			List<OvertimePiece> pieces,
			BigDecimal thresholdSeconds,
			Instant intervalStart,
			Instant intervalEnd
	) {
		List<OvertimePiece> periodPieces = pieces.stream()
				.filter((piece) -> piece.periodStart().equals(periodStart))
				.sorted(overtimePieceComparator())
				.toList();
		BigDecimal cumulativeSeconds = zeroSeconds();
		List<InstantRange> ranges = new ArrayList<>();
		for (OvertimePiece piece : periodPieces) {
			BigDecimal pieceSeconds = secondsExact(Duration.between(piece.start(), piece.end()));
			BigDecimal afterPieceSeconds = cumulativeSeconds.add(pieceSeconds).setScale(DURATION_SCALE, RoundingMode.HALF_UP);
			if (piece.interval().current()) {
				addCurrentOvertimeRange(
						ranges,
						piece,
						cumulativeSeconds,
						afterPieceSeconds,
						thresholdSeconds,
						intervalStart,
						intervalEnd
				);
			}
			cumulativeSeconds = afterPieceSeconds;
		}
		return ranges;
	}

	private void addCurrentOvertimeRange(
			List<InstantRange> ranges,
			OvertimePiece piece,
			BigDecimal beforePieceSeconds,
			BigDecimal afterPieceSeconds,
			BigDecimal thresholdSeconds,
			Instant intervalStart,
			Instant intervalEnd
	) {
		Instant rangeStart = null;
		if (beforePieceSeconds.compareTo(thresholdSeconds) >= 0) {
			rangeStart = piece.start();
		} else if (afterPieceSeconds.compareTo(thresholdSeconds) > 0) {
			rangeStart = piece.start().plus(durationFromSeconds(thresholdSeconds.subtract(beforePieceSeconds)));
		}
		if (rangeStart != null && rangeStart.isBefore(piece.end())) {
			Instant start = rangeStart.isBefore(intervalStart) ? intervalStart : rangeStart;
			Instant end = piece.end().isAfter(intervalEnd) ? intervalEnd : piece.end();
			if (start.isBefore(end)) {
				ranges.add(new InstantRange(start, end));
			}
		}
	}

	private List<OvertimePiece> overtimePieces(
			PremiumPayableInterval interval,
			ZoneId zone,
			java.time.DayOfWeek weekStartsOn,
			PayPolicyRuleType ruleType
	) {
		List<OvertimePiece> pieces = new ArrayList<>();
		Instant cursor = interval.start();
		while (cursor.isBefore(interval.end())) {
			Instant periodStart = periodStart(cursor, zone, weekStartsOn, ruleType);
			Instant periodEnd = periodEnd(periodStart, zone, ruleType);
			Instant pieceEnd = minInstant(interval.end(), periodEnd);
			pieces.add(new OvertimePiece(interval, periodStart, cursor, pieceEnd));
			cursor = pieceEnd;
		}
		return pieces;
	}

	private Instant periodStart(
			Instant instant,
			ZoneId zone,
			java.time.DayOfWeek weekStartsOn,
			PayPolicyRuleType ruleType
	) {
		LocalDate localDate = instant.atZone(zone).toLocalDate();
		if (ruleType == PayPolicyRuleType.DAILY_OVERTIME) {
			return localDate.atStartOfDay(zone).toInstant();
		}
		int daysSinceWeekStart = Math.floorMod(
				localDate.getDayOfWeek().getValue() - weekStartsOn.getValue(),
				7
		);
		return localDate.minusDays(daysSinceWeekStart).atStartOfDay(zone).toInstant();
	}

	private Instant periodEnd(Instant periodStart, ZoneId zone, PayPolicyRuleType ruleType) {
		ZonedDateTime localPeriodStart = periodStart.atZone(zone);
		if (ruleType == PayPolicyRuleType.DAILY_OVERTIME) {
			return localPeriodStart.toLocalDate().plusDays(1).atStartOfDay(zone).toInstant();
		}
		return localPeriodStart.toLocalDate().plusWeeks(1).atStartOfDay(zone).toInstant();
	}

	private Comparator<OvertimePiece> overtimePieceComparator() {
		return Comparator.comparing(OvertimePiece::start)
				.thenComparing((piece) -> tieInstant(piece.interval().attendancePayableStartTime(), piece.interval().start()))
				.thenComparing((piece) -> piece.interval().stableId())
				.thenComparing((piece) -> piece.interval().current());
	}

	private Instant tieInstant(Instant candidate, Instant fallback) {
		return candidate == null ? fallback : candidate;
	}

	private Instant minInstant(Instant first, Instant second) {
		return first.isBefore(second) ? first : second;
	}

	private List<AppliedPremiumRule> appliedRules(
			List<AppliedPremiumRule> matchingRules,
			PayPolicyStackingStrategy stackingStrategy
	) {
		if (stackingStrategy == PayPolicyStackingStrategy.ADD || matchingRules.isEmpty()) {
			return matchingRules;
		}
		BigDecimal highestPremium = matchingRules.stream()
				.map(AppliedPremiumRule::premiumPercent)
				.max(BigDecimal::compareTo)
				.orElse(BigDecimal.ZERO);
		return matchingRules.stream()
				.filter((rule) -> rule.premiumPercent().compareTo(highestPremium) == 0)
				.toList();
	}

	private BigDecimal effectivePremiumPercent(
			List<AppliedPremiumRule> appliedRules,
			PayPolicyStackingStrategy stackingStrategy
	) {
		if (appliedRules.isEmpty()) {
			return zeroPercent();
		}
		if (stackingStrategy == PayPolicyStackingStrategy.HIGHEST_ONLY) {
			return appliedRules.getFirst().premiumPercent();
		}
		BigDecimal total = zeroPercent();
		for (AppliedPremiumRule rule : appliedRules) {
			total = total.add(rule.premiumPercent());
		}
		return total;
	}

	private BigDecimal amountForSeconds(BigDecimal hourlyRate, BigDecimal seconds) {
		return hourlyRate.multiply(seconds)
				.divide(SECONDS_PER_HOUR, CALCULATION_SCALE, RoundingMode.HALF_UP);
	}

	private BigDecimal premiumAmount(BigDecimal baseAmount, BigDecimal premiumPercent) {
		return baseAmount.multiply(premiumPercent)
				.divide(PERCENT_DIVISOR, CALCULATION_SCALE, RoundingMode.HALF_UP);
	}

	private BigDecimal effectiveHourlyRate(BigDecimal baseHourlyRate, BigDecimal premiumPercent) {
		return baseHourlyRate.multiply(PERCENT_DIVISOR.add(premiumPercent))
				.divide(PERCENT_DIVISOR, CALCULATION_SCALE, RoundingMode.HALF_UP);
	}

	private BigDecimal sumBaseAmounts(List<PremiumPaySegment> segments) {
		return segments.stream()
				.map(PremiumPaySegment::baseAmount)
				.reduce(zeroAmount(), BigDecimal::add)
				.setScale(CALCULATION_SCALE, RoundingMode.HALF_UP);
	}

	private BigDecimal sumPremiumAmounts(List<PremiumPaySegment> segments) {
		return segments.stream()
				.map(PremiumPaySegment::premiumAmount)
				.reduce(zeroAmount(), BigDecimal::add)
				.setScale(CALCULATION_SCALE, RoundingMode.HALF_UP);
	}

	private BigDecimal sumTotalAmounts(List<PremiumPaySegment> segments) {
		return segments.stream()
				.map(PremiumPaySegment::totalAmount)
				.reduce(zeroAmount(), BigDecimal::add)
				.setScale(CALCULATION_SCALE, RoundingMode.HALF_UP);
	}

	private BigDecimal sumPayableSeconds(List<PremiumPaySegment> segments) {
		return segments.stream()
				.map(PremiumPaySegment::payableSeconds)
				.reduce(zeroSeconds(), BigDecimal::add)
				.setScale(DURATION_SCALE, RoundingMode.HALF_UP);
	}

	private BigDecimal secondsExact(Duration duration) {
		return BigDecimal.valueOf(duration.getSeconds())
				.add(BigDecimal.valueOf(duration.getNano(), DURATION_SCALE))
				.setScale(DURATION_SCALE, RoundingMode.HALF_UP);
	}

	private Duration durationFromSeconds(BigDecimal seconds) {
		BigDecimal normalizedSeconds = seconds.setScale(DURATION_SCALE, RoundingMode.HALF_UP);
		long wholeSeconds = normalizedSeconds.longValue();
		int nanos = normalizedSeconds.subtract(BigDecimal.valueOf(wholeSeconds))
				.movePointRight(DURATION_SCALE)
				.intValueExact();
		return Duration.ofSeconds(wholeSeconds, nanos);
	}

	private BigDecimal minutesExact(BigDecimal seconds) {
		return seconds.divide(SECONDS_PER_MINUTE, CALCULATION_SCALE, RoundingMode.HALF_UP);
	}

	private long wholeMinutes(BigDecimal seconds) {
		return seconds.divideToIntegralValue(SECONDS_PER_MINUTE).longValueExact();
	}

	private BigDecimal zeroAmount() {
		return BigDecimal.ZERO.setScale(CALCULATION_SCALE, RoundingMode.HALF_UP);
	}

	private BigDecimal zeroSeconds() {
		return BigDecimal.ZERO.setScale(DURATION_SCALE, RoundingMode.HALF_UP);
	}

	private BigDecimal zeroPercent() {
		return BigDecimal.ZERO.setScale(4, RoundingMode.HALF_UP);
	}

	private record RuleSnapshot(
			Long id,
			String name,
			PayPolicyRuleType type,
			BigDecimal premiumPercent,
			PayPolicyRuleCondition condition
	) {

		private AppliedPremiumRule toAppliedRule() {
			return new AppliedPremiumRule(id, name, type, premiumPercent);
		}
	}

	private record InstantRange(Instant start, Instant end) {
	}

	private record OvertimePiece(
			PremiumPayableInterval interval,
			Instant periodStart,
			Instant start,
			Instant end
	) {
	}
}
