package com.shiftpay.mvp.dto;

import com.shiftpay.mvp.entity.PayPolicyRuleType;

import java.math.BigDecimal;

/**
 * Public snapshot of a premium rule applied to one pay segment.
 *
 * @param id persisted rule id at calculation time
 * @param name rule name at calculation time
 * @param type rule type
 * @param premiumPercent configured premium percent at calculation time
 */
public record AppliedPremiumRuleResponse(
		Long id,
		String name,
		PayPolicyRuleType type,
		BigDecimal premiumPercent
) {
}
