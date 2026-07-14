package com.shiftpay.mvp.dto;

import java.math.BigDecimal;

/**
 * Response DTO for one approved worker row in a closed shift summary.
 *
 * @param attendanceId attendance id included in the summary
 * @param workerId worker user id
 * @param firstName worker first name
 * @param lastName worker last name
 * @param workedMinutes persisted worked minutes for the attendance
 * @param hourlyRate attendance rate used for salary calculation
 * @param salary persisted calculated salary with scale two
 */
public record WorkerSummaryResponse(
		Long attendanceId,
		Long workerId,
		String firstName,
		String lastName,
		Integer workedMinutes,
		BigDecimal hourlyRate,
		BigDecimal salary
) {
}
