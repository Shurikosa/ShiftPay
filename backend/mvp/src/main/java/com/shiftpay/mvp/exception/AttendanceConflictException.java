package com.shiftpay.mvp.exception;

/**
 * Raised when an attendance operation violates the current attendance state.
 *
 * <p>The global exception handler maps this to HTTP 409 Conflict.</p>
 */
public class AttendanceConflictException extends RuntimeException {

	/**
	 * Creates an attendance conflict with a client-facing message.
	 *
	 * @param message conflict reason
	 */
	public AttendanceConflictException(String message) {
		super(message);
	}
}
