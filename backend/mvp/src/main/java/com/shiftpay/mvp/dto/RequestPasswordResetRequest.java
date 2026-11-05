package com.shiftpay.mvp.dto;

import com.fasterxml.jackson.annotation.JsonAnySetter;
import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

public record RequestPasswordResetRequest(@NotBlank @Email @Size(max = 255) String email) {
	public RequestPasswordResetRequest {
		if (email != null) email = email.trim();
	}

	@JsonAnySetter
	public void rejectUnknown(String name, Object ignored) {
		throw new IllegalArgumentException("Unknown request property");
	}
}
