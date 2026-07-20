package com.shiftpay.mvp.security;

import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.springframework.security.core.AuthenticationException;
import org.springframework.security.web.AuthenticationEntryPoint;
import org.springframework.stereotype.Component;

import java.io.IOException;

/**
 * Spring Security entry point for unauthenticated requests.
 *
 * <p>It returns the same JSON 401 format used by the rest of the API instead of redirecting or using HTTP Basic.</p>
 */
@Component
public class JwtAuthenticationEntryPoint implements AuthenticationEntryPoint {

	private final AuthenticationErrorWriter errorWriter;

	/**
	 * Creates the entry point with the shared security error writer.
	 *
	 * @param errorWriter component that writes JSON security errors
	 */
	public JwtAuthenticationEntryPoint(AuthenticationErrorWriter errorWriter) {
		this.errorWriter = errorWriter;
	}

	/**
	 * Handles unauthenticated access attempts by returning a 401 JSON response.
	 *
	 * @param request current HTTP request
	 * @param response current HTTP response
	 * @param authException Spring Security authentication exception
	 * @throws IOException if the response cannot be written
	 * @throws ServletException if the servlet container fails while handling the entry point
	 */
	@Override
	public void commence(
			HttpServletRequest request,
			HttpServletResponse response,
			AuthenticationException authException
	) throws IOException, ServletException {
		errorWriter.writeUnauthorized(request, response, "Unauthorized");
	}
}
