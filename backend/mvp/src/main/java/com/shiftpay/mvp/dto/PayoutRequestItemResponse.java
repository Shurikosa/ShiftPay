package com.shiftpay.mvp.dto;

import com.shiftpay.mvp.entity.PaymentStatus;
import com.shiftpay.mvp.entity.PayoutRequestItem;
import com.shiftpay.mvp.entity.PayoutRequestStatus;

import java.math.BigDecimal;
import java.time.OffsetDateTime;

/**
 * Response DTO for one payout request item.
 *
 * @param attendanceId attendance id included in the request
 * @param shiftId shift session id
 * @param title snapshotted shift title
 * @param actualStartTime snapshotted shift start time
 * @param actualEndTime snapshotted shift end time
 * @param paymentStatus request-derived item payment status
 * @param rawPayableMinutes persisted worked minutes from shift close
 * @param payoutRoundedMinutes backend-rounded payable minutes
 * @param hourlyRate snapshotted attendance hourly rate
 * @param calculatedSalary snapshotted exact salary from shift close
 * @param payoutAmount whole-number payout amount
 */
public record PayoutRequestItemResponse(
		Long attendanceId,
		Long shiftId,
		String title,
		OffsetDateTime actualStartTime,
		OffsetDateTime actualEndTime,
		PaymentStatus paymentStatus,
		Integer rawPayableMinutes,
		Integer payoutRoundedMinutes,
		BigDecimal hourlyRate,
		BigDecimal calculatedSalary,
		BigDecimal payoutAmount
) {

	/**
	 * Maps a preview item calculation to the public item response.
	 *
	 * @param item preview item from the service
	 * @param paymentStatus payment status to expose for this operation
	 * @return payout request item response
	 */
	public static PayoutRequestItemResponse fromPreview(
			PayoutRequestPreviewItem item,
			PaymentStatus paymentStatus
	) {
		return new PayoutRequestItemResponse(
				item.attendance().getId(),
				item.attendance().getShiftSession().getId(),
				item.attendance().getShiftSession().getTitle(),
				item.attendance().getShiftSession().getActualStartTime(),
				item.attendance().getShiftSession().getActualEndTime(),
				paymentStatus,
				item.rounding().rawPayableMinutes(),
				item.rounding().payoutRoundedMinutes(),
				item.attendance().getHourlyRate(),
				item.attendance().getCalculatedSalary(),
				item.rounding().payoutAmount()
		);
	}

	/**
	 * Maps a persisted item snapshot to the public item response.
	 *
	 * @param item persisted item snapshot
	 * @param requestStatus parent request status
	 * @return payout request item response
	 */
	public static PayoutRequestItemResponse from(PayoutRequestItem item, PayoutRequestStatus requestStatus) {
		return new PayoutRequestItemResponse(
				item.getAttendance().getId(),
				item.getShiftSession().getId(),
				item.getShiftTitle(),
				item.getShiftActualStartTime(),
				item.getShiftActualEndTime(),
				paymentStatusFor(item, requestStatus),
				item.getRawPayableMinutes(),
				item.getPayoutRoundedMinutes(),
				item.getHourlyRate(),
				item.getCalculatedSalary(),
				item.getPayoutAmount()
		);
	}

	private static PaymentStatus paymentStatusFor(PayoutRequestItem item, PayoutRequestStatus requestStatus) {
		if (requestStatus == PayoutRequestStatus.APPROVED || item.getPaidAt() != null) {
			return PaymentStatus.PAID;
		}
		return PaymentStatus.PAYMENT_REQUESTED;
	}
}
