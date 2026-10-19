package com.shiftpay.mvp.dto;

import com.fasterxml.jackson.annotation.JsonAnySetter;
import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

public record StartMyEmailChangeRequest(
		@NotBlank @Size(max = 72) String currentPassword,
		@NotBlank @Email @Size(max = 255) String newEmail
) {
	@JsonAnySetter
	public void rejectUnknown(String name, Object value) {
		throw new IllegalArgumentException("Unrecognized field: " + name);
	}
}
