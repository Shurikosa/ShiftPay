package com.shiftpay.mvp.config;

import org.junit.jupiter.api.Test;
import org.springframework.boot.test.context.runner.ApplicationContextRunner;
import org.springframework.context.annotation.Configuration;
import org.springframework.context.annotation.Import;

import static org.assertj.core.api.Assertions.assertThat;

class ProductionSecuritySecretsValidatorTests {
	private static final String STRONG_JWT_SECRET =
			"test-only-explicit-jwt-secret-with-more-than-enough-entropy-2026";
	private static final String STRONG_CURSOR_SECRET =
			"test-only-explicit-cursor-secret-with-more-than-enough-entropy-2026";

	private final ApplicationContextRunner contextRunner = new ApplicationContextRunner()
			.withUserConfiguration(ValidatorConfiguration.class);

	@Test
	void nonDevelopmentProfileFailsFastWhenSecretsAreMissing() {
		contextRunner
				.withPropertyValues("spring.profiles.active=prod")
				.run(context -> {
					assertThat(context).hasFailed();
					assertThat(context.getStartupFailure()).hasRootCauseInstanceOf(IllegalStateException.class);
					assertThat(context.getStartupFailure()).hasStackTraceContaining("security.jwt.secret");
				});
	}

	@Test
	void nonDevelopmentProfileRejectsKnownDevelopmentSecrets() {
		contextRunner
				.withPropertyValues(
						"spring.profiles.active=prod",
						"security.jwt.secret=" + ProductionSecuritySecretsValidator.DEVELOPMENT_JWT_SECRET,
						"shiftpay.cursor.secret=" + ProductionSecuritySecretsValidator.DEVELOPMENT_CURSOR_SECRET)
				.run(context -> {
					assertThat(context).hasFailed();
					assertThat(context.getStartupFailure()).hasStackTraceContaining("security.jwt.secret");
				});
	}

	@Test
	void nonDevelopmentProfileAlsoRequiresANonDevelopmentCursorSecret() {
		contextRunner
				.withPropertyValues(
						"spring.profiles.active=prod",
						"security.jwt.secret=production-jwt-secret",
						"shiftpay.cursor.secret=" + ProductionSecuritySecretsValidator.DEVELOPMENT_CURSOR_SECRET)
				.run(context -> {
					assertThat(context).hasFailed();
					assertThat(context.getStartupFailure()).hasStackTraceContaining("shiftpay.cursor.secret");
				});
	}

	@Test
	void nonDevelopmentProfileStartsWithExplicitProductionSecrets() {
		contextRunner
				.withPropertyValues(
						"spring.profiles.active=prod",
						"security.jwt.secret=" + STRONG_JWT_SECRET,
						"shiftpay.cursor.secret=" + STRONG_CURSOR_SECRET)
				.run(context -> assertThat(context).hasNotFailed());
	}

	@Test
	void explicitTestProfileMayUseBundledDefaults() {
		contextRunner
				.withPropertyValues(
						"spring.profiles.active=test",
						"security.jwt.secret=" + ProductionSecuritySecretsValidator.DEVELOPMENT_JWT_SECRET,
						"shiftpay.cursor.secret=" + ProductionSecuritySecretsValidator.DEVELOPMENT_CURSOR_SECRET)
				.run(context -> assertThat(context).hasNotFailed());
	}

	@Test
	void noActiveProfileStartsWithExplicitStrongSecrets() {
		contextRunner
				.withPropertyValues(
						"security.jwt.secret=" + STRONG_JWT_SECRET,
						"shiftpay.cursor.secret=" + STRONG_CURSOR_SECRET)
				.run(context -> assertThat(context).hasNotFailed());
	}

	@Test
	void noActiveProfileFailsFastWhenJwtSecretIsMissingOrBlank() {
		contextRunner
				.withPropertyValues("shiftpay.cursor.secret=" + STRONG_CURSOR_SECRET)
				.run(context -> {
					assertThat(context).hasFailed();
					assertThat(context.getStartupFailure()).hasStackTraceContaining("security.jwt.secret");
				});

		contextRunner
				.withPropertyValues(
						"security.jwt.secret=   ",
						"shiftpay.cursor.secret=" + STRONG_CURSOR_SECRET)
				.run(context -> {
					assertThat(context).hasFailed();
					assertThat(context.getStartupFailure()).hasStackTraceContaining("security.jwt.secret");
				});
	}

	@Test
	void noActiveProfileRejectsDevelopmentJwtSecret() {
		contextRunner
				.withPropertyValues(
						"security.jwt.secret=" + ProductionSecuritySecretsValidator.DEVELOPMENT_JWT_SECRET,
						"shiftpay.cursor.secret=" + STRONG_CURSOR_SECRET)
				.run(context -> {
					assertThat(context).hasFailed();
					assertThat(context.getStartupFailure()).hasStackTraceContaining("security.jwt.secret");
				});
	}

	@Test
	void noActiveProfileFailsFastWhenCursorSecretIsMissingBlankOrDevelopment() {
		contextRunner
				.withPropertyValues("security.jwt.secret=" + STRONG_JWT_SECRET)
				.run(context -> {
					assertThat(context).hasFailed();
					assertThat(context.getStartupFailure()).hasStackTraceContaining("shiftpay.cursor.secret");
				});

		contextRunner
				.withPropertyValues(
						"security.jwt.secret=" + STRONG_JWT_SECRET,
						"shiftpay.cursor.secret=   ")
				.run(context -> {
					assertThat(context).hasFailed();
					assertThat(context.getStartupFailure()).hasStackTraceContaining("shiftpay.cursor.secret");
				});

		contextRunner
				.withPropertyValues(
						"security.jwt.secret=" + STRONG_JWT_SECRET,
						"shiftpay.cursor.secret=" + ProductionSecuritySecretsValidator.DEVELOPMENT_CURSOR_SECRET)
				.run(context -> {
					assertThat(context).hasFailed();
					assertThat(context.getStartupFailure()).hasStackTraceContaining("shiftpay.cursor.secret");
				});
	}

	@Configuration(proxyBeanMethods = false)
	@Import(ProductionSecuritySecretsValidator.class)
	static class ValidatorConfiguration {
	}
}
