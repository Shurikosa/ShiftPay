package com.shiftpay.mvp.dto;

import com.shiftpay.mvp.entity.AttendanceStatus;
import com.shiftpay.mvp.entity.ShiftAttendance;
import com.shiftpay.mvp.entity.ShiftSession;
import com.shiftpay.mvp.entity.ShiftStatus;

import java.math.BigDecimal;
import java.time.OffsetDateTime;

public record MyShiftHistoryResponse(
		Long shiftId,
		Long attendanceId,
		String title,
		String location,
		ShiftStatus status,
		OffsetDateTime plannedStartTime,
		OffsetDateTime plannedEndTime,
		OffsetDateTime actualStartTime,
		OffsetDateTime actualEndTime,
		AttendanceStatus attendanceStatus,
		BigDecimal hourlyRate,
		Integer breakMinutes,
		Integer workedMinutes,
		BigDecimal calculatedSalary
) {

	public static MyShiftHistoryResponse from(ShiftAttendance attendance) {
		ShiftSession shiftSession = attendance.getShiftSession();
		return new MyShiftHistoryResponse(
				shiftSession.getId(),
				attendance.getId(),
				shiftSession.getTitle(),
				shiftSession.getLocation(),
				shiftSession.getStatus(),
				shiftSession.getPlannedStartTime(),
				shiftSession.getPlannedEndTime(),
				shiftSession.getActualStartTime(),
				shiftSession.getActualEndTime(),
				attendance.getStatus(),
				attendance.getHourlyRate(),
				attendance.getBreakMinutes(),
				attendance.getWorkedMinutes(),
				attendance.getCalculatedSalary()
		);
	}
}
