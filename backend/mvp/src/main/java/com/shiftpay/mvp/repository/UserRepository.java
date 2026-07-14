package com.shiftpay.mvp.repository;

import com.shiftpay.mvp.entity.User;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Optional;

/**
 * Repository for {@link User} entities.
 *
 * <p>Authentication uses email lookup, and registration uses email existence checks for conflict handling.</p>
 */
public interface UserRepository extends JpaRepository<User, Long> {

	/**
	 * Finds a user by normalized email.
	 *
	 * @param email normalized email address
	 * @return user when present
	 */
	Optional<User> findByEmail(String email);

	/**
	 * Checks whether a normalized email is already registered.
	 *
	 * @param email normalized email address
	 * @return true when the email is already used
	 */
	boolean existsByEmail(String email);
}
