package com.shiftpay.mvp.dto;

import com.shiftpay.mvp.entity.ShiftSession;
import com.shiftpay.mvp.entity.ShiftStatus;

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
 * @param plannedStartTime planned start time in UTC, if set
 * @param plannedEndTime planned end time in UTC, if set
 * @param actualStartTime actual start time in UTC, if started
 * @param actualEndTime actual end time in UTC, if closed
 * @param defaultBreakMinutes default break minutes copied to attendance
 * @param defaultHourlyRate default hourly rate copied to attendance
 * @param createdBy user id of the creator
 */
public record ShiftResponse(
		Long id,
		String title,
		String location,
		ShiftStatus status,
		String joinCode,
		OffsetDateTime plannedStartTime,
		OffsetDateTime plannedEndTime,
		OffsetDateTime actualStartTime,
		OffsetDateTime actualEndTime,
		Integer defaultBreakMinutes,
		BigDecimal defaultHourlyRate,
		Long createdBy
) {

	/**
	 * Maps a shift entity to the shift details response.
	 *
	 * @param shiftSession shift session entity
	 * @return shift details response DTO
	 */
	public static ShiftResponse from(ShiftSession shiftSession) {
		return new ShiftResponse(
				shiftSession.getId(),
				shiftSession.getTitle(),
				shiftSession.getLocation(),
				shiftSession.getStatus(),
				shiftSession.getJoinCode(),
				shiftSession.getPlannedStartTime(),
				shiftSession.getPlannedEndTime(),
				shiftSession.getActualStartTime(),
				shiftSession.getActualEndTime(),
				shiftSession.getDefaultBreakMinutes(),
				shiftSession.getDefaultHourlyRate(),
				shiftSession.getCreatedBy().getId()
		);
	}
}
