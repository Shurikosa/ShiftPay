package com.shiftpay.mvp.security;

/**
 * Raised when JWT validation fails or token claims cannot be trusted.
 *
 * <p>The security filter and global exception handler convert this to a 401 Unauthorized response.</p>
 */
public class JwtAuthenticationException extends RuntimeException {

	/**
	 * Creates an authentication exception with an internal validation message.
	 *
	 * @param message validation failure detail
	 */
	public JwtAuthenticationException(String message) {
		super(message);
	}
}
