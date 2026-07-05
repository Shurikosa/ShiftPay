package com.shiftpay.mvp.dto;

import com.shiftpay.mvp.entity.ShiftSession;
import com.shiftpay.mvp.entity.ShiftStatus;

import java.time.OffsetDateTime;

public record ShiftCloseResponse(
		Long id,
		ShiftStatus status,
		OffsetDateTime actualEndTime
) {

	public static ShiftCloseResponse from(ShiftSession shiftSession) {
		return new ShiftCloseResponse(
				shiftSession.getId(),
				shiftSession.getStatus(),
				shiftSession.getActualEndTime()
		);
	}
}
