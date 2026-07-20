package com.shiftpay.mvp.entity;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
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
 * Company entity used to group shift sessions.
 *
 * <p>The MVP currently creates and reuses a default company, while the schema keeps this entity ready for later
 * admin-managed companies.</p>
 */
@Getter
@Entity
@Table(name = "companies")
public class Company {

	@Id
	@GeneratedValue(strategy = GenerationType.IDENTITY)
	private Long id;

	@Setter
	@Column(nullable = false, length = 255)
	private String name;

	@Column(name = "created_at", nullable = false, updatable = false)
	private Instant createdAt;

	@Column(name = "updated_at", nullable = false)
	private Instant updatedAt;

	/**
	 * Sets creation and update timestamps before the company is first persisted.
	 */
	@PrePersist
	void prePersist() {
		Instant now = Instant.now();
		createdAt = now;
		updatedAt = now;
	}

	/**
	 * Refreshes the update timestamp before an existing company is stored.
	 */
	@PreUpdate
	void preUpdate() {
		updatedAt = Instant.now();
	}
}
