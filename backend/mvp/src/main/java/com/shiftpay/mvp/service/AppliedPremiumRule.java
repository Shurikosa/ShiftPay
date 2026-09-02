package com.shiftpay.mvp.service;

import com.shiftpay.mvp.entity.PayPolicyRuleType;

import java.math.BigDecimal;

/**
 * Premium rule snapshot applied to one calculated pay segment.
 *
 * @param id persisted rule id when available
 * @param name rule name from the frozen policy version
 * @param type rule type
 * @param premiumPercent configured premium percentage
 */
public record AppliedPremiumRule(
		Long id,
		String name,
		PayPolicyRuleType type,
		BigDecimal premiumPercent
) {
}
