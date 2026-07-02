package com.shiftpay.mvp.dto;

import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

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
		Integer defaultBreakMinutes
) {
}
