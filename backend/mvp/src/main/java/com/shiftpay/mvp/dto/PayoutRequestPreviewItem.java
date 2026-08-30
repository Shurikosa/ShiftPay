package com.shiftpay.mvp.dto;

import com.shiftpay.mvp.entity.ShiftAttendance;

/**
 * Internal preview item used to share validation and calculation between preview and create.
 *
 * @param attendance selected attendance row
 * @param rounding payroll rounding for that attendance
 */
public record PayoutRequestPreviewItem(
		ShiftAttendance attendance,
		PayrollRoundingResult rounding
) {
}
