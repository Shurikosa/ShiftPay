package com.shiftpay.mvp.dto;

import com.shiftpay.mvp.entity.AttendanceStatus;
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
 * @param hourlyRate attendance rate snapshot or override
 * @param breakMinutes break minutes stored on attendance
 * @param workedMinutes persisted worked minutes after close, or null
 * @param calculatedSalary persisted salary after close, or null
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
		BigDecimal hourlyRate,
		Integer breakMinutes,
		Integer workedMinutes,
		BigDecimal calculatedSalary
) {

	/**
	 * Maps attendance with its shift already fetched to the personal history response.
	 *
	 * @param attendance attendance entity for the current user
	 * @return personal shift history response DTO
	 */
	public static MyShiftHistoryResponse from(ShiftAttendance attendance) {
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
				attendance.getHourlyRate(),
				attendance.getBreakMinutes(),
				attendance.getWorkedMinutes(),
				attendance.getCalculatedSalary()
		);
	}
}
