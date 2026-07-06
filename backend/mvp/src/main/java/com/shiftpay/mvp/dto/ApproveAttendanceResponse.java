package com.shiftpay.mvp.dto;

import com.shiftpay.mvp.entity.AttendanceStatus;
import com.shiftpay.mvp.entity.ShiftAttendance;

import java.math.BigDecimal;
import java.time.OffsetDateTime;

public record ApproveAttendanceResponse(
		Long attendanceId,
		AttendanceStatus status,
		BigDecimal hourlyRate,
		OffsetDateTime approvedAt
) {

	public static ApproveAttendanceResponse from(ShiftAttendance attendance) {
		return new ApproveAttendanceResponse(
				attendance.getId(),
				attendance.getStatus(),
				attendance.getHourlyRate(),
				attendance.getApprovedAt()
		);
	}
}
