package com.shiftpay.mvp.security;

import com.shiftpay.mvp.entity.Role;

public record AuthenticatedUserPrincipal(
		Long id,
		String email,
		Role role
) {

	public static AuthenticatedUserPrincipal from(JwtClaims claims) {
		return new AuthenticatedUserPrincipal(claims.userId(), claims.email(), claims.role());
	}
}
