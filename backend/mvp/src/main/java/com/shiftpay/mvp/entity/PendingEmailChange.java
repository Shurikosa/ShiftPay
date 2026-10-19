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

@Getter
@Entity
@Table(name = "pending_email_changes")
public class PendingEmailChange {

	@Id
	@GeneratedValue(strategy = GenerationType.IDENTITY)
	private Long id;

	@Setter
	@OneToOne(fetch = FetchType.LAZY, optional = false)
	@JoinColumn(name = "user_id", nullable = false, unique = true)
	private User user;

	@Setter
	@Column(name = "normalized_new_email", nullable = false, length = 255)
	private String normalizedNewEmail;

	@Setter
	@Column(name = "verification_code_hash", nullable = false, length = 255)
	private String verificationCodeHash;

	@Setter
	@Column(name = "code_expires_at", nullable = false)
	private Instant codeExpiresAt;

	@Setter
	@Column(name = "expires_at", nullable = false)
	private Instant expiresAt;

	@Setter
	@Column(name = "resend_available_at", nullable = false)
	private Instant resendAvailableAt;

	@Setter
	@Column(name = "resend_count", nullable = false)
	private int resendCount;

	@Setter
	@Column(name = "failed_attempt_count", nullable = false)
	private int failedAttemptCount;

	@Column(name = "created_at", nullable = false, updatable = false)
	private Instant createdAt;

	@Column(name = "updated_at", nullable = false)
	private Instant updatedAt;

	@PrePersist
	void prePersist() {
		Instant now = Instant.now();
		createdAt = now;
		updatedAt = now;
	}

	@PreUpdate
	void preUpdate() {
		updatedAt = Instant.now();
	}
}
