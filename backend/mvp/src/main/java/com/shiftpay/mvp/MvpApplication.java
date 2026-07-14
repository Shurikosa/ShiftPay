package com.shiftpay.mvp;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;

/**
 * Entry point for the ShiftPay backend MVP Spring Boot application.
 */
@SpringBootApplication
public class MvpApplication {

	/**
	 * Starts the Spring Boot application and loads the API, security, persistence, and Flyway configuration.
	 *
	 * @param args command-line arguments passed by the JVM or Maven wrapper
	 */
	public static void main(String[] args) {
		SpringApplication.run(MvpApplication.class, args);
	}

}
