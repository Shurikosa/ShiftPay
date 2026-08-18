package com.shiftpay.mvp.dto;

import com.shiftpay.mvp.entity.ShiftStatus;

import com.fasterxml.jackson.annotation.JsonInclude;

import java.math.BigDecimal;
import java.util.List;

/**
 * Response DTO for a closed shift salary summary.
 *
 * <p>Only approved attendance with persisted salary fields is included in {@code workers}.</p>
 *
 * @param shiftId shift session id
 * @param status shift status, always {@code CLOSED} for successful summary responses
 * @param totalWorkers number of approved attendance rows included in the summary
 * @param totalSalary sum of included worker salaries with scale two
 * @param foremanWorkedMinutes private owner-foreman worked minutes, omitted for admins
 * @param foremanHourlyRate private owner-foreman rate, omitted for admins
 * @param foremanSalary private owner-foreman salary, omitted for admins
 * @param workers worker-level salary rows ordered by worker name and id
 */
public record ShiftSummaryResponse(
		Long shiftId,
		ShiftStatus status,
		int totalWorkers,
		BigDecimal totalSalary,
		@JsonInclude(JsonInclude.Include.NON_NULL)
		Integer foremanWorkedMinutes,
		@JsonInclude(JsonInclude.Include.NON_NULL)
		BigDecimal foremanHourlyRate,
		@JsonInclude(JsonInclude.Include.NON_NULL)
		BigDecimal foremanSalary,
		List<WorkerSummaryResponse> workers
) {
}
