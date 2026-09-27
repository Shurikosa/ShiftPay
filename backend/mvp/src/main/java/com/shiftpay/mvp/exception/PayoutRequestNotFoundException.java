package com.shiftpay.mvp.exception;

/**
 * Raised when a payout request row is missing.
 */
public class PayoutRequestNotFoundException extends RuntimeException {

	/**
	 * Creates the standard payout request not found exception.
	 */
	public PayoutRequestNotFoundException() {
		super("Payout request not found");
	}
}
