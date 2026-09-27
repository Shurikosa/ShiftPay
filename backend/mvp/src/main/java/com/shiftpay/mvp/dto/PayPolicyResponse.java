package com.shiftpay.mvp.dto;

import com.shiftpay.mvp.entity.PayPolicyStackingStrategy;
import com.shiftpay.mvp.entity.PayPolicyVersion;

import java.time.DayOfWeek;
import java.time.Instant;
import java.util.List;

/**
 * Response DTO for a current or historical pay policy version.
 *
 * @param id policy version id
 * @param companyId owning company id
 * @param version immutable version number
 * @param active whether this version is current
 * @param timeZone company IANA timezone id
 * @param weekStartsOn first day of the policy week
 * @param stackingStrategy premium stacking behavior
 * @param rules rule snapshots for this version
 * @param createdAt version creation timestamp
 */
public record PayPolicyResponse(
		Long id,
		Long companyId,
		Integer version,
		boolean active,
		String timeZone,
		DayOfWeek weekStartsOn,
		PayPolicyStackingStrategy stackingStrategy,
		List<PayPolicyRuleResponse> rules,
		Instant createdAt
) {

	/**
	 * Maps a policy version and rule responses to the API response.
	 *
	 * @param policyVersion policy version entity
	 * @param active whether this version is current
	 * @param rules mapped rule responses
	 * @return pay policy response
	 */
	public static PayPolicyResponse from(
			PayPolicyVersion policyVersion,
			boolean active,
			List<PayPolicyRuleResponse> rules
	) {
		return new PayPolicyResponse(
				policyVersion.getId(),
				policyVersion.getCompany().getId(),
				policyVersion.getVersion(),
				active,
				policyVersion.getCompany().getTimeZone(),
				policyVersion.getWeekStartsOn(),
				policyVersion.getStackingStrategy(),
				rules,
				policyVersion.getCreatedAt()
		);
	}
}
