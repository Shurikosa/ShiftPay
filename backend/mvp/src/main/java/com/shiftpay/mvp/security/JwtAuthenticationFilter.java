package com.shiftpay.mvp.security;

import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Component;
import org.springframework.web.filter.OncePerRequestFilter;

import java.io.IOException;
import java.util.List;

/**
 * Reads Bearer tokens from incoming requests and installs an authenticated principal in Spring Security.
 *
 * <p>Requests without a Bearer token continue through the chain and are later rejected if the route requires
 * authentication. Invalid tokens are converted immediately to a 401 JSON response.</p>
 */
@Component
public class JwtAuthenticationFilter extends OncePerRequestFilter {

	private static final String AUTHORIZATION_HEADER = "Authorization";
	private static final String BEARER_PREFIX = "Bearer ";

	private final JwtService jwtService;
	private final AuthenticationErrorWriter errorWriter;

	/**
	 * Creates the filter with token validation and security error writing dependencies.
	 *
	 * @param jwtService service that validates JWT signatures and claims
	 * @param errorWriter writer used for invalid token responses
	 */
	public JwtAuthenticationFilter(JwtService jwtService, AuthenticationErrorWriter errorWriter) {
		this.jwtService = jwtService;
		this.errorWriter = errorWriter;
	}

	/**
	 * Validates the Authorization header and sets the request authentication when a token is valid.
	 *
	 * @param request current HTTP request
	 * @param response current HTTP response
	 * @param filterChain remaining servlet filter chain
	 * @throws ServletException if the downstream filter chain fails
	 * @throws IOException if the response cannot be written
	 */
	@Override
	protected void doFilterInternal(
			HttpServletRequest request,
			HttpServletResponse response,
			FilterChain filterChain
	) throws ServletException, IOException {
		String authorizationHeader = request.getHeader(AUTHORIZATION_HEADER);
		if (authorizationHeader == null || !authorizationHeader.startsWith(BEARER_PREFIX)) {
			filterChain.doFilter(request, response);
			return;
		}

		try {
			String token = authorizationHeader.substring(BEARER_PREFIX.length()).trim();
			JwtClaims claims = jwtService.validateAccessToken(token);
			AuthenticatedUserPrincipal principal = AuthenticatedUserPrincipal.from(claims);
			UsernamePasswordAuthenticationToken authentication = new UsernamePasswordAuthenticationToken(
					principal,
					null,
					List.of(new SimpleGrantedAuthority("ROLE_" + principal.role().name()))
			);
			SecurityContextHolder.getContext().setAuthentication(authentication);
			filterChain.doFilter(request, response);
		}
		catch (JwtAuthenticationException exception) {
			SecurityContextHolder.clearContext();
			errorWriter.writeUnauthorized(request, response, "Unauthorized");
		}
	}
}
