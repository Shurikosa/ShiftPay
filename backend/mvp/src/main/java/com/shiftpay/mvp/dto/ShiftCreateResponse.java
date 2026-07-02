package com.shiftpay.mvp.dto;

import com.shiftpay.mvp.entity.ShiftSession;
import com.shiftpay.mvp.entity.ShiftStatus;

public record ShiftCreateResponse(
		Long id,
		String title,
		String joinCode,
		ShiftStatus status,
		Long createdBy
) {

	public static ShiftCreateResponse from(ShiftSession shiftSession) {
		return new ShiftCreateResponse(
				shiftSession.getId(),
				shiftSession.getTitle(),
				shiftSession.getJoinCode(),
				shiftSession.getStatus(),
				shiftSession.getCreatedBy().getId()
		);
	}
}
