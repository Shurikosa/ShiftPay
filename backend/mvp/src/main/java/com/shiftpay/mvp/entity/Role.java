package com.shiftpay.mvp.entity;

/**
 * Application role used for JWT authorization and endpoint access rules.
 */
public enum Role {
	/**
	 * Worker can join shifts and view their own attendance history.
	 */
	WORKER,

	/**
	 * Foreman can create and manage owned shifts and approve attendance.
	 */
	FOREMAN,

	/**
	 * Admin can manage backend resources across shifts and users as features expand.
	 */
	ADMIN
}
