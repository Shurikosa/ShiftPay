package com.shiftpay.mvp.dto;

import com.shiftpay.mvp.entity.AttendanceStatus;
import com.shiftpay.mvp.entity.ShiftAttendance;

import java.math.BigDecimal;

/**
 * Response DTO returned after a worker joins a shift.
 *
 * @param attendanceId created attendance id
 * @param shiftId shift session id joined by the worker
 * @param workerId worker user id
 * @param status initial attendance status, normally {@code JOINED}
 * @param hourlyRate rate snapshot copied from the shift default hourly rate
 */
public record JoinShiftResponse(
		Long attendanceId,
		Long shiftId,
		Long workerId,
		AttendanceStatus status,
		BigDecimal hourlyRate
) {

	/**
	 * Maps a newly created attendance entity to the join response.
	 *
	 * @param attendance saved attendance entity
	 * @return join response DTO
	 */
	public static JoinShiftResponse from(ShiftAttendance attendance) {
		return new JoinShiftResponse(
				attendance.getId(),
				attendance.getShiftSession().getId(),
				attendance.getWorker().getId(),
				attendance.getStatus(),
				attendance.getHourlyRate()
		);
	}
}
