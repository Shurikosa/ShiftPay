package com.shiftpay.mvp.dto;

import com.shiftpay.mvp.entity.Role;
import com.shiftpay.mvp.entity.User;

/**
 * Response DTO for public user data.
 *
 * <p>Used by registration, login, and current-user endpoints. It intentionally excludes {@code passwordHash}.</p>
 *
 * @param id user id
 * @param email normalized email address
 * @param firstName user's first name
 * @param lastName user's last name
 * @param role user's application role
 */
public record UserResponse(
		Long id,
		String email,
		String firstName,
		String lastName,
		Role role
) {

	/**
	 * Maps a user entity to its public response DTO.
	 *
	 * @param user user entity
	 * @return public user response without password hash
	 */
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
