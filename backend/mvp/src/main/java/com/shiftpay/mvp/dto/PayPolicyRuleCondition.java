package com.shiftpay.mvp.dto;

import java.time.DayOfWeek;
import java.time.LocalDate;
import java.time.LocalTime;
import java.util.List;

/**
 * Structured condition config for MVP pay policy rules.
 *
 * @param startTime local start time for TIME_OF_DAY
 * @param endTime local end time for TIME_OF_DAY
 * @param thresholdMinutes overtime threshold for DAILY_OVERTIME and WEEKLY_OVERTIME
 * @param weekdays weekday set for DAY_OF_WEEK
 * @param dates manual company holiday dates for HOLIDAY
 */
public record PayPolicyRuleCondition(
		LocalTime startTime,
		LocalTime endTime,
		Integer thresholdMinutes,
		List<DayOfWeek> weekdays,
		List<HolidayDateCondition> dates
) {
}
