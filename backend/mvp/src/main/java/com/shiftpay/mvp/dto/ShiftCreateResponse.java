package com.shiftpay.mvp.dto;

import com.shiftpay.mvp.entity.ShiftSession;
import com.shiftpay.mvp.entity.ShiftStatus;

import com.fasterxml.jackson.annotation.JsonInclude;

import java.math.BigDecimal;
import java.time.OffsetDateTime;

/**
 * Response DTO returned after creating a shift.
 *
 * @param id created shift id
 * @param title generated shift title
 * @param location optional shift location
 * @param joinCode generated code workers use to join
 * @param status initial shift status, normally {@code OPEN}
 * @param actualStartTime actual start time, null until start
 * @param actualEndTime actual end time, null until close
 * @param defaultBreakMinutes default break minutes copied to attendance
 * @param defaultHourlyRate default rate copied to worker attendance when they join
 * @param foremanHourlyRate private owner-foreman rate, omitted for admins
 * @param createdBy user id of the foreman or admin who created the shift
 */
public record ShiftCreateResponse(
		Long id,
		String title,
		String location,
		String joinCode,
		ShiftStatus status,
		OffsetDateTime actualStartTime,
		OffsetDateTime actualEndTime,
		Integer defaultBreakMinutes,
		BigDecimal defaultHourlyRate,
		@JsonInclude(JsonInclude.Include.NON_NULL)
		BigDecimal foremanHourlyRate,
		Long createdBy
) {

	/**
	 * Maps a created shift entity to its public response.
	 *
	 * @param shiftSession created shift session entity
	 * @param includePrivateForemanFields whether owner-foreman private fields should be returned
	 * @return create shift response DTO
	 */
	public static ShiftCreateResponse from(ShiftSession shiftSession, boolean includePrivateForemanFields) {
		return new ShiftCreateResponse(
				shiftSession.getId(),
				shiftSession.getTitle(),
				shiftSession.getLocation(),
				shiftSession.getJoinCode(),
				shiftSession.getStatus(),
				shiftSession.getActualStartTime(),
				shiftSession.getActualEndTime(),
				shiftSession.getDefaultBreakMinutes(),
				shiftSession.getDefaultHourlyRate(),
				includePrivateForemanFields ? shiftSession.getForemanHourlyRate() : null,
				shiftSession.getCreatedBy().getId()
		);
	}
}
