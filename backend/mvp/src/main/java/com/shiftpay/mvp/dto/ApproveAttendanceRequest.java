package com.shiftpay.mvp.dto;

import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.Digits;

import java.math.BigDecimal;

public record ApproveAttendanceRequest(
		@DecimalMin("0.00")
		@Digits(integer = 10, fraction = 2)
		BigDecimal hourlyRate
) {
}
