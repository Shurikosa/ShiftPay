package com.shiftpay.mvp.dto;

import com.shiftpay.mvp.entity.PayPolicyRule;
import com.shiftpay.mvp.entity.PayPolicyRuleType;

import java.math.BigDecimal;

/**
 * Response DTO for one immutable pay policy rule.
 *
 * @param id rule id
 * @param name rule name
 * @param type MVP rule type
 * @param enabled whether this rule is active
 * @param premiumPercent percentage premium
 * @param condition structured rule condition config
 */
public record PayPolicyRuleResponse(
		Long id,
		String name,
		PayPolicyRuleType type,
		boolean enabled,
		BigDecimal premiumPercent,
		PayPolicyRuleCondition condition
) {

	/**
	 * Maps a persisted rule snapshot to the API response.
	 *
	 * @param rule persisted rule snapshot
	 * @param condition structured condition parsed from JSON
	 * @return rule response
	 */
	public static PayPolicyRuleResponse from(PayPolicyRule rule, PayPolicyRuleCondition condition) {
		return new PayPolicyRuleResponse(
				rule.getId(),
				rule.getName(),
				rule.getType(),
				rule.isEnabled(),
				rule.getPremiumPercent(),
				condition
		);
	}
}
