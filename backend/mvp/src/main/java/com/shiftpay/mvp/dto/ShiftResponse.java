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
 * @param companyId company assigned to the shift
 * @param companyName company display name assigned to the shift
 * @param title shift title
 * @param location optional shift location
 * @param status current shift lifecycle status
 * @param joinCode code workers use to join while the shift is open
 * @param actualStartTime actual start time in UTC, if started
 * @param actualEndTime actual end time in UTC, if closed
 * @param discardedAt discard audit timestamp, if discarded
 * @param discardedBy user id that discarded the shift, if discarded
 * @param discardReason discard audit reason, if discarded
 * @param defaultBreakMinutes default break minutes copied to attendance
 * @param defaultHourlyRate default hourly rate copied to attendance
 * @param foremanHourlyRate private owner-foreman rate, omitted for admins
 * @param pauseState pause state for the current user's shift-detail perspective
 * @param createdBy user id of the creator
 */
public record ShiftResponse(
		Long id,
		Long companyId,
		String companyName,
		String title,
		String location,
		ShiftStatus status,
		String joinCode,
		OffsetDateTime actualStartTime,
		OffsetDateTime actualEndTime,
		OffsetDateTime discardedAt,
		Long discardedBy,
		String discardReason,
		Integer defaultBreakMinutes,
		BigDecimal defaultHourlyRate,
		@JsonInclude(JsonInclude.Include.NON_NULL)
		BigDecimal foremanHourlyRate,
		PauseStateResponse pauseState,
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
		return from(shiftSession, includePrivateForemanFields, PauseStateResponse.none());
	}

	/**
	 * Maps a shift entity and pause state to the shift details response.
	 *
	 * @param shiftSession shift session entity
	 * @param includePrivateForemanFields whether owner-foreman private fields should be returned
	 * @param pauseState pause state for the current response perspective
	 * @return shift details response DTO
	 */
	public static ShiftResponse from(
			ShiftSession shiftSession,
			boolean includePrivateForemanFields,
			PauseStateResponse pauseState
	) {
		return new ShiftResponse(
				shiftSession.getId(),
				shiftSession.getCompany().getId(),
				shiftSession.getCompany().getName(),
				shiftSession.getTitle(),
				shiftSession.getLocation(),
				shiftSession.getStatus(),
				shiftSession.getJoinCode(),
				shiftSession.getActualStartTime(),
				shiftSession.getActualEndTime(),
				shiftSession.getDiscardedAt(),
				shiftSession.getDiscardedBy() == null ? null : shiftSession.getDiscardedBy().getId(),
				shiftSession.getDiscardReason(),
				shiftSession.getDefaultBreakMinutes(),
				shiftSession.getDefaultHourlyRate(),
				includePrivateForemanFields ? shiftSession.getForemanHourlyRate() : null,
				pauseState,
				shiftSession.getCreatedBy().getId()
		);
	}
}
