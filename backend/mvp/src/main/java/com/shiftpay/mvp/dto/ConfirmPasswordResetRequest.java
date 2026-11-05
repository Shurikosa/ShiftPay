package com.shiftpay.mvp.dto;

import com.fasterxml.jackson.annotation.JsonAnySetter;
import tools.jackson.databind.annotation.JsonDeserialize;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

import java.util.UUID;

public record ConfirmPasswordResetRequest(
		@NotNull UUID requestId,
		@JsonDeserialize(using = ResetCodeDeserializer.class) String code,
		@JsonDeserialize(using = StrictPasswordDeserializer.class)
		@NotBlank @Size(min = 8, max = 72) String newPassword
) {
	@JsonAnySetter
	public void rejectUnknown(String name, Object ignored) {
		throw new IllegalArgumentException("Unknown request property");
	}
}
