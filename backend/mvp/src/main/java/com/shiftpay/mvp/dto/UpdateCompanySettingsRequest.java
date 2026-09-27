package com.shiftpay.mvp.dto;

import io.swagger.v3.oas.annotations.media.Schema;
import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.Digits;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

import java.math.BigDecimal;

/** Complete FOREMAN-only update of mutable company settings. */
public record UpdateCompanySettingsRequest(
		@NotBlank @Size(max = 255) String name,
		@Schema(requiredMode = Schema.RequiredMode.REQUIRED)
		String currencyLabel,
		@DecimalMin("0.00") @Digits(integer = 10, fraction = 2) BigDecimal defaultWorkerHourlyRate,
		@DecimalMin("0.00") @Digits(integer = 10, fraction = 2) BigDecimal defaultForemanHourlyRate
) { }
