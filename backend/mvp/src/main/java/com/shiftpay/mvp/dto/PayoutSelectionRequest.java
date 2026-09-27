package com.shiftpay.mvp.dto;

import jakarta.validation.constraints.NotEmpty;

import java.util.List;

/**
 * Request DTO for selecting attendance rows in a payout request.
 *
 * @param attendanceIds explicit attendance ids selected by the worker
 */
public record PayoutSelectionRequest(
		@NotEmpty
		List<Long> attendanceIds
) {
}
