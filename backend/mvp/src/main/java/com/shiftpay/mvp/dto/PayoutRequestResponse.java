package com.shiftpay.mvp.dto;

import com.shiftpay.mvp.entity.PayoutRequest;
import com.shiftpay.mvp.entity.PayoutRequestStatus;

import java.math.BigDecimal;
import java.time.OffsetDateTime;
import java.util.List;

/**
 * Response DTO for persisted payout requests.
 *
 * @param id payout request id
 * @param companyId company id assigned to the request
 * @param companyName company display name
 * @param workerId worker id
 * @param workerFirstName worker first name
 * @param workerLastName worker last name
 * @param status request approval status
 * @param rawPayableMinutes total raw persisted worked minutes
 * @param payoutRoundedMinutes total backend-rounded payable minutes
 * @param exactCalculatedAmount total exact calculated salary
 * @param payoutAmount total whole-number payout amount
 * @param requestedAt backend request creation timestamp
 * @param approvedAt backend approval timestamp, or null
 * @param paidAt backend payment-completion timestamp, or null
 * @param items selected attendance item snapshots
 */
public record PayoutRequestResponse(
		Long id,
		Long companyId,
		String companyName,
		Long workerId,
		String workerFirstName,
		String workerLastName,
		PayoutRequestStatus status,
		Integer rawPayableMinutes,
		Integer payoutRoundedMinutes,
		BigDecimal exactCalculatedAmount,
		BigDecimal payoutAmount,
		OffsetDateTime requestedAt,
		OffsetDateTime approvedAt,
		OffsetDateTime paidAt,
		List<PayoutRequestItemResponse> items
) {

	/**
	 * Maps a payout request and its loaded items to the public response.
	 *
	 * @param request payout request header
	 * @param items item response DTOs
	 * @return payout request response
	 */
	public static PayoutRequestResponse from(PayoutRequest request, List<PayoutRequestItemResponse> items) {
		return new PayoutRequestResponse(
				request.getId(),
				request.getCompany().getId(),
				request.getCompany().getName(),
				request.getWorker().getId(),
				request.getWorker().getFirstName(),
				request.getWorker().getLastName(),
				request.getStatus(),
				request.getRawPayableMinutesTotal(),
				request.getPayoutRoundedMinutesTotal(),
				request.getExactCalculatedAmountTotal(),
				request.getPayoutAmount(),
				request.getRequestedAt(),
				request.getApprovedAt(),
				request.getPaidAt(),
				items
		);
	}
}
