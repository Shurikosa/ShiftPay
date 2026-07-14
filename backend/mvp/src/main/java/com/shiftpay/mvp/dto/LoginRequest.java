package com.shiftpay.mvp.dto;

import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

/**
 * Request DTO for user login.
 *
 * @param email required account email; the service trims and normalizes it to lowercase
 * @param password required plain password checked against the stored password hash
 */
public record LoginRequest(
		@NotBlank
		@Email
		@Size(max = 255)
		String email,

		@NotBlank
		@Size(max = 72)
		String password
) {
}
