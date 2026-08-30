package com.shiftpay.mvp.entity;

/**
 * Approval status for a worker payout request.
 */
public enum PayoutRequestStatus {
	/**
	 * Request is waiting for foreman approval.
	 */
	PENDING,

	/**
	 * Request has been approved and its selected attendance was marked paid.
	 */
	APPROVED
}
