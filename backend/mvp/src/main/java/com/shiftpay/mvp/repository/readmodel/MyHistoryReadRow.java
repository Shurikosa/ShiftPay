package com.shiftpay.mvp.repository.readmodel;

import com.shiftpay.mvp.entity.AttendanceStatus;
import com.shiftpay.mvp.entity.PaymentStatus;
import com.shiftpay.mvp.entity.ShiftStatus;

import java.math.BigDecimal;
import java.time.OffsetDateTime;

/**
 * Immutable scalar projection for {@code GET /api/v1/me/shifts}.
 *
 * <p>Selecting scalar fields avoids materializing {@code ShiftAttendance}, whose inverse one-to-one pay-calculation
 * association can otherwise produce row-linear SQL selects.</p>
 */
public record MyHistoryReadRow(
	Long shiftId,
	Long attendanceId,
	Long companyId,
	String companyName,
	String currencyLabel,
	String title,
	String location,
	ShiftStatus shiftStatus,
	OffsetDateTime actualStartTime,
	OffsetDateTime actualEndTime,
	AttendanceStatus attendanceStatus,
	PaymentStatus paymentStatus,
	BigDecimal hourlyRate,
	Integer breakMinutes,
	OffsetDateTime payableStartTime,
	Integer pauseMinutes,
	Integer workedMinutes,
	BigDecimal calculatedSalary
) { }
