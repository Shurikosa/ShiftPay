package com.shiftpay.mvp.dto;

import java.math.BigDecimal;

/**
 * Backend payroll rounding result for one attendance row.
 *
 * @param rawPayableMinutes persisted worked minutes
 * @param payoutRoundedMinutes minutes rounded upward to a 15-minute boundary
 * @param roundedItemAmountExact exact rounded-minute amount before whole-money rounding
 * @param payoutAmount whole-number money amount rounded with CEILING
 */
public record PayrollRoundingResult(
		Integer rawPayableMinutes,
		Integer payoutRoundedMinutes,
		BigDecimal roundedItemAmountExact,
		BigDecimal payoutAmount
) {
}
