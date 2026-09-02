package com.shiftpay.mvp.dto;

import java.time.LocalDate;

/**
 * Manual company holiday condition entry.
 *
 * @param date local holiday date in company timezone
 * @param label optional display label for the holiday
 */
public record HolidayDateCondition(
		LocalDate date,
		String label
) {
}
