package com.shiftpay.mvp.exception;

/**
 * Raised when company pay policy state is inconsistent.
 */
public class PayPolicyConflictException extends RuntimeException {

	/**
	 * Creates a pay policy conflict exception.
	 *
	 * @param message client-facing conflict message
	 */
	public PayPolicyConflictException(String message) {
		super(message);
	}
}
