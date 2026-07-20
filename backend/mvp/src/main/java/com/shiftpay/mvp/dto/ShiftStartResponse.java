package com.shiftpay.mvp.dto;

import com.shiftpay.mvp.entity.ShiftSession;
import com.shiftpay.mvp.entity.ShiftStatus;

import java.time.OffsetDateTime;

/**
 * Response DTO returned after starting a shift.
 *
 * @param id shift session id
 * @param status resulting shift status, normally {@code ACTIVE}
 * @param actualStartTime UTC timestamp recorded by the backend when the shift started
 */
public record ShiftStartResponse(
		Long id,
		ShiftStatus status,
		OffsetDateTime actualStartTime
) {

	/**
	 * Maps a started shift entity to its start response.
	 *
	 * @param shiftSession started shift session entity
	 * @return start response DTO
	 */
	public static ShiftStartResponse from(ShiftSession shiftSession) {
		return new ShiftStartResponse(
				shiftSession.getId(),
				shiftSession.getStatus(),
				shiftSession.getActualStartTime()
		);
	}
}
