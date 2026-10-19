package com.shiftpay.mvp.entity;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.FetchType;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.Table;
import lombok.Getter;
import lombok.Setter;

import java.time.Instant;

@Getter
@Entity
@Table(name = "credential_security_events")
public class CredentialSecurityEvent {

	@Id
	@GeneratedValue(strategy = GenerationType.IDENTITY)
	private Long id;

	@Setter
	@ManyToOne(fetch = FetchType.LAZY, optional = false)
	@JoinColumn(name = "user_id", nullable = false)
	private User user;

	@Setter
	@Enumerated(EnumType.STRING)
	@Column(name = "event_type", nullable = false, length = 64)
	private CredentialSecurityEventType eventType;

	@Setter
	@Column(name = "normalized_target_email", length = 255)
	private String normalizedTargetEmail;

	@Setter
	@Column(name = "occurred_at", nullable = false)
	private Instant occurredAt;
}
