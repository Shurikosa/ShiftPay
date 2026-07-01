package com.shiftpay.mvp.dto;

public record LoginResponse(
		String accessToken,
		String tokenType,
		UserResponse user
) {
}
