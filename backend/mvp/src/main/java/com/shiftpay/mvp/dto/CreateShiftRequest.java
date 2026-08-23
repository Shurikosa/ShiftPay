package com.shiftpay.mvp.dto;

import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.Digits;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

import java.math.BigDecimal;

/**
 * Request DTO for creating a shift session.
 *
 * <p>Used by foremen. The default hourly rate is copied to worker attendance when workers join, while the
 * foreman hourly rate is stored on the shift for the owner foreman's private salary calculation.</p>
 *
 * @param location optional human-readable work location
 * @param defaultBreakMinutes optional non-negative break duration copied to joined attendance, defaults to zero
 * @param defaultHourlyRate required non-negative worker hourly rate with up to two decimal places
 * @param foremanHourlyRate required non-negative foreman hourly rate with up to two decimal places
 */
public record CreateShiftRequest(
		@Size(max = 255)
		String location,

		@Min(0)
		Integer defaultBreakMinutes,

		@NotNull
		@DecimalMin("0.00")
		@Digits(integer = 10, fraction = 2)
		BigDecimal defaultHourlyRate,

		@NotNull
		@DecimalMin("0.00")
		@Digits(integer = 10, fraction = 2)
		BigDecimal foremanHourlyRate
) {
}
