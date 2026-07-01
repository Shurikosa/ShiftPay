package com.shiftpay.mvp.security;

import com.shiftpay.mvp.entity.Role;

public record JwtClaims(
		Long userId,
		String email,
		Role role
) {
}
