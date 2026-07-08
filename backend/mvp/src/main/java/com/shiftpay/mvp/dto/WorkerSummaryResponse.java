package com.shiftpay.mvp.dto;

import java.math.BigDecimal;

public record WorkerSummaryResponse(
		Long attendanceId,
		Long workerId,
		String firstName,
		String lastName,
		Integer workedMinutes,
		BigDecimal hourlyRate,
		BigDecimal salary
) {
}
