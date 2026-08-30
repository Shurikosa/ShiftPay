package com.shiftpay.mvp.dto;

import java.math.BigDecimal;
import java.util.List;

/**
 * Response DTO for payout preview totals.
 *
 * @param rawPayableMinutes total raw persisted worked minutes
 * @param payoutRoundedMinutes total backend-rounded payable minutes
 * @param exactCalculatedAmount total exact calculated salary
 * @param payoutAmount total whole-number payout amount
 * @param items selected attendance item previews
 */
public record PayoutRequestPreviewResponse(
		Integer rawPayableMinutes,
		Integer payoutRoundedMinutes,
		BigDecimal exactCalculatedAmount,
		BigDecimal payoutAmount,
		List<PayoutRequestItemResponse> items
) {
}
