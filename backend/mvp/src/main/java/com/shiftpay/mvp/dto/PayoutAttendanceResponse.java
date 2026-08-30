package com.shiftpay.mvp.dto;

import com.shiftpay.mvp.entity.PaymentStatus;
import com.shiftpay.mvp.entity.ShiftAttendance;
import com.shiftpay.mvp.entity.ShiftSession;

import java.math.BigDecimal;
import java.time.OffsetDateTime;

/**
 * Response DTO for one payable attendance row available to a worker.
 *
 * @param attendanceId attendance id selectable by the worker
 * @param shiftId shift session id
 * @param companyId company id assigned to the shift
 * @param companyName company display name
 * @param title shift title
 * @param location optional shift location
 * @param actualStartTime actual shift start time
 * @param actualEndTime actual shift end time
 * @param paymentStatus current payment status, always UNPAID for payable listing
 * @param rawPayableMinutes persisted worked minutes from shift close
 * @param payoutRoundedMinutes backend-rounded payable minutes
 * @param hourlyRate attendance rate snapshot or override
 * @param calculatedSalary persisted exact salary from shift close
 * @param payoutAmount whole-number payout amount
 */
public record PayoutAttendanceResponse(
		Long attendanceId,
		Long shiftId,
		Long companyId,
		String companyName,
		String title,
		String location,
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
	 * Maps payable attendance and backend rounding to a worker payroll row.
	 *
	 * @param attendance payable attendance with shift and company fetched
	 * @param rounding payroll rounding result for this attendance
	 * @return payable attendance response
	 */
	public static PayoutAttendanceResponse from(
			ShiftAttendance attendance,
			PayrollRoundingResult rounding
	) {
		ShiftSession shiftSession = attendance.getShiftSession();
		return new PayoutAttendanceResponse(
				attendance.getId(),
				shiftSession.getId(),
				shiftSession.getCompany().getId(),
				shiftSession.getCompany().getName(),
				shiftSession.getTitle(),
				shiftSession.getLocation(),
				shiftSession.getActualStartTime(),
				shiftSession.getActualEndTime(),
				attendance.getPaymentStatus(),
				rounding.rawPayableMinutes(),
				rounding.payoutRoundedMinutes(),
				attendance.getHourlyRate(),
				attendance.getCalculatedSalary(),
				rounding.payoutAmount()
		);
	}
}
