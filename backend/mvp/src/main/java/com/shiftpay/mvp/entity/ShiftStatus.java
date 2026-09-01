package com.shiftpay.mvp.entity;

/**
 * Lifecycle status of a shift session.
 */
public enum ShiftStatus {
	/**
	 * Reserved initial state for future flows; current MVP creates shifts directly as open.
	 */
	CREATED,

	/**
	 * Workers may join and attendance may be approved.
	 */
	OPEN,

	/**
	 * Shift has started and is accumulating actual work time.
	 */
	ACTIVE,

	/**
	 * Shift has ended and approved attendance salary has been calculated.
	 */
	CLOSED,

	/**
	 * Terminal state for active short shifts explicitly not saved by the owner foreman.
	 */
	DISCARDED,

	/**
	 * Terminal state for open shifts cancelled before they start.
	 */
	CANCELLED
}
