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

/**
 * Converts service and validation exceptions into the API's standard JSON error response.
 *
 * <p>This handler applies to controller code. Security filter errors are written separately because they happen
 * before controller invocation.</p>
 */
@RestControllerAdvice
public class GlobalExceptionHandler {

	/**
	 * Handles Bean Validation failures from request DTOs.
	 *
	 * @param exception validation exception raised by Spring MVC
	 * @param request current HTTP request
	 * @return 400 Bad Request error response
	 */
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

	/**
	 * Handles explicit bad request business validation failures.
	 *
	 * @param exception bad request exception
	 * @param request current HTTP request
	 * @return 400 Bad Request error response
	 */
	@ExceptionHandler(BadRequestException.class)
	public ResponseEntity<ErrorResponse> handleBadRequestException(
			BadRequestException exception,
			HttpServletRequest request
	) {
		return buildError(HttpStatus.BAD_REQUEST, exception.getMessage(), request);
	}

	/**
	 * Handles attendance state conflicts such as duplicate join or invalid approval transition.
	 *
	 * @param exception attendance conflict exception
	 * @param request current HTTP request
	 * @return 409 Conflict error response
	 */
	@ExceptionHandler(AttendanceConflictException.class)
	public ResponseEntity<ErrorResponse> handleAttendanceConflictException(
			AttendanceConflictException exception,
			HttpServletRequest request
	) {
		return buildError(HttpStatus.CONFLICT, exception.getMessage(), request);
	}

	/**
	 * Handles missing attendance rows.
	 *
	 * @param exception attendance not found exception
	 * @param request current HTTP request
	 * @return 404 Not Found error response
	 */
	@ExceptionHandler(AttendanceNotFoundException.class)
	public ResponseEntity<ErrorResponse> handleAttendanceNotFoundException(
			AttendanceNotFoundException exception,
			HttpServletRequest request
	) {
		return buildError(HttpStatus.NOT_FOUND, exception.getMessage(), request);
	}

	/**
	 * Handles registration attempts with an already registered email.
	 *
	 * @param exception duplicate email exception
	 * @param request current HTTP request
	 * @return 409 Conflict error response
	 */
	@ExceptionHandler(DuplicateEmailException.class)
	public ResponseEntity<ErrorResponse> handleDuplicateEmailException(
			DuplicateEmailException exception,
			HttpServletRequest request
	) {
		return buildError(HttpStatus.CONFLICT, exception.getMessage(), request);
	}

	/**
	 * Handles role or ownership authorization failures raised in services.
	 *
	 * @param exception forbidden exception
	 * @param request current HTTP request
	 * @return 403 Forbidden error response
	 */
	@ExceptionHandler(ForbiddenException.class)
	public ResponseEntity<ErrorResponse> handleForbiddenException(
			ForbiddenException exception,
			HttpServletRequest request
	) {
		return buildError(HttpStatus.FORBIDDEN, "Forbidden", request);
	}

	/**
	 * Handles missing shift sessions.
	 *
	 * @param exception shift not found exception
	 * @param request current HTTP request
	 * @return 404 Not Found error response
	 */
	@ExceptionHandler(ShiftNotFoundException.class)
	public ResponseEntity<ErrorResponse> handleShiftNotFoundException(
			ShiftNotFoundException exception,
			HttpServletRequest request
	) {
		return buildError(HttpStatus.NOT_FOUND, exception.getMessage(), request);
	}

	/**
	 * Handles shift lifecycle and salary calculation conflicts.
	 *
	 * @param exception shift state conflict exception
	 * @param request current HTTP request
	 * @return 409 Conflict error response
	 */
	@ExceptionHandler(ShiftStateConflictException.class)
	public ResponseEntity<ErrorResponse> handleShiftStateConflictException(
			ShiftStateConflictException exception,
			HttpServletRequest request
	) {
		return buildError(HttpStatus.CONFLICT, exception.getMessage(), request);
	}

	/**
	 * Handles failed login attempts with invalid credentials.
	 *
	 * @param exception invalid credentials exception
	 * @param request current HTTP request
	 * @return 401 Unauthorized error response
	 */
	@ExceptionHandler(InvalidCredentialsException.class)
	public ResponseEntity<ErrorResponse> handleInvalidCredentialsException(
			InvalidCredentialsException exception,
			HttpServletRequest request
	) {
		return buildError(HttpStatus.UNAUTHORIZED, exception.getMessage(), request);
	}

	/**
	 * Handles JWT validation failures that reach controller exception handling.
	 *
	 * @param exception JWT authentication exception
	 * @param request current HTTP request
	 * @return 401 Unauthorized error response
	 */
	@ExceptionHandler(JwtAuthenticationException.class)
	public ResponseEntity<ErrorResponse> handleJwtAuthenticationException(
			JwtAuthenticationException exception,
			HttpServletRequest request
	) {
		return buildError(HttpStatus.UNAUTHORIZED, "Unauthorized", request);
	}

	/**
	 * Builds the shared API error response body.
	 *
	 * @param status HTTP status to return
	 * @param message client-facing error message
	 * @param request current HTTP request
	 * @return response entity with the standard error body
	 */
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
