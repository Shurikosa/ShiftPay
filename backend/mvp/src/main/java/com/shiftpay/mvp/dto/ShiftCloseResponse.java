package com.shiftpay.mvp.dto;

import com.shiftpay.mvp.entity.ShiftSession;
import com.shiftpay.mvp.entity.ShiftStatus;

import java.time.OffsetDateTime;

/**
 * Response DTO returned after a shift is closed.
 *
 * @param id shift session id
 * @param status resulting shift status, normally {@code CLOSED}
 * @param actualEndTime UTC timestamp recorded by the backend when the shift closed
 */
public record ShiftCloseResponse(
		Long id,
		ShiftStatus status,
		OffsetDateTime actualEndTime
) {

	/**
	 * Maps a closed shift entity to its close response.
	 *
	 * @param shiftSession closed shift session entity
	 * @return close response DTO
	 */
	public static ShiftCloseResponse from(ShiftSession shiftSession) {
		return new ShiftCloseResponse(
				shiftSession.getId(),
				shiftSession.getStatus(),
				shiftSession.getActualEndTime()
		);
	}
}
