package com.shiftpay.mvp.dto;

import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.Digits;

import java.math.BigDecimal;

/**
 * Request DTO for approving worker attendance.
 *
 * <p>The request body is optional. When {@code hourlyRate} is absent, the attendance keeps the rate snapshot copied
 * when the worker joined. When present, the rate overrides only this attendance record.</p>
 *
 * @param hourlyRate optional non-negative attendance-specific hourly rate override with up to two decimal places
 */
public record ApproveAttendanceRequest(
		@DecimalMin("0.00")
		@Digits(integer = 10, fraction = 2)
		BigDecimal hourlyRate
) {
}
