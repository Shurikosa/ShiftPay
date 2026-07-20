package com.shiftpay.mvp.exception;

/**
 * Raised when a request is syntactically valid JSON but violates a business validation rule.
 *
 * <p>The global exception handler maps this to HTTP 400 Bad Request.</p>
 */
public class BadRequestException extends RuntimeException {

	/**
	 * Creates a bad request exception with a client-facing message.
	 *
	 * @param message validation failure detail
	 */
	public BadRequestException(String message) {
		super(message);
	}
}
