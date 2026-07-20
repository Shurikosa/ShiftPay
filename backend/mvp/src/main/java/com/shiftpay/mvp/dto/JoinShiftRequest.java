package com.shiftpay.mvp.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

/**
 * Request DTO for a worker joining a shift by code.
 *
 * <p>Workers never send hourly rate in this DTO. The service copies the shift default hourly rate to attendance.</p>
 *
 * @param joinCode required shift join code; the service trims and uppercases it before lookup
 */
public record JoinShiftRequest(
		@NotBlank
		@Size(max = 32)
		String joinCode
) {
}
