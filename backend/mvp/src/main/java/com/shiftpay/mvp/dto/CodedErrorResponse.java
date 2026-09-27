package com.shiftpay.mvp.dto;

import java.time.Instant;

/**
 * Error response variant that carries a stable machine-readable code.
 *
 * @param timestamp time when the error response was created
 * @param status numeric HTTP status code
 * @param error HTTP reason phrase
 * @param message client-facing error detail
 * @param path request path that failed
 * @param code machine-readable error code
 */
public record CodedErrorResponse(
		Instant timestamp,
		int status,
		String error,
		String message,
		String path,
		String code
) {
}
