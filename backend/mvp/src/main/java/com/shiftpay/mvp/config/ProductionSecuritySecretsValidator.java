package com.shiftpay.mvp.config;

import org.springframework.beans.factory.InitializingBean;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.core.env.Environment;
import org.springframework.stereotype.Component;

import java.util.Arrays;
import java.util.Set;

/**
 * Prevents a non-development deployment from starting with missing or bundled development signing secrets.
 */
@Component
public class ProductionSecuritySecretsValidator implements InitializingBean {

	static final String DEVELOPMENT_JWT_SECRET = "shiftpay-dev-secret-change-me";
	static final String DEVELOPMENT_CURSOR_SECRET = "shiftpay-dev-cursor-secret-change-me";
	private static final Set<String> DEVELOPMENT_PROFILES = Set.of(
			"dev", "development", "local", "test"
	);

	private final Environment environment;
	private final String jwtSecret;
	private final String cursorSecret;

	public ProductionSecuritySecretsValidator(
			Environment environment,
			@Value("${security.jwt.secret:}") String jwtSecret,
			@Value("${shiftpay.cursor.secret:}") String cursorSecret
	) {
		this.environment = environment;
		this.jwtSecret = jwtSecret;
		this.cursorSecret = cursorSecret;
	}

	@Override
	public void afterPropertiesSet() {
		String[] activeProfiles = environment.getActiveProfiles();
		boolean development = activeProfiles.length > 0
				&& Arrays.stream(activeProfiles).allMatch(DEVELOPMENT_PROFILES::contains);
		if (development) {
			return;
		}

		validateProductionSecret("security.jwt.secret", jwtSecret, DEVELOPMENT_JWT_SECRET);
		validateProductionSecret("shiftpay.cursor.secret", cursorSecret, DEVELOPMENT_CURSOR_SECRET);
	}

	private void validateProductionSecret(String property, String value, String developmentValue) {
		if (value == null || value.isBlank() || developmentValue.equals(value)) {
			throw new IllegalStateException(property
					+ " must be configured with a non-development value for non-development profiles");
		}
	}
}
