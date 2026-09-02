package com.shiftpay.mvp.dto;

import com.shiftpay.mvp.entity.PayPolicyStackingStrategy;
import com.shiftpay.mvp.entity.PayPolicyVersion;

import java.time.DayOfWeek;
import java.time.Instant;

/**
 * Response DTO for pay policy version audit lists.
 *
 * @param id policy version id
 * @param companyId owning company id
 * @param version immutable version number
 * @param active whether this version is current
 * @param timeZone company IANA timezone id
 * @param weekStartsOn first day of the policy week
 * @param stackingStrategy premium stacking behavior
 * @param ruleCount number of rule snapshots in this version
 * @param createdAt version creation timestamp
 */
public record PayPolicyVersionSummaryResponse(
		Long id,
		Long companyId,
		Integer version,
		boolean active,
		String timeZone,
		DayOfWeek weekStartsOn,
		PayPolicyStackingStrategy stackingStrategy,
		int ruleCount,
		Instant createdAt
) {

	/**
	 * Maps a policy version to an audit summary DTO.
	 *
	 * @param policyVersion policy version entity
	 * @param active whether this version is current
	 * @return version summary response
	 */
	public static PayPolicyVersionSummaryResponse from(PayPolicyVersion policyVersion, boolean active) {
		return new PayPolicyVersionSummaryResponse(
				policyVersion.getId(),
				policyVersion.getCompany().getId(),
				policyVersion.getVersion(),
				active,
				policyVersion.getCompany().getTimeZone(),
				policyVersion.getWeekStartsOn(),
				policyVersion.getStackingStrategy(),
				policyVersion.getRules().size(),
				policyVersion.getCreatedAt()
		);
	}
}
