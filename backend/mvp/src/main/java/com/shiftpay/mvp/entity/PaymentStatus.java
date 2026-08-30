package com.shiftpay.mvp.entity;

/**
 * Payroll payment status for one worker attendance row.
 */
public enum PaymentStatus {
	/**
	 * Attendance is payable but has not been included in a payout request.
	 */
	UNPAID,

	/**
	 * Attendance is included in a pending payout request.
	 */
	PAYMENT_REQUESTED,

	/**
	 * Attendance was paid through an approved payout request.
	 */
	PAID
}
