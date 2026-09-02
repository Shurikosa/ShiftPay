package com.shiftpay.mvp.exception;

/**
 * Raised when a shift cannot start because the company has no resolvable current PayPolicy version.
 */
public class PayPolicyRequiredException extends RuntimeException {

	public static final String CODE = "PAY_POLICY_REQUIRED";

	/**
	 * Creates the conflict exception with the canonical API message.
	 */
	public PayPolicyRequiredException() {
		super("Current pay policy is required before starting a shift");
	}
}
