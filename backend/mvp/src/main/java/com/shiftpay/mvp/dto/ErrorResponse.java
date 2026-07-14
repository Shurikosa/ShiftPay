package com.shiftpay.mvp.dto;

import java.time.Instant;

/**
 * Response DTO for API errors returned by controller and security exception handling.
 *
 * @param timestamp time when the error response was created
 * @param status numeric HTTP status code
 * @param error HTTP reason phrase
 * @param message client-facing error detail
 * @param path request path that failed
 */
public record ErrorResponse(
		Instant timestamp,
		int status,
		String error,
		String message,
		String path
) {
}
