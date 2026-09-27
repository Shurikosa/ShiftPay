package com.shiftpay.mvp.dto;

import com.shiftpay.mvp.entity.PayPolicyRuleType;
import jakarta.validation.Valid;
import jakarta.validation.constraints.DecimalMax;
import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

import java.math.BigDecimal;

/**
 * Request DTO for one pay policy rule.
 *
 * @param name human-readable rule name
 * @param type MVP rule type
 * @param enabled whether this rule is active
 * @param premiumPercent percentage premium, 0.0000..1000.0000 inclusive
 * @param condition structured rule condition config
 */
public record PayPolicyRuleRequest(
		@NotBlank
		@Size(max = 255)
		String name,

		@NotNull
		PayPolicyRuleType type,

		@NotNull
		Boolean enabled,

		@NotNull
		@DecimalMin("0.0000")
		@DecimalMax("1000.0000")
		BigDecimal premiumPercent,

		@NotNull
		@Valid
		PayPolicyRuleCondition condition
) {
}
