package com.shiftpay.mvp.config;

import io.swagger.v3.oas.models.Components;
import io.swagger.v3.oas.models.OpenAPI;
import io.swagger.v3.oas.models.info.Info;
import io.swagger.v3.oas.models.security.SecurityRequirement;
import io.swagger.v3.oas.models.security.SecurityScheme;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

@Configuration
public class OpenApiConfig {

	static final String BEARER_AUTH_SCHEME = "bearerAuth";

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
