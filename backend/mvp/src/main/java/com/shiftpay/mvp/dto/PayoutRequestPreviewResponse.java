package com.shiftpay.mvp.dto;

import tools.jackson.databind.annotation.JsonSerialize;

import java.math.BigDecimal;
import java.util.List;

/**
 * Response DTO for payout preview totals.
 *
 * @param rawPayableMinutes total raw persisted worked minutes
 * @param payoutRoundedMinutes total backend-rounded payable minutes
 * @param exactCalculatedAmount total exact calculated salary
 * @param totalBaseAmount total base pay from persisted close calculations
 * @param totalPremiumAmount total premium pay from persisted close calculations
 * @param payoutAmount total whole-number payout amount
 * @param items selected attendance item previews
 */
public record PayoutRequestPreviewResponse(
		Integer rawPayableMinutes,
		Integer payoutRoundedMinutes,
		BigDecimal exactCalculatedAmount,
		@JsonSerialize(using = ScaleEightBigDecimalSerializer.class)
		BigDecimal totalBaseAmount,
		@JsonSerialize(using = ScaleEightBigDecimalSerializer.class)
		BigDecimal totalPremiumAmount,
		BigDecimal payoutAmount,
		List<PayoutRequestItemResponse> items
) {
}
