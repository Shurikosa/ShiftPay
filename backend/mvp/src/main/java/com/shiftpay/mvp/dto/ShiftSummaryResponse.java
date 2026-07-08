package com.shiftpay.mvp.dto;

import com.shiftpay.mvp.entity.ShiftStatus;

import java.math.BigDecimal;
import java.util.List;

public record ShiftSummaryResponse(
		Long shiftId,
		ShiftStatus status,
		int totalWorkers,
		BigDecimal totalSalary,
		List<WorkerSummaryResponse> workers
) {
}
