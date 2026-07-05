package com.shiftpay.mvp.dto;

import com.shiftpay.mvp.entity.ShiftSession;
import com.shiftpay.mvp.entity.ShiftStatus;

import java.math.BigDecimal;
import java.time.OffsetDateTime;

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
