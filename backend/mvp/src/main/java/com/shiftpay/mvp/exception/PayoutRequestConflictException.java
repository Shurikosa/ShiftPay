package com.shiftpay.mvp.exception;

/**
 * Raised when a payout request operation violates the current payroll state.
 */
public class PayoutRequestConflictException extends RuntimeException {

	private final String code;

	/**
	 * Creates a payout request conflict with a client-facing message.
	 *
	 * @param message conflict reason
	 */
	public PayoutRequestConflictException(String message) {
		this(message, null);
	}

	/**
	 * Creates a payout request conflict with a client-facing message and stable error code.
	 *
	 * @param message conflict reason
	 * @param code machine-readable conflict code, or null when no code is defined
	 */
	public PayoutRequestConflictException(String message, String code) {
		super(message);
		this.code = code;
	}

	/**
	 * Returns the optional machine-readable conflict code.
	 *
	 * @return conflict code, or null when the API defines no code
	 */
	public String getCode() {
		return code;
	}
}
