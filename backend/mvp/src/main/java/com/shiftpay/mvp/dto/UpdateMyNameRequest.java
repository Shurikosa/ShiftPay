package com.shiftpay.mvp.dto;

import com.fasterxml.jackson.annotation.JsonAnySetter;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

public record UpdateMyNameRequest(
		@NotBlank @Size(max = 100) String firstName,
		@NotBlank @Size(max = 100) String lastName
) {
	@JsonAnySetter
	public void rejectUnknown(String name, Object value) {
		throw new IllegalArgumentException("Unrecognized field: " + name);
	}
}
