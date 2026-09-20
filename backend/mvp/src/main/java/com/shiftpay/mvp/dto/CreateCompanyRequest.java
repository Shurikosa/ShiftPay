package com.shiftpay.mvp.dto;

import io.swagger.v3.oas.annotations.media.Schema;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.Digits;
import jakarta.validation.constraints.Size;

import java.math.BigDecimal;

/**
 * Request DTO for foreman company onboarding.
 *
 * @param name company display name
	 * @param currencyLabel required opaque currency display label
	 * @param defaultWorkerHourlyRate optional default worker rate for new shifts
	 * @param defaultForemanHourlyRate optional default foreman rate for new shifts
	 * @param timeZone optional IANA timezone id, defaults to backend configuration
 */
public record CreateCompanyRequest(
		@NotBlank
		@Size(max = 255)
		String name,

		@Schema(requiredMode = Schema.RequiredMode.REQUIRED)
		String currencyLabel,

		@DecimalMin("0.00")
		@Digits(integer = 10, fraction = 2)
		BigDecimal defaultWorkerHourlyRate,

		@DecimalMin("0.00")
		@Digits(integer = 10, fraction = 2)
		BigDecimal defaultForemanHourlyRate,

		@Size(max = 64)
		String timeZone
) {
}
