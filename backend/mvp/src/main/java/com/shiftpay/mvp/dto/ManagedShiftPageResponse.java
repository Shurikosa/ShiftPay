package com.shiftpay.mvp.dto;

import io.swagger.v3.oas.annotations.media.Schema;

import java.util.List;

public record ManagedShiftPageResponse(
		@Schema(requiredMode = Schema.RequiredMode.REQUIRED)
		List<ShiftResponse> items,
		@Schema(requiredMode = Schema.RequiredMode.REQUIRED, nullable = true)
		String nextCursor,
		@Schema(requiredMode = Schema.RequiredMode.REQUIRED)
		boolean hasMore
) { }
