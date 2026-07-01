package com.shiftpay.mvp.dto;

import com.shiftpay.mvp.entity.Role;
import com.shiftpay.mvp.entity.User;

public record UserResponse(
		Long id,
		String email,
		String firstName,
		String lastName,
		Role role
) {

	public static UserResponse from(User user) {
		return new UserResponse(
				user.getId(),
				user.getEmail(),
				user.getFirstName(),
				user.getLastName(),
				user.getRole()
		);
	}
}
