package com.shiftpay.mvp.exception;

import com.shiftpay.mvp.dto.ErrorResponse;
import com.shiftpay.mvp.security.JwtAuthenticationException;
import jakarta.servlet.http.HttpServletRequest;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.MethodArgumentNotValidException;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;

import java.time.Instant;

@RestControllerAdvice
public class GlobalExceptionHandler {

	@ExceptionHandler(MethodArgumentNotValidException.class)
	public ResponseEntity<ErrorResponse> handleValidationException(
			MethodArgumentNotValidException exception,
			HttpServletRequest request
	) {
		String message = exception.getBindingResult().getFieldErrors().stream()
				.findFirst()
				.map((error) -> error.getField() + ": " + error.getDefaultMessage())
				.orElse("Validation failed");

		return buildError(HttpStatus.BAD_REQUEST, message, request);
	}

	@ExceptionHandler(DuplicateEmailException.class)
	public ResponseEntity<ErrorResponse> handleDuplicateEmailException(
			DuplicateEmailException exception,
			HttpServletRequest request
	) {
		return buildError(HttpStatus.CONFLICT, exception.getMessage(), request);
	}

	@ExceptionHandler(InvalidCredentialsException.class)
	public ResponseEntity<ErrorResponse> handleInvalidCredentialsException(
			InvalidCredentialsException exception,
			HttpServletRequest request
	) {
		return buildError(HttpStatus.UNAUTHORIZED, exception.getMessage(), request);
	}

	@ExceptionHandler(JwtAuthenticationException.class)
	public ResponseEntity<ErrorResponse> handleJwtAuthenticationException(
			JwtAuthenticationException exception,
			HttpServletRequest request
	) {
		return buildError(HttpStatus.UNAUTHORIZED, "Unauthorized", request);
	}

	private ResponseEntity<ErrorResponse> buildError(HttpStatus status, String message, HttpServletRequest request) {
		ErrorResponse response = new ErrorResponse(
				Instant.now(),
				status.value(),
				status.getReasonPhrase(),
				message,
				request.getRequestURI()
		);
		return ResponseEntity.status(status).body(response);
	}
}
