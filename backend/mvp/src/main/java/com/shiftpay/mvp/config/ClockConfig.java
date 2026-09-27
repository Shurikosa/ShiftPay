package com.shiftpay.mvp.config;

import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

import java.time.Clock;

/**
 * Provides the application clock used by backend-owned lifecycle timestamps.
 */
@Configuration
public class ClockConfig {

	/**
	 * Uses UTC for persisted server timestamps.
	 *
	 * @return system UTC clock
	 */
	@Bean
	Clock clock() {
		return Clock.systemUTC();
	}
}
