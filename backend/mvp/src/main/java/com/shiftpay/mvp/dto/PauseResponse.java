package com.shiftpay.mvp.dto;

import com.shiftpay.mvp.entity.PauseScope;
import com.shiftpay.mvp.entity.ShiftPauseInterval;

import com.fasterxml.jackson.annotation.JsonInclude;

import java.time.OffsetDateTime;

/**
 * Response DTO returned by pause start/end endpoints.
 *
 * @param shiftId shift session id
 * @param pauseId pause interval id
 * @param scope pause scope
 * @param userId user affected by PERSONAL pause, omitted for ALL pause
 * @param active whether the interval is still open
 * @param startedAt UTC timestamp when pause started
 * @param endedAt UTC timestamp when pause ended, or null while active
 */
public record PauseResponse(
		Long shiftId,
		Long pauseId,
		PauseScope scope,
		@JsonInclude(JsonInclude.Include.NON_NULL)
		Long userId,
		boolean active,
		OffsetDateTime startedAt,
		OffsetDateTime endedAt
) {

	/**
	 * Maps a pause interval entity to an endpoint response.
	 *
	 * @param pauseInterval pause interval entity
	 * @return pause response DTO
	 */
	public static PauseResponse from(ShiftPauseInterval pauseInterval) {
		return new PauseResponse(
				pauseInterval.getShiftSession().getId(),
				pauseInterval.getId(),
				pauseInterval.getScope(),
				pauseInterval.getUser() == null ? null : pauseInterval.getUser().getId(),
				pauseInterval.getEndedAt() == null,
				pauseInterval.getStartedAt(),
				pauseInterval.getEndedAt()
		);
	}
}
