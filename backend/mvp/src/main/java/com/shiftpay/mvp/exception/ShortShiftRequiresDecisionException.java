package com.shiftpay.mvp.exception;

/**
 * Raised when an active shift is shorter than the minimum close duration and the foreman must choose save or discard.
 */
public class ShortShiftRequiresDecisionException extends RuntimeException {

	/**
	 * Machine-readable code used by mobile clients to show the short-shift decision prompt.
	 */
	public static final String CODE = "SHORT_SHIFT_REQUIRES_DECISION";

	private final long durationMinutes;
	private final int thresholdMinutes;

	/**
	 * Creates the short-shift decision conflict.
	 *
	 * @param durationMinutes backend-calculated actual shift duration in whole minutes
	 * @param thresholdMinutes configured short-shift threshold in minutes
	 */
	public ShortShiftRequiresDecisionException(long durationMinutes, int thresholdMinutes) {
		super("Shift duration is less than 15 minutes; confirm whether to save or discard");
		this.durationMinutes = durationMinutes;
		this.thresholdMinutes = thresholdMinutes;
	}

	/**
	 * Returns backend-calculated shift duration in whole minutes.
	 *
	 * @return actual duration minutes
	 */
	public long getDurationMinutes() {
		return durationMinutes;
	}

	/**
	 * Returns configured short-shift threshold in minutes.
	 *
	 * @return threshold minutes
	 */
	public int getThresholdMinutes() {
		return thresholdMinutes;
	}
}
