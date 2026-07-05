package com.shiftpay.mvp.dto;

import com.shiftpay.mvp.entity.ShiftSession;
import com.shiftpay.mvp.entity.ShiftStatus;

import java.math.BigDecimal;

public record ShiftCreateResponse(
		Long id,
		String title,
		String joinCode,
		ShiftStatus status,
		BigDecimal defaultHourlyRate,
		Long createdBy
) {

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
