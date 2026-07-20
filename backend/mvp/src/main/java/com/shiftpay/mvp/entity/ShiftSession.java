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
import jakarta.persistence.PrePersist;
import jakarta.persistence.PreUpdate;
import jakarta.persistence.Table;
import lombok.Getter;
import lombok.Setter;

import java.math.BigDecimal;
import java.time.Instant;
import java.time.OffsetDateTime;

/**
 * Shift session entity managed by a foreman or admin.
 *
 * <p>The session owns lifecycle timestamps, join code, default break and hourly-rate values, and is the parent for
 * worker attendance rows.</p>
 */
@Getter
@Entity
@Table(name = "shift_sessions")
public class ShiftSession {

	@Id
	@GeneratedValue(strategy = GenerationType.IDENTITY)
	private Long id;

	@Setter
	@ManyToOne(fetch = FetchType.LAZY, optional = false)
	@JoinColumn(name = "company_id", nullable = false)
	private Company company;

	@Setter
	@Column(nullable = false, length = 255)
	private String title;

	@Setter
	@Column(length = 255)
	private String location;

	@Setter
	@Column(name = "join_code", nullable = false, unique = true, length = 32)
	private String joinCode;

	@Setter
	@Enumerated(EnumType.STRING)
	@Column(nullable = false, length = 32)
	private ShiftStatus status;

	@Setter
	@Column(name = "planned_start_time")
	private OffsetDateTime plannedStartTime;

	@Setter
	@Column(name = "planned_end_time")
	private OffsetDateTime plannedEndTime;

	@Setter
	@Column(name = "actual_start_time")
	private OffsetDateTime actualStartTime;

	@Setter
	@Column(name = "actual_end_time")
	private OffsetDateTime actualEndTime;

	@Setter
	@Column(name = "default_break_minutes", nullable = false)
	private Integer defaultBreakMinutes;

	@Setter
	@Column(name = "default_hourly_rate", nullable = false, precision = 12, scale = 2)
	private BigDecimal defaultHourlyRate;

	@Setter
	@ManyToOne(fetch = FetchType.LAZY, optional = false)
	@JoinColumn(name = "created_by", nullable = false)
	private User createdBy;

	@Column(name = "created_at", nullable = false, updatable = false)
	private Instant createdAt;

	@Column(name = "updated_at", nullable = false)
	private Instant updatedAt;

	/**
	 * Sets creation and update timestamps before the shift is first persisted.
	 */
	@PrePersist
	void prePersist() {
		Instant now = Instant.now();
		createdAt = now;
		updatedAt = now;
	}

	/**
	 * Refreshes the update timestamp before an existing shift is stored.
	 */
	@PreUpdate
	void preUpdate() {
		updatedAt = Instant.now();
	}
}
