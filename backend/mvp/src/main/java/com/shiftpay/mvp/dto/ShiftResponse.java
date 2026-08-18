package com.shiftpay.mvp.dto;

import com.shiftpay.mvp.entity.ShiftSession;
import com.shiftpay.mvp.entity.ShiftStatus;

import com.fasterxml.jackson.annotation.JsonInclude;

import java.math.BigDecimal;
import java.time.OffsetDateTime;

/**
 * Response DTO for retrieving shift details.
 *
 * @param id shift session id
 * @param title shift title
 * @param location optional shift location
 * @param status current shift lifecycle status
 * @param joinCode code workers use to join while the shift is open
 * @param actualStartTime actual start time in UTC, if started
 * @param actualEndTime actual end time in UTC, if closed
 * @param defaultBreakMinutes default break minutes copied to attendance
 * @param defaultHourlyRate default hourly rate copied to attendance
 * @param foremanHourlyRate private owner-foreman rate, omitted for admins
 * @param createdBy user id of the creator
 */
public record ShiftResponse(
		Long id,
		String title,
		String location,
		ShiftStatus status,
		String joinCode,
		OffsetDateTime actualStartTime,
		OffsetDateTime actualEndTime,
		Integer defaultBreakMinutes,
		BigDecimal defaultHourlyRate,
		@JsonInclude(JsonInclude.Include.NON_NULL)
		BigDecimal foremanHourlyRate,
		Long createdBy
) {

	/**
	 * Maps a shift entity to the shift details response.
	 *
	 * @param shiftSession shift session entity
	 * @param includePrivateForemanFields whether owner-foreman private fields should be returned
	 * @return shift details response DTO
	 */
	public static ShiftResponse from(ShiftSession shiftSession, boolean includePrivateForemanFields) {
		return new ShiftResponse(
				shiftSession.getId(),
				shiftSession.getTitle(),
				shiftSession.getLocation(),
				shiftSession.getStatus(),
				shiftSession.getJoinCode(),
				shiftSession.getActualStartTime(),
				shiftSession.getActualEndTime(),
				shiftSession.getDefaultBreakMinutes(),
				shiftSession.getDefaultHourlyRate(),
				includePrivateForemanFields ? shiftSession.getForemanHourlyRate() : null,
				shiftSession.getCreatedBy().getId()
		);
	}
}
