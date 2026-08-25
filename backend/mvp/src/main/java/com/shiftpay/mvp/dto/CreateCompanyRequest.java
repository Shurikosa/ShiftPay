package com.shiftpay.mvp.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

/**
 * Request DTO for foreman company onboarding.
 *
 * @param name company display name
 */
public record CreateCompanyRequest(
		@NotBlank
		@Size(max = 255)
		String name
) {
}
