package com.shiftpay.mvp.dto;

import com.shiftpay.mvp.entity.Role;
import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

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
