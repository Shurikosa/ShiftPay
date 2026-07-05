package com.shiftpay.mvp.dto;

import com.shiftpay.mvp.entity.ShiftSession;
import com.shiftpay.mvp.entity.ShiftStatus;

import java.time.OffsetDateTime;

public record ShiftStartResponse(
		Long id,
		ShiftStatus status,
		OffsetDateTime actualStartTime
) {

	public static ShiftStartResponse from(ShiftSession shiftSession) {
		return new ShiftStartResponse(
				shiftSession.getId(),
				shiftSession.getStatus(),
				shiftSession.getActualStartTime()
		);
	}
}
