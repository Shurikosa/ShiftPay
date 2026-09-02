package com.shiftpay.mvp.dto;

import com.shiftpay.mvp.entity.PayPolicyStackingStrategy;
import jakarta.validation.Valid;
import jakarta.validation.constraints.NotNull;

import java.time.DayOfWeek;
import java.util.List;

/**
 * Request DTO for replacing the current company pay policy with a new immutable version.
 *
 * @param weekStartsOn first day of the policy week
 * @param stackingStrategy premium stacking behavior
 * @param rules rule snapshots for the new version
 */
public record PayPolicyUpdateRequest(
		@NotNull
		DayOfWeek weekStartsOn,

		@NotNull
		PayPolicyStackingStrategy stackingStrategy,

		@NotNull
		List<@Valid PayPolicyRuleRequest> rules
) {
}
