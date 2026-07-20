package com.shiftpay.mvp.dto;

/**
 * Response DTO returned after successful login.
 *
 * @param accessToken JWT access token sent by clients as a Bearer token
 * @param tokenType token type string, currently {@code Bearer}
 * @param user public current-user data for the authenticated account
 */
public record LoginResponse(
		String accessToken,
		String tokenType,
		UserResponse user
) {
}
