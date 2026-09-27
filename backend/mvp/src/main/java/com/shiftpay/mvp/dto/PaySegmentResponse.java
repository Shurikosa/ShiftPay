package com.shiftpay.mvp.dto;

import com.shiftpay.mvp.entity.PaySegment;
import com.shiftpay.mvp.entity.PayPolicyStackingStrategy;
import com.shiftpay.mvp.service.AppliedPremiumRulesJson;
import tools.jackson.databind.annotation.JsonSerialize;

import java.math.BigDecimal;
import java.time.OffsetDateTime;
import java.util.List;

/**
 * Public pay segment snapshot response.
 *
 * @param start segment start
 * @param end segment end
 * @param payableSeconds exact payable seconds
 * @param payableMinutes whole payable minutes
 * @param payableMinutesExact exact payable minutes
 * @param baseHourlyRate base hourly rate
 * @param snapshotStatus availability of the persisted applied-rule snapshot
 * @param appliedRules applied rule snapshots
 * @param stackingStrategy policy stacking strategy
 * @param effectivePremiumPercent effective premium percent
 * @param effectiveHourlyRate effective hourly rate
 * @param baseAmount segment base amount
 * @param premiumAmount segment premium amount
 * @param totalAmount segment base plus premium amount
 */
public record PaySegmentResponse(
		OffsetDateTime start,
		OffsetDateTime end,
		BigDecimal payableSeconds,
		Long payableMinutes,
		BigDecimal payableMinutesExact,
		BigDecimal baseHourlyRate,
		SnapshotStatus snapshotStatus,
		List<AppliedPremiumRuleResponse> appliedRules,
		PayPolicyStackingStrategy stackingStrategy,
		BigDecimal effectivePremiumPercent,
		BigDecimal effectiveHourlyRate,
		@JsonSerialize(using = ScaleEightBigDecimalSerializer.class)
		BigDecimal baseAmount,
		@JsonSerialize(using = ScaleEightBigDecimalSerializer.class)
		BigDecimal premiumAmount,
		@JsonSerialize(using = ScaleEightBigDecimalSerializer.class)
		BigDecimal totalAmount
) {

	/**
	 * Maps a persisted segment snapshot to the response DTO.
	 *
	 * @param segment persisted segment
	 * @return response DTO
	 */
	public static PaySegmentResponse from(PaySegment segment) {
		AppliedPremiumRulesJson.ReadResult appliedRules = AppliedPremiumRulesJson.read(
				segment.getAppliedRulesSnapshot(),
				segment.getId()
		);
		return new PaySegmentResponse(
				segment.getStart(),
				segment.getEnd(),
				segment.getPayableSeconds(),
				segment.getPayableMinutes(),
				segment.getPayableMinutesExact(),
				segment.getBaseHourlyRate(),
				appliedRules.snapshotStatus(),
				appliedRules.appliedRules(),
				segment.getStackingStrategy(),
				segment.getEffectivePremiumPercent(),
				segment.getEffectiveHourlyRate(),
				segment.getBaseAmount(),
				segment.getPremiumAmount(),
				segment.getTotalAmount()
		);
	}
}
