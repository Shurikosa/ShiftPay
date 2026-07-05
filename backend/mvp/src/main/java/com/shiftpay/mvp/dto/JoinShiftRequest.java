package com.shiftpay.mvp.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

public record JoinShiftRequest(
		@NotBlank
		@Size(max = 32)
		String joinCode
) {
}
