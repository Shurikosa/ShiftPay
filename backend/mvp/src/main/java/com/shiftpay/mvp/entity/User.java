package com.shiftpay.mvp.entity;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.PrePersist;
import jakarta.persistence.PreUpdate;
import jakarta.persistence.Table;
import lombok.Getter;
import lombok.Setter;

import java.time.Instant;

/**
 * User account entity for authentication and role-based authorization.
 *
 * <p>Controllers never return this entity directly because it contains the password hash. Public responses use
 * {@code UserResponse} instead.</p>
 */
@Getter
@Entity
@Table(name = "users")
public class User {

	@Id
	@GeneratedValue(strategy = GenerationType.IDENTITY)
	private Long id;

	@Setter
	@Column(nullable = false, unique = true, length = 255)
	private String email;

	@Setter
	@Column(name = "password_hash", nullable = false, length = 255)
	private String passwordHash;

	@Setter
	@Column(name = "first_name", nullable = false, length = 100)
	private String firstName;

	@Setter
	@Column(name = "last_name", nullable = false, length = 100)
	private String lastName;

	@Setter
	@Enumerated(EnumType.STRING)
	@Column(nullable = false, length = 32)
	private Role role;

	@Column(name = "created_at", nullable = false, updatable = false)
	private Instant createdAt;

	@Column(name = "updated_at", nullable = false)
	private Instant updatedAt;

	/**
	 * Sets creation and update timestamps before the user is first persisted.
	 */
	@PrePersist
	void prePersist() {
		Instant now = Instant.now();
		createdAt = now;
		updatedAt = now;
	}

	/**
	 * Refreshes the update timestamp before an existing user is stored.
	 */
	@PreUpdate
	void preUpdate() {
		updatedAt = Instant.now();
	}

}
