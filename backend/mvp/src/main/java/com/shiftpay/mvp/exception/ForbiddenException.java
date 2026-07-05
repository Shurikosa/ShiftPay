package com.shiftpay.mvp.exception;

public class ForbiddenException extends RuntimeException {

	public ForbiddenException() {
		super("Forbidden");
	}
}
