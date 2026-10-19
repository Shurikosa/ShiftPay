package com.shiftpay.mvp.exception;

import lombok.Getter;
import org.springframework.http.HttpStatus;

@Getter
public class ApiErrorException extends RuntimeException {

	private final HttpStatus status;
	private final String code;
	private final Long retryAfterSeconds;
	private final Integer attemptsRemaining;

	public ApiErrorException(HttpStatus status, String code, String message) {
		this(status, code, message, null, null);
	}

	public ApiErrorException(
			HttpStatus status,
			String code,
			String message,
			Long retryAfterSeconds,
			Integer attemptsRemaining
	) {
		super(message);
		this.status = status;
		this.code = code;
		this.retryAfterSeconds = retryAfterSeconds;
		this.attemptsRemaining = attemptsRemaining;
	}
}
