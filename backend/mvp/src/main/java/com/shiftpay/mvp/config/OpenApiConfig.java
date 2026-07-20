package com.shiftpay.mvp.config;

import io.swagger.v3.oas.models.Components;
import io.swagger.v3.oas.models.OpenAPI;
import io.swagger.v3.oas.models.info.Info;
import io.swagger.v3.oas.models.security.SecurityRequirement;
import io.swagger.v3.oas.models.security.SecurityScheme;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

/**
 * Configures generated OpenAPI documentation for the ShiftPay backend MVP.
 *
 * <p>The configuration adds API metadata and a JWT Bearer security scheme so Swagger UI can send the same
 * Authorization header used by mobile clients.</p>
 */
@Configuration
public class OpenApiConfig {

	static final String BEARER_AUTH_SCHEME = "bearerAuth";

	/**
	 * Builds the OpenAPI model exposed by springdoc at {@code /v3/api-docs}.
	 *
	 * @return OpenAPI metadata and the Bearer JWT security scheme used by Swagger UI
	 */
	@Bean
	OpenAPI shiftPayOpenApi() {
		return new OpenAPI()
				.info(new Info()
						.title("ShiftPay API")
						.version("v1")
						.description("OpenAPI documentation for the ShiftPay backend MVP: authentication, "
								+ "current user, shift sessions, attendance, salary summary, and personal shift history."))
				.components(new Components()
						.addSecuritySchemes(BEARER_AUTH_SCHEME, new SecurityScheme()
								.name(BEARER_AUTH_SCHEME)
								.type(SecurityScheme.Type.HTTP)
								.scheme("bearer")
								.bearerFormat("JWT")))
				.addSecurityItem(new SecurityRequirement().addList(BEARER_AUTH_SCHEME));
	}
}
