package com.shiftpay.mvp.dto;

import com.shiftpay.mvp.entity.AttendanceStatus;
import com.shiftpay.mvp.entity.PaymentStatus;
import com.shiftpay.mvp.entity.ShiftAttendance;
import com.shiftpay.mvp.entity.ShiftSession;
import com.shiftpay.mvp.entity.ShiftStatus;

import java.math.BigDecimal;
import java.time.OffsetDateTime;

/**
 * Response DTO for the authenticated user's personal shift history.
 *
 * <p>Used by {@code GET /api/v1/me/shifts}. It combines shift fields and the current user's attendance fields while
 * avoiding user entities, email addresses, and password data.</p>
 *
 * @param shiftId shift session id
 * @param attendanceId attendance id belonging to the current user
 * @param companyId company assigned to the shift
 * @param companyName company display name assigned to the shift
 * @param title shift title
 * @param location optional shift location
 * @param status current shift status
 * @param actualStartTime actual shift start time in UTC, if started
 * @param actualEndTime actual shift end time in UTC, if closed
 * @param attendanceStatus current attendance status for the user
 * @param paymentStatus current payroll payment status for the attendance
 * @param hourlyRate attendance rate snapshot or override
 * @param breakMinutes break minutes stored on attendance
 * @param payableStartTime effective worker payable start time, or null before it is known
 * @param pauseMinutes persisted pause minutes deducted after close, or null before salary calculation
 * @param workedMinutes persisted worked minutes after close, or null
 * @param calculatedSalary persisted salary after close, or null
 * @param pauseState pause state for the current user's attendance
 */
public record MyShiftHistoryResponse(
		Long shiftId,
		Long attendanceId,
		Long companyId,
		String companyName,
		String title,
		String location,
		ShiftStatus status,
		OffsetDateTime actualStartTime,
		OffsetDateTime actualEndTime,
		AttendanceStatus attendanceStatus,
		PaymentStatus paymentStatus,
		BigDecimal hourlyRate,
		Integer breakMinutes,
		OffsetDateTime payableStartTime,
		Integer pauseMinutes,
		Integer workedMinutes,
		BigDecimal calculatedSalary,
		PauseStateResponse pauseState
) {

	/**
	 * Maps attendance with its shift already fetched to the personal history response.
	 *
	 * @param attendance attendance entity for the current user
	 * @return personal shift history response DTO
	 */
	public static MyShiftHistoryResponse from(ShiftAttendance attendance) {
		return from(attendance, PauseStateResponse.none(), null);
	}

	/**
	 * Maps attendance with its shift and pause state to the personal history response.
	 *
	 * @param attendance attendance entity for the current user
	 * @param pauseState pause state for the current user's attendance
	 * @return personal shift history response DTO
	 */
	public static MyShiftHistoryResponse from(ShiftAttendance attendance, PauseStateResponse pauseState) {
		return from(attendance, pauseState, null);
	}

	/**
	 * Maps attendance with its shift, pause state, and effective payable start to the personal history response.
	 *
	 * @param attendance attendance entity for the current user
	 * @param pauseState pause state for the current user's attendance
	 * @param payableStartTime effective worker payable start time
	 * @return personal shift history response DTO
	 */
	public static MyShiftHistoryResponse from(
			ShiftAttendance attendance,
			PauseStateResponse pauseState,
			OffsetDateTime payableStartTime
	) {
		ShiftSession shiftSession = attendance.getShiftSession();
		return new MyShiftHistoryResponse(
				shiftSession.getId(),
				attendance.getId(),
				shiftSession.getCompany().getId(),
				shiftSession.getCompany().getName(),
				shiftSession.getTitle(),
				shiftSession.getLocation(),
				shiftSession.getStatus(),
				shiftSession.getActualStartTime(),
				shiftSession.getActualEndTime(),
				attendance.getStatus(),
				attendance.getPaymentStatus(),
				attendance.getHourlyRate(),
				attendance.getBreakMinutes(),
				payableStartTime,
				attendance.getPauseMinutes(),
				attendance.getWorkedMinutes(),
				attendance.getCalculatedSalary(),
				pauseState
		);
	}
}
