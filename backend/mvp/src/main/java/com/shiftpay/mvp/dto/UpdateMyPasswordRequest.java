package com.shiftpay.mvp.dto;

import com.fasterxml.jackson.annotation.JsonAnySetter;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

public record UpdateMyPasswordRequest(
		@NotBlank @Size(max = 72) String currentPassword,
		@NotBlank @Size(min = 8, max = 72) String newPassword
) {
	@JsonAnySetter
	public void rejectUnknown(String name, Object value) {
		throw new IllegalArgumentException("Unrecognized field: " + name);
	}
}
