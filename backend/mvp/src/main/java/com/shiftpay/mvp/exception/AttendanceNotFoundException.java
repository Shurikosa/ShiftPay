package com.shiftpay.mvp.exception;

/**
 * Raised when an attendance row is missing or does not belong to the shift identified by the URL.
 *
 * <p>The global exception handler maps this to HTTP 404 Not Found.</p>
 */
public class AttendanceNotFoundException extends RuntimeException {

	/**
	 * Creates the standard attendance not found exception.
	 */
	public AttendanceNotFoundException() {
		super("Attendance not found");
	}
}
