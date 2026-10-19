package com.shiftpay.mvp.service;

import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

@Configuration
public class EmailDeliveryConfig {

	@Bean
	@ConditionalOnProperty(
			name = "shiftpay.email.smtp.enabled",
			havingValue = "false",
			matchIfMissing = true
	)
	EmailChangeDelivery unavailableEmailChangeDelivery() {
		return message -> false;
	}
}
