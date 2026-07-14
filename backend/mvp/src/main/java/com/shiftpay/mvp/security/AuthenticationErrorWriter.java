package com.shiftpay.mvp.security;

import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.stereotype.Component;

import java.io.IOException;
import java.time.Instant;

/**
 * Writes authentication and authorization failures in the shared API error JSON format.
 *
 * <p>This is used from the security filter chain, where the normal controller exception handler is not involved.</p>
 */
@Component
public class AuthenticationErrorWriter {

	/**
	 * Writes a 401 Unauthorized response for missing, malformed, expired, or invalid authentication.
	 *
	 * @param request current HTTP request, used to populate the response path
	 * @param response current HTTP response
	 * @param message error message to expose to the client
	 * @throws IOException if the servlet response cannot be written
	 */
	public void writeUnauthorized(HttpServletRequest request, HttpServletResponse response, String message)
			throws IOException {
		writeError(request, response, HttpStatus.UNAUTHORIZED, message);
	}

	/**
	 * Writes a 403 Forbidden response when an authenticated user lacks the required role or ownership.
	 *
	 * @param request current HTTP request, used to populate the response path
	 * @param response current HTTP response
	 * @param message error message to expose to the client
	 * @throws IOException if the servlet response cannot be written
	 */
	public void writeForbidden(HttpServletRequest request, HttpServletResponse response, String message)
			throws IOException {
		writeError(request, response, HttpStatus.FORBIDDEN, message);
	}

	/**
	 * Writes a JSON API error response unless another component has already committed the response.
	 *
	 * @param request current HTTP request
	 * @param response current HTTP response
	 * @param status HTTP status to return
	 * @param message API error message
	 * @throws IOException if the servlet response cannot be written
	 */
	private void writeError(HttpServletRequest request, HttpServletResponse response, HttpStatus status, String message)
			throws IOException {
		if (response.isCommitted()) {
			return;
		}

		response.setStatus(status.value());
		response.setContentType(MediaType.APPLICATION_JSON_VALUE);
		response.getWriter().write("""
				{"timestamp":"%s","status":%d,"error":"%s","message":"%s","path":"%s"}"""
				.formatted(
						Instant.now(),
						status.value(),
						status.getReasonPhrase(),
						escapeJson(message),
						escapeJson(request.getRequestURI())
				));
	}

	/**
	 * Escapes text inserted into the small JSON error body written by security components.
	 *
	 * @param value source value
	 * @return JSON-safe string value
	 */
	private String escapeJson(String value) {
		return value
				.replace("\\", "\\\\")
				.replace("\"", "\\\"");
	}
}
