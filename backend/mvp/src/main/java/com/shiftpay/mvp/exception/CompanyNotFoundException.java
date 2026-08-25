package com.shiftpay.mvp.exception;

/**
 * Raised when a company cannot be found by id or join code.
 *
 * <p>The global exception handler maps this to HTTP 404 Not Found.</p>
 */
public class CompanyNotFoundException extends RuntimeException {

	/**
	 * Creates the standard company not found exception.
	 */
	public CompanyNotFoundException() {
		super("Company not found");
	}
}
