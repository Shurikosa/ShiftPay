package com.shiftpay.mvp.service;

import com.shiftpay.mvp.entity.PayPolicyStackingStrategy;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.List;
import java.util.Objects;

/**
 * One contiguous interval where premium rule matching is stable.
 *
 * @param start segment start instant
 * @param end segment end instant
 * @param payableSeconds exact elapsed payable seconds in this segment
 * @param payableMinutesExact exact elapsed payable minutes in this segment
 * @param payableMinutes whole elapsed payable minutes in this segment, derived for display only
 * @param baseHourlyRate base hourly rate
 * @param appliedRules rules applied after stacking selection
 * @param stackingStrategy policy stacking strategy
 * @param effectivePremiumPercent effective premium percentage for the segment
 * @param effectiveHourlyRate base hourly rate plus effective premium
 * @param baseAmount base amount for the segment
 * @param premiumAmount premium amount for the segment
 * @param totalAmount base plus premium amount for the segment
 */
public record PremiumPaySegment(
		Instant start,
		Instant end,
		BigDecimal payableSeconds,
		BigDecimal payableMinutesExact,
		long payableMinutes,
		BigDecimal baseHourlyRate,
		List<AppliedPremiumRule> appliedRules,
		PayPolicyStackingStrategy stackingStrategy,
		BigDecimal effectivePremiumPercent,
		BigDecimal effectiveHourlyRate,
		BigDecimal baseAmount,
		BigDecimal premiumAmount,
		BigDecimal totalAmount
) {

	public PremiumPaySegment {
		Objects.requireNonNull(start, "start");
		Objects.requireNonNull(end, "end");
		Objects.requireNonNull(payableSeconds, "payableSeconds");
		Objects.requireNonNull(payableMinutesExact, "payableMinutesExact");
		Objects.requireNonNull(baseHourlyRate, "baseHourlyRate");
		appliedRules = List.copyOf(Objects.requireNonNull(appliedRules, "appliedRules"));
		Objects.requireNonNull(stackingStrategy, "stackingStrategy");
		Objects.requireNonNull(effectivePremiumPercent, "effectivePremiumPercent");
		Objects.requireNonNull(effectiveHourlyRate, "effectiveHourlyRate");
		Objects.requireNonNull(baseAmount, "baseAmount");
		Objects.requireNonNull(premiumAmount, "premiumAmount");
		Objects.requireNonNull(totalAmount, "totalAmount");
	}
}
