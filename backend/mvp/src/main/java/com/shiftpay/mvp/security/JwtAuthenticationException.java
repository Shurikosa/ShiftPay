package com.shiftpay.mvp.security;

public class JwtAuthenticationException extends RuntimeException {

	public JwtAuthenticationException(String message) {
		super(message);
	}
}
