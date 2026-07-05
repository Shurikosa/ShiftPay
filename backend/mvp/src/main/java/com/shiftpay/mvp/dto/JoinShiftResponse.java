package com.shiftpay.mvp.dto;

import com.shiftpay.mvp.entity.AttendanceStatus;
import com.shiftpay.mvp.entity.ShiftAttendance;

import java.math.BigDecimal;

public record JoinShiftResponse(
		Long attendanceId,
		Long shiftId,
		Long workerId,
		AttendanceStatus status,
		BigDecimal hourlyRate
) {

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
