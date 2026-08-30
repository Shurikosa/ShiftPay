package com.shiftpay.mvp.exception;

/**
 * Raised when a payout request operation violates the current payroll state.
 */
public class PayoutRequestConflictException extends RuntimeException {

	/**
	 * Creates a payout request conflict with a client-facing message.
	 *
	 * @param message conflict reason
	 */
	public PayoutRequestConflictException(String message) {
		super(message);
	}
}
