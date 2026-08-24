package com.shiftpay.mvp.dto;

import java.time.OffsetDateTime;

/**
 * Mobile-friendly pause state for the current response perspective.
 *
 * @param allPaused whether a global all-participant pause is active
 * @param allPauseStartedAt active global pause start timestamp, or null
 * @param personallyPaused whether the viewed/current user has an active personal pause
 * @param personalPauseStartedAt active personal pause start timestamp, or null
 * @param effectivePauseMinutes persisted or currently accumulated union pause minutes when available
 */
public record PauseStateResponse(
		boolean allPaused,
		OffsetDateTime allPauseStartedAt,
		boolean personallyPaused,
		OffsetDateTime personalPauseStartedAt,
		Integer effectivePauseMinutes
) {

	/**
	 * Returns an empty pause state used before any pause intervals exist.
	 *
	 * @return pause state with no active pauses and no accumulated minutes
	 */
	public static PauseStateResponse none() {
		return new PauseStateResponse(false, null, false, null, null);
	}
}
