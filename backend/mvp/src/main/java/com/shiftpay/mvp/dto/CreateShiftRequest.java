package com.shiftpay.mvp.dto;

import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.Digits;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

import java.math.BigDecimal;
import java.time.LocalDateTime;

/**
 * Request DTO for creating a shift session.
 *
 * <p>Used by foremen and admins. The default hourly rate becomes the shift-level rate copied to worker attendance
 * when workers join.</p>
 *
 * @param title required shift title shown to foremen and workers
 * @param location optional human-readable work location
 * @param plannedStartTime optional planned start time interpreted as UTC by the service
 * @param plannedEndTime optional planned end time interpreted as UTC by the service
 * @param defaultBreakMinutes optional non-negative break duration copied to joined attendance, defaults to zero
 * @param defaultHourlyRate required non-negative shift hourly rate with up to two decimal places
 */
public record CreateShiftRequest(
		@NotBlank
		@Size(max = 255)
		String title,

		@Size(max = 255)
		String location,

		LocalDateTime plannedStartTime,

		LocalDateTime plannedEndTime,

		@Min(0)
		Integer defaultBreakMinutes,

		@NotNull
		@DecimalMin("0.00")
		@Digits(integer = 10, fraction = 2)
		BigDecimal defaultHourlyRate
) {
}
