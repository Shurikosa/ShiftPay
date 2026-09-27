package com.shiftpay.mvp.dto;

import java.time.Instant;

/**
 * Error response for short active shifts that need an explicit foreman decision.
 *
 * @param timestamp time when the error response was created
 * @param status numeric HTTP status code
 * @param error HTTP reason phrase
 * @param message client-facing error detail
 * @param path request path that failed
 * @param code machine-readable error code for mobile decision handling
 * @param actualDurationMinutes backend-calculated actual shift duration in whole minutes
 * @param minimumDurationMinutes configured short-shift threshold in minutes
 */
public record ShortShiftConflictResponse(
		Instant timestamp,
		int status,
		String error,
		String message,
		String path,
		String code,
		long actualDurationMinutes,
		int minimumDurationMinutes
) {
}
