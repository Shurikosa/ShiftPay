package com.shiftpay.mvp.service;

import java.math.BigDecimal;
import java.util.List;
import java.util.Objects;

/**
 * Explainable premium pay calculation result for an interval.
 *
 * @param segments calculated pay segments
 * @param totalRawSeconds exact elapsed interval seconds included in the calculation
 * @param totalRawMinutes whole elapsed interval minutes included in the calculation, derived for display only
 * @param totalRawMinutesExact exact elapsed interval minutes included in the calculation
 * @param totalBaseAmount base pay total
 * @param totalPremiumAmount premium pay total
 * @param totalAmount base plus premium total
 */
public record PremiumPayCalculationResult(
		List<PremiumPaySegment> segments,
		BigDecimal totalRawSeconds,
		long totalRawMinutes,
		BigDecimal totalRawMinutesExact,
		BigDecimal totalBaseAmount,
		BigDecimal totalPremiumAmount,
		BigDecimal totalAmount
) {

	public PremiumPayCalculationResult {
		segments = List.copyOf(Objects.requireNonNull(segments, "segments"));
		Objects.requireNonNull(totalRawSeconds, "totalRawSeconds");
		Objects.requireNonNull(totalRawMinutesExact, "totalRawMinutesExact");
		Objects.requireNonNull(totalBaseAmount, "totalBaseAmount");
		Objects.requireNonNull(totalPremiumAmount, "totalPremiumAmount");
		Objects.requireNonNull(totalAmount, "totalAmount");
	}
}
