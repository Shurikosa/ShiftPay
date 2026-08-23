package com.shiftpay.mvp.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

/**
 * Request DTO for joining a company by backend-generated code.
 *
 * @param joinCode required company join code; the service trims and uppercases it before lookup
 */
public record JoinCompanyRequest(
		@NotBlank
		@Size(max = 32)
		String joinCode
) {
}
