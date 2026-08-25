package com.shiftpay.mvp.entity;

/**
 * Scope for a persisted pause interval.
 */
public enum PauseScope {

	/**
	 * Pause that affects only one user on the shift.
	 */
	PERSONAL,

	/**
	 * Pause that affects all paid participants on the shift.
	 */
	ALL
}
