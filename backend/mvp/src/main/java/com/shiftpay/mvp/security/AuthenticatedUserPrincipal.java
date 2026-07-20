package com.shiftpay.mvp.security;

import com.shiftpay.mvp.entity.Role;

/**
 * Authenticated user identity stored in the Spring Security context after a JWT is validated.
 *
 * @param id database id of the authenticated user
 * @param email normalized email from the token claims
 * @param role role used by Spring Security authorization rules
 */
public record AuthenticatedUserPrincipal(
		Long id,
		String email,
		Role role
) {

	/**
	 * Converts validated JWT claims into the principal used by controllers and services.
	 *
	 * @param claims validated token claims
	 * @return principal for the current request
	 */
	public static AuthenticatedUserPrincipal from(JwtClaims claims) {
		return new AuthenticatedUserPrincipal(claims.userId(), claims.email(), claims.role());
	}
}
