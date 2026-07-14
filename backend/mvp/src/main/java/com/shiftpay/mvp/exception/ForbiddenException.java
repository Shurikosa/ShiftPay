package com.shiftpay.mvp.exception;

/**
 * Raised when an authenticated user does not have the required role or ownership for an operation.
 *
 * <p>The global exception handler maps this to HTTP 403 Forbidden.</p>
 */
public class ForbiddenException extends RuntimeException {

	/**
	 * Creates the standard forbidden exception.
	 */
	public ForbiddenException() {
		super("Forbidden");
	}
}
