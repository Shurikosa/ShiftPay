package com.shiftpay.mvp.repository;

import com.shiftpay.mvp.entity.User;
import jakarta.persistence.LockModeType;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.EntityGraph;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.Optional;

/**
 * Repository for {@link User} entities.
 *
 * <p>Authentication uses email lookup, and registration uses email existence checks for conflict handling.</p>
 */
public interface UserRepository extends JpaRepository<User, Long> {

	/**
	 * Loads a user and company by id.
	 *
	 * @param id user id
	 * @return user with company when present
	 */
	@EntityGraph(attributePaths = "company")
	@Query("select user from User user where user.id = :id")
	Optional<User> findWithCompanyById(@Param("id") Long id);

	/**
	 * Finds a user by normalized email.
	 *
	 * @param email normalized email address
	 * @return user when present
	 */
	Optional<User> findByEmail(String email);

	/**
	 * Finds a user by normalized email and fetches their company for auth response DTOs.
	 *
	 * @param email normalized email address
	 * @return user with company when present
	 */
	@EntityGraph(attributePaths = "company")
	@Query("select user from User user where user.email = :email")
	Optional<User> findWithCompanyByEmail(@Param("email") String email);

	/**
	 * Checks whether a normalized email is already registered.
	 *
	 * @param email normalized email address
	 * @return true when the email is already used
	 */
	boolean existsByEmail(String email);

	/**
	 * Loads a user by id with a pessimistic write lock for company assignment workflows.
	 *
	 * @param id user id
	 * @return locked user when present
	 */
	@Lock(LockModeType.PESSIMISTIC_WRITE)
	@Query("select user from User user left join fetch user.company where user.id = :id")
	Optional<User> findByIdWithCompanyForUpdate(@Param("id") Long id);
}
