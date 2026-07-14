package com.shiftpay.mvp.exception;

/**
 * Raised when a shift lifecycle or salary calculation operation conflicts with current state.
 *
 * <p>The global exception handler maps this to HTTP 409 Conflict.</p>
 */
public class ShiftStateConflictException extends RuntimeException {

	/**
	 * Creates a shift state conflict with a client-facing message.
	 *
	 * @param message conflict reason
	 */
	public ShiftStateConflictException(String message) {
		super(message);
	}
}
