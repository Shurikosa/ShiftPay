package com.shiftpay.mvp.dto;

import com.shiftpay.mvp.entity.ShiftSession;
import com.shiftpay.mvp.entity.ShiftStatus;

import java.math.BigDecimal;

/**
 * Response DTO returned after creating a shift.
 *
 * @param id created shift id
 * @param title shift title
 * @param joinCode generated code workers use to join
 * @param status initial shift status, normally {@code OPEN}
 * @param defaultHourlyRate default rate copied to worker attendance when they join
 * @param createdBy user id of the foreman or admin who created the shift
 */
public record ShiftCreateResponse(
		Long id,
		String title,
		String joinCode,
		ShiftStatus status,
		BigDecimal defaultHourlyRate,
		Long createdBy
) {

	/**
	 * Maps a created shift entity to its public response.
	 *
	 * @param shiftSession created shift session entity
	 * @return create shift response DTO
	 */
	public static ShiftCreateResponse from(ShiftSession shiftSession) {
		return new ShiftCreateResponse(
				shiftSession.getId(),
				shiftSession.getTitle(),
				shiftSession.getJoinCode(),
				shiftSession.getStatus(),
				shiftSession.getDefaultHourlyRate(),
				shiftSession.getCreatedBy().getId()
		);
	}
}
