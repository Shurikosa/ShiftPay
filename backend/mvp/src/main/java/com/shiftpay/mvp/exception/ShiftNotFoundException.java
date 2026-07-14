package com.shiftpay.mvp.exception;

/**
 * Raised when a shift session cannot be found.
 *
 * <p>The global exception handler maps this to HTTP 404 Not Found.</p>
 */
public class ShiftNotFoundException extends RuntimeException {

	/**
	 * Creates the standard shift not found exception.
	 */
	public ShiftNotFoundException() {
		super("Shift not found");
	}
}
