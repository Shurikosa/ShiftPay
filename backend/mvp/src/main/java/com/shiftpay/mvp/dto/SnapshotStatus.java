package com.shiftpay.mvp.dto;

/**
 * Availability of a persisted pay-rule snapshot.
 *
 * <p>{@link #UNAVAILABLE} means the persisted applied-rule JSON cannot be read. Monetary and duration fields remain
 * authoritative, but clients must not interpret an unavailable rule list as no rules having applied.</p>
 */
public enum SnapshotStatus {

	/** The complete persisted rule snapshot was read successfully. */
	COMPLETE,

	/** The persisted rule snapshot is unreadable or invalid. */
	UNAVAILABLE
}
