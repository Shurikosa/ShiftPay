package com.shiftpay.mvp.dto;

import com.shiftpay.mvp.entity.AttendanceStatus;
import com.shiftpay.mvp.entity.ShiftAttendance;

import java.math.BigDecimal;
import java.time.OffsetDateTime;

/**
 * Response DTO returned after a foreman or admin approves attendance.
 *
 * @param attendanceId approved attendance id
 * @param status resulting attendance status, normally {@code APPROVED}
 * @param hourlyRate hourly rate stored on this attendance after any override
 * @param approvedAt UTC timestamp when the backend approved the attendance
 */
public record ApproveAttendanceResponse(
		Long attendanceId,
		AttendanceStatus status,
		BigDecimal hourlyRate,
		OffsetDateTime approvedAt
) {

	/**
	 * Maps an approved attendance entity to its public response DTO.
	 *
	 * @param attendance approved attendance entity
	 * @return approval response without exposing the worker entity
	 */
	public static ApproveAttendanceResponse from(ShiftAttendance attendance) {
		return new ApproveAttendanceResponse(
				attendance.getId(),
				attendance.getStatus(),
				attendance.getHourlyRate(),
				attendance.getApprovedAt()
		);
	}
}
