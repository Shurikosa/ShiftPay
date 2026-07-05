package com.shiftpay.mvp.dto;

import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.Digits;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

import java.math.BigDecimal;
import java.time.LocalDateTime;

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
