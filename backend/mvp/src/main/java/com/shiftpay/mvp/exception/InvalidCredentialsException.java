package com.shiftpay.mvp.exception;

/**
 * Raised when login email or password verification fails.
 *
 * <p>The global exception handler maps this to HTTP 401 Unauthorized.</p>
 */
public class InvalidCredentialsException extends RuntimeException {

	/**
	 * Creates the standard invalid credentials exception.
	 */
	public InvalidCredentialsException() {
		super("Invalid email or password");
	}
}
