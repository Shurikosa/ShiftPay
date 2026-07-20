package com.shiftpay.mvp.exception;

/**
 * Raised during registration when the normalized email is already used by another account.
 *
 * <p>The global exception handler maps this to HTTP 409 Conflict.</p>
 */
public class DuplicateEmailException extends RuntimeException {

	/**
	 * Creates a duplicate email exception.
	 *
	 * @param email normalized email that already exists
	 */
	public DuplicateEmailException(String email) {
		super("User with email already exists: " + email);
	}
}
