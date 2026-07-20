package com.shiftpay.mvp.security;

import com.shiftpay.mvp.entity.Role;

/**
 * Trusted claims extracted from a validated access token.
 *
 * @param userId authenticated user id from the token subject
 * @param email authenticated user's normalized email
 * @param role authenticated user's role
 */
public record JwtClaims(
		Long userId,
		String email,
		Role role
) {
}
