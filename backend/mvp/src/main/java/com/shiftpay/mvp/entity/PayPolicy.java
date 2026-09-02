package com.shiftpay.mvp.entity;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.FetchType;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.OneToOne;
import jakarta.persistence.PrePersist;
import jakarta.persistence.PreUpdate;
import jakarta.persistence.Table;
import lombok.Getter;
import lombok.Setter;

import java.time.Instant;

/**
 * Company-owned pay policy root.
 *
 * <p>The mutable pointer is {@code currentVersion}. Individual policy versions and rules are immutable snapshots.</p>
 */
@Getter
@Entity
@Table(name = "pay_policies")
public class PayPolicy {

	@Id
	@GeneratedValue(strategy = GenerationType.IDENTITY)
	private Long id;

	@Setter
	@OneToOne(fetch = FetchType.LAZY, optional = false)
	@JoinColumn(name = "company_id", nullable = false)
	private Company company;

	@Setter
	@OneToOne(fetch = FetchType.LAZY)
	@JoinColumn(name = "current_version_id")
	private PayPolicyVersion currentVersion;

	@Column(name = "created_at", nullable = false, updatable = false)
	private Instant createdAt;

	@Column(name = "updated_at", nullable = false)
	private Instant updatedAt;

	/**
	 * Sets creation and update timestamps before the policy root is first persisted.
	 */
	@PrePersist
	void prePersist() {
		Instant now = Instant.now();
		createdAt = now;
		updatedAt = now;
	}

	/**
	 * Refreshes the update timestamp before storing current-version changes.
	 */
	@PreUpdate
	void preUpdate() {
		updatedAt = Instant.now();
	}
}
