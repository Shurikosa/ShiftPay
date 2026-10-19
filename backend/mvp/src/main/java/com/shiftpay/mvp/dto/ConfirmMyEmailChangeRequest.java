package com.shiftpay.mvp.dto;

import com.fasterxml.jackson.annotation.JsonAnySetter;
import io.swagger.v3.oas.annotations.media.Schema;

public record ConfirmMyEmailChangeRequest(
		@Schema(requiredMode = Schema.RequiredMode.REQUIRED, pattern = "[0-9]{6}") String code
) {
	@JsonAnySetter
	public void rejectUnknown(String name, Object value) {
		throw new IllegalArgumentException("Unrecognized field: " + name);
	}
}
