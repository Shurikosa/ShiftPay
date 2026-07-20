package com.shiftpay.mvp.config;

import com.shiftpay.mvp.security.AuthenticationErrorWriter;
import com.shiftpay.mvp.security.JwtAuthenticationEntryPoint;
import com.shiftpay.mvp.security.JwtAuthenticationFilter;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.http.HttpMethod;
import org.springframework.security.config.annotation.web.builders.HttpSecurity;
import org.springframework.security.config.annotation.web.configurers.AbstractHttpConfigurer;
import org.springframework.security.config.http.SessionCreationPolicy;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.security.web.SecurityFilterChain;
import org.springframework.security.web.authentication.UsernamePasswordAuthenticationFilter;

/**
 * Defines HTTP security rules for the stateless JWT-protected backend API.
 *
 * <p>Public routes are limited to health, authentication, and Swagger/OpenAPI endpoints. Business endpoints keep
 * role-based access checks and are authenticated through {@link JwtAuthenticationFilter}.</p>
 */
@Configuration
public class SecurityConfig {

	/**
	 * Creates the Spring Security filter chain for the REST API.
	 *
	 * @param http Spring Security HTTP builder
	 * @param jwtAuthenticationFilter filter that reads and validates Bearer JWT tokens
	 * @param jwtAuthenticationEntryPoint entry point used when authentication is missing or invalid
	 * @param authenticationErrorWriter writer for JSON authentication and authorization errors
	 * @return configured stateless security filter chain
	 * @throws Exception if Spring Security cannot build the filter chain
	 */
	@Bean
	SecurityFilterChain securityFilterChain(
			HttpSecurity http,
			JwtAuthenticationFilter jwtAuthenticationFilter,
			JwtAuthenticationEntryPoint jwtAuthenticationEntryPoint,
			AuthenticationErrorWriter authenticationErrorWriter
	) throws Exception {
		return http
				.csrf(AbstractHttpConfigurer::disable)
				.httpBasic(AbstractHttpConfigurer::disable)
				.formLogin(AbstractHttpConfigurer::disable)
				.sessionManagement((sessions) -> sessions.sessionCreationPolicy(SessionCreationPolicy.STATELESS))
				.exceptionHandling((exceptions) -> exceptions
						.authenticationEntryPoint(jwtAuthenticationEntryPoint)
						.accessDeniedHandler((request, response, exception) ->
								authenticationErrorWriter.writeForbidden(request, response, "Forbidden")))
				.authorizeHttpRequests((requests) -> requests
						.requestMatchers(HttpMethod.GET, "/api/v1/health").permitAll()
						.requestMatchers(HttpMethod.GET, "/v3/api-docs").permitAll()
						.requestMatchers(HttpMethod.GET, "/v3/api-docs/**").permitAll()
						.requestMatchers(HttpMethod.GET, "/swagger-ui.html").permitAll()
						.requestMatchers(HttpMethod.GET, "/swagger-ui/**").permitAll()
						.requestMatchers(HttpMethod.POST, "/api/v1/auth/register").permitAll()
						.requestMatchers(HttpMethod.POST, "/api/v1/auth/login").permitAll()
						.requestMatchers(HttpMethod.POST, "/api/v1/shifts/join").hasRole("WORKER")
						.requestMatchers(HttpMethod.POST,
								"/api/v1/shifts/{shiftId}/attendance/{attendanceId}/approve")
						.hasAnyRole("FOREMAN", "ADMIN")
						.requestMatchers(HttpMethod.GET, "/api/v1/shifts/{shiftId}/attendance")
						.hasAnyRole("FOREMAN", "ADMIN")
						.requestMatchers(HttpMethod.GET, "/api/v1/shifts/{shiftId}/summary")
						.hasAnyRole("FOREMAN", "ADMIN")
						.requestMatchers(HttpMethod.POST, "/api/v1/shifts").hasAnyRole("FOREMAN", "ADMIN")
						.requestMatchers(HttpMethod.GET, "/api/v1/shifts/{shiftId}").hasAnyRole("FOREMAN", "ADMIN")
						.requestMatchers(HttpMethod.POST, "/api/v1/shifts/{shiftId}/start")
						.hasAnyRole("FOREMAN", "ADMIN")
						.requestMatchers(HttpMethod.POST, "/api/v1/shifts/{shiftId}/close")
						.hasAnyRole("FOREMAN", "ADMIN")
						.anyRequest().authenticated())
				.addFilterBefore(jwtAuthenticationFilter, UsernamePasswordAuthenticationFilter.class)
				.build();
	}

	/**
	 * Provides BCrypt password hashing for user registration and login checks.
	 *
	 * @return BCrypt password encoder used by authentication services
	 */
	@Bean
	PasswordEncoder passwordEncoder() {
		return new BCryptPasswordEncoder();
	}

}
