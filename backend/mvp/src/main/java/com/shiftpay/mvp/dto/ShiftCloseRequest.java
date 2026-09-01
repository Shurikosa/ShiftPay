package com.shiftpay.mvp.dto;

/**
 * Optional request body for closing active shifts.
 *
 * @param saveShortShift true when the foreman explicitly chooses to save a short active shift
 */
public record ShiftCloseRequest(
		Boolean saveShortShift
) {
	/**
	 * Returns whether short-shift validation should be overridden by explicit foreman choice.
	 *
	 * @return true only when saveShortShift is Boolean.TRUE
	 */
	public boolean shouldSaveShortShift() {
		return Boolean.TRUE.equals(saveShortShift);
	}
}
