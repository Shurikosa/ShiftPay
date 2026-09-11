package com.shiftpay.mvp.dto;

import com.shiftpay.mvp.entity.PayCalculation;
import tools.jackson.databind.annotation.JsonSerialize;

import java.math.BigDecimal;
import java.util.Comparator;
import java.util.List;

/**
 * Public pay calculation snapshot response.
 *
 * @param snapshotStatus availability of all persisted segment rule snapshots
 * @param totalRawSeconds exact raw payable seconds
 * @param totalRawMinutesExact exact raw payable minutes
 * @param totalBaseAmount base pay total
 * @param totalPremiumAmount premium pay total
 * @param totalAmount base plus premium total
 * @param segments persisted pay segments
 */
public record PayCalculationResponse(
		SnapshotStatus snapshotStatus,
		BigDecimal totalRawSeconds,
		BigDecimal totalRawMinutesExact,
		@JsonSerialize(using = ScaleEightBigDecimalSerializer.class)
		BigDecimal totalBaseAmount,
		@JsonSerialize(using = ScaleEightBigDecimalSerializer.class)
		BigDecimal totalPremiumAmount,
		@JsonSerialize(using = ScaleEightBigDecimalSerializer.class)
		BigDecimal totalAmount,
		List<PaySegmentResponse> segments
) {

	/**
	 * Maps a persisted snapshot to the response DTO.
	 *
	 * @param calculation persisted calculation snapshot
	 * @return response DTO
	 */
	public static PayCalculationResponse from(PayCalculation calculation) {
		if (calculation == null) {
			return null;
		}
		List<PaySegmentResponse> segments = calculation.getSegments()
				.stream()
				.sorted(Comparator.comparing(com.shiftpay.mvp.entity.PaySegment::getStart)
						.thenComparing(com.shiftpay.mvp.entity.PaySegment::getId))
				.map(PaySegmentResponse::from)
				.toList();
		return new PayCalculationResponse(
				segments.stream().allMatch(segment -> segment.snapshotStatus() == SnapshotStatus.COMPLETE)
						? SnapshotStatus.COMPLETE
						: SnapshotStatus.UNAVAILABLE,
				calculation.getTotalRawSeconds(),
				calculation.getTotalRawMinutesExact(),
				calculation.getTotalBaseAmount(),
				calculation.getTotalPremiumAmount(),
				calculation.getTotalAmount(),
				segments
		);
	}
}
