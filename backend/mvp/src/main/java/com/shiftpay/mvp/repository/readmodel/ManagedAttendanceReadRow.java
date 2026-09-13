package com.shiftpay.mvp.repository.readmodel;

import com.shiftpay.mvp.entity.AttendanceStatus;
import com.shiftpay.mvp.entity.PaymentStatus;
import com.shiftpay.mvp.entity.ShiftStatus;

import java.math.BigDecimal;
import java.time.OffsetDateTime;

/**
 * Immutable scalar projection for {@code GET /api/v1/shifts/{shiftId}/attendance}.
 *
 * <p>Selecting scalar fields avoids materializing {@code ShiftAttendance}, whose inverse one-to-one pay-calculation
 * association can otherwise produce row-linear SQL selects.</p>
 */
public record ManagedAttendanceReadRow(
	Long attendanceId,
	Long workerId,
	String firstName,
	String lastName,
	AttendanceStatus attendanceStatus,
	PaymentStatus paymentStatus,
	BigDecimal hourlyRate,
	Integer breakMinutes,
	OffsetDateTime payableStartTime,
	Integer pauseMinutes,
	Integer workedMinutes,
	BigDecimal calculatedSalary,
	OffsetDateTime joinedAt,
	OffsetDateTime approvedAt,
	ShiftStatus shiftStatus,
	OffsetDateTime actualStartTime,
	OffsetDateTime actualEndTime
) { }
