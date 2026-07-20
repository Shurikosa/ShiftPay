package com.shiftpay.mvp.dto;

import com.shiftpay.mvp.entity.Role;
import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

/**
 * Request DTO for public user registration.
 *
 * <p>Only {@code WORKER} and {@code FOREMAN} roles are accepted by public registration. Passwords are plain text in
 * the request and are hashed before storage.</p>
 *
 * @param email required account email; the service trims and normalizes it to lowercase
 * @param password required plain password to hash, limited to BCrypt-supported length
 * @param firstName required first name shown in API responses
 * @param lastName required last name shown in API responses
 * @param role requested public role, limited by service rules
 */
public record RegisterRequest(
		@NotBlank
		@Email
		String email,

		@NotBlank
		@Size(min = 8, max = 72)
		String password,

		@NotBlank
		@Size(max = 100)
		String firstName,

		@NotBlank
		@Size(max = 100)
		String lastName,

		@NotNull
		Role role
) {
}
