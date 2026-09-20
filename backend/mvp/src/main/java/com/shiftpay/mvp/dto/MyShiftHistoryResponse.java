package com.shiftpay.mvp.dto;

import com.shiftpay.mvp.entity.AttendanceStatus;
import com.shiftpay.mvp.entity.PaymentStatus;
import com.shiftpay.mvp.entity.ShiftStatus;
import com.fasterxml.jackson.annotation.JsonInclude;

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
 * @param currencyLabel nullable shift currency-label snapshot for monetary values
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
 * @param payCalculation persisted premium pay breakdown only for an authorized finalized snapshot; omitted otherwise
 * @param pauseState pause state for the current user's attendance
 */
public record MyShiftHistoryResponse(
		Long shiftId,
		Long attendanceId,
		Long companyId,
		String companyName,
		String currencyLabel,
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
		@JsonInclude(JsonInclude.Include.NON_NULL)
		PayCalculationResponse payCalculation,
		PauseStateResponse pauseState
) { }
