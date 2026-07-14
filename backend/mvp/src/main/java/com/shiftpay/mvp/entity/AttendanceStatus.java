package com.shiftpay.mvp.entity;

/**
 * Lifecycle status of a worker attendance record inside a shift session.
 */
public enum AttendanceStatus {
	/**
	 * Worker joined the shift and is waiting for foreman or admin approval.
	 */
	JOINED,

	/**
	 * Attendance is approved and receives salary calculation when the shift closes.
	 */
	APPROVED,

	/**
	 * Attendance was rejected and is excluded from salary calculation.
	 */
	REJECTED,

	/**
	 * Attendance was cancelled and is excluded from salary calculation.
	 */
	CANCELLED
}
