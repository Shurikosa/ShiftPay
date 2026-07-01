package com.shiftpay.mvp.security;

import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.stereotype.Component;

import java.io.IOException;
import java.time.Instant;

@Component
public class AuthenticationErrorWriter {

	public void writeUnauthorized(HttpServletRequest request, HttpServletResponse response, String message)
			throws IOException {
		if (response.isCommitted()) {
			return;
		}

		response.setStatus(HttpStatus.UNAUTHORIZED.value());
		response.setContentType(MediaType.APPLICATION_JSON_VALUE);
		response.getWriter().write("""
				{"timestamp":"%s","status":401,"error":"Unauthorized","message":"%s","path":"%s"}"""
				.formatted(
						Instant.now(),
						escapeJson(message),
						escapeJson(request.getRequestURI())
				));
	}

	private String escapeJson(String value) {
		return value
				.replace("\\", "\\\\")
				.replace("\"", "\\\"");
	}
}
