package com.shiftpay.mvp.dto;

import com.shiftpay.mvp.entity.AttendanceStatus;
import com.shiftpay.mvp.entity.ShiftAttendance;

import java.math.BigDecimal;
import java.time.OffsetDateTime;

public record AttendanceResponse(
		Long attendanceId,
		Long workerId,
		String firstName,
		String lastName,
		AttendanceStatus status,
		BigDecimal hourlyRate,
		Integer breakMinutes,
		Integer workedMinutes,
		BigDecimal calculatedSalary,
		OffsetDateTime joinedAt,
		OffsetDateTime approvedAt
) {

	public static AttendanceResponse from(ShiftAttendance attendance) {
		return new AttendanceResponse(
				attendance.getId(),
				attendance.getWorker().getId(),
				attendance.getWorker().getFirstName(),
				attendance.getWorker().getLastName(),
				attendance.getStatus(),
				attendance.getHourlyRate(),
				attendance.getBreakMinutes(),
				attendance.getWorkedMinutes(),
				attendance.getCalculatedSalary(),
				attendance.getJoinedAt(),
				attendance.getApprovedAt()
		);
	}
}
