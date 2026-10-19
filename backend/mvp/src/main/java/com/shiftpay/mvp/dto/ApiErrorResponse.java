package com.shiftpay.mvp.dto;

import com.fasterxml.jackson.annotation.JsonInclude;
import io.swagger.v3.oas.annotations.media.Schema;

import java.time.Instant;

public record ApiErrorResponse(
		@Schema(requiredMode = Schema.RequiredMode.REQUIRED) 
		Instant timestamp,
		@Schema(requiredMode = Schema.RequiredMode.REQUIRED)
		int status,
		@Schema(requiredMode = Schema.RequiredMode.REQUIRED)
		String error,
		@Schema(requiredMode = Schema.RequiredMode.REQUIRED)
		String message,
		@Schema(requiredMode = Schema.RequiredMode.REQUIRED)
		String path,
		@Schema(description = "Stable error code for credential and email-change failures", allowableValues = {
				"CURRENT_PASSWORD_INCORRECT", "CURRENT_PASSWORD_RATE_LIMITED", "EMAIL_UNCHANGED",
				"EMAIL_ALREADY_IN_USE", "EMAIL_CHANGE_ALREADY_PENDING", "EMAIL_CHANGE_RATE_LIMITED",
				"EMAIL_DELIVERY_UNAVAILABLE", "INVALID_EMAIL_VERIFICATION_CODE",
				"EMAIL_VERIFICATION_ATTEMPTS_EXHAUSTED", "EMAIL_VERIFICATION_CODE_EXPIRED",
				"EMAIL_CHANGE_EXPIRED", "EMAIL_VERIFICATION_RESENDS_EXHAUSTED",
				"CREDENTIAL_VERSION_CONFLICT", "SESSION_REVOKED", "PASSWORD_UNCHANGED"
		})
		String code,
		@JsonInclude(JsonInclude.Include.NON_NULL)
		@Schema(description = "Attempts left; present for invalid-code and exhausted-attempt responses", minimum = "0", maximum = "4")
		Integer attemptsRemaining
) { }
