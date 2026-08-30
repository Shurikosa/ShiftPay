package com.shiftpay.mvp.dto;

import com.shiftpay.mvp.entity.AttendanceStatus;
import com.shiftpay.mvp.entity.PaymentStatus;
import com.shiftpay.mvp.entity.ShiftAttendance;

import java.math.BigDecimal;
import java.time.OffsetDateTime;

/**
 * Response DTO for listing attendance on a shift.
 *
 * <p>Used by foremen and admins to review joined workers, approval state, attendance rate, break minutes, and any
 * close-time salary fields. It includes worker identity fields but never exposes {@code User} or password data.</p>
 *
 * @param attendanceId attendance id
 * @param workerId worker user id
 * @param firstName worker first name
 * @param lastName worker last name
 * @param status current attendance status
 * @param paymentStatus current payroll payment status
 * @param hourlyRate rate snapshot or approval override used for salary calculation
 * @param breakMinutes break minutes deducted from this attendance
 * @param payableStartTime effective worker payable start time, or null before it is known
 * @param pauseMinutes persisted pause minutes deducted after close, or null before salary calculation
 * @param workedMinutes persisted worked minutes after close, or null before salary calculation
 * @param calculatedSalary persisted salary after close, or null before salary calculation
 * @param pauseState pause state for this attendance worker
 * @param joinedAt UTC timestamp when the worker joined
 * @param approvedAt UTC timestamp when attendance was approved, or null
 */
public record AttendanceResponse(
		Long attendanceId,
		Long workerId,
		String firstName,
		String lastName,
		AttendanceStatus status,
		PaymentStatus paymentStatus,
		BigDecimal hourlyRate,
		Integer breakMinutes,
		OffsetDateTime payableStartTime,
		Integer pauseMinutes,
		Integer workedMinutes,
		BigDecimal calculatedSalary,
		PauseStateResponse pauseState,
		OffsetDateTime joinedAt,
		OffsetDateTime approvedAt
) {

	/**
	 * Maps an attendance entity to the shift attendance list response.
	 *
	 * @param attendance attendance entity with worker already fetched
	 * @return attendance response DTO
	 */
	public static AttendanceResponse from(ShiftAttendance attendance) {
		return from(attendance, PauseStateResponse.none(), null);
	}

	/**
	 * Maps an attendance entity plus pause state to the shift attendance list response.
	 *
	 * @param attendance attendance entity with worker already fetched
	 * @param pauseState pause state for the attendance worker
	 * @return attendance response DTO
	 */
	public static AttendanceResponse from(ShiftAttendance attendance, PauseStateResponse pauseState) {
		return from(attendance, pauseState, null);
	}

	/**
	 * Maps an attendance entity plus pause state and payable start to the shift attendance list response.
	 *
	 * @param attendance attendance entity with worker already fetched
	 * @param pauseState pause state for the attendance worker
	 * @param payableStartTime effective worker payable start time
	 * @return attendance response DTO
	 */
	public static AttendanceResponse from(
			ShiftAttendance attendance,
			PauseStateResponse pauseState,
			OffsetDateTime payableStartTime
	) {
		return new AttendanceResponse(
				attendance.getId(),
				attendance.getWorker().getId(),
				attendance.getWorker().getFirstName(),
				attendance.getWorker().getLastName(),
				attendance.getStatus(),
				attendance.getPaymentStatus(),
				attendance.getHourlyRate(),
				attendance.getBreakMinutes(),
				payableStartTime,
				attendance.getPauseMinutes(),
				attendance.getWorkedMinutes(),
				attendance.getCalculatedSalary(),
				pauseState,
				attendance.getJoinedAt(),
				attendance.getApprovedAt()
		);
	}
}
