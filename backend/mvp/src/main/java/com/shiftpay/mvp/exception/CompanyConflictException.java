package com.shiftpay.mvp.exception;

/**
 * Raised when a company onboarding operation conflicts with current user state.
 *
 * <p>The global exception handler maps this to HTTP 409 Conflict.</p>
 */
public class CompanyConflictException extends RuntimeException {

	/**
	 * Creates a company conflict with a client-facing message.
	 *
	 * @param message conflict reason
	 */
	public CompanyConflictException(String message) {
		super(message);
	}
}
