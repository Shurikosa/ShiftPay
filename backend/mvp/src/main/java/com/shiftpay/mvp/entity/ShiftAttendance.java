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
 * Attendance entity connecting a worker to one shift session.
 *
 * <p>It stores the worker's status, hourly-rate snapshot or override, break minutes, and close-time salary results.
 * Only approved attendance receives worked minutes and calculated salary when a shift is closed.</p>
 */
@Getter
@Entity
@Table(name = "shift_attendance")
public class ShiftAttendance {

	@Id
	@GeneratedValue(strategy = GenerationType.IDENTITY)
	private Long id;

	@Setter
	@ManyToOne(fetch = FetchType.LAZY, optional = false)
	@JoinColumn(name = "shift_session_id", nullable = false)
	private ShiftSession shiftSession;

	@Setter
	@ManyToOne(fetch = FetchType.LAZY, optional = false)
	@JoinColumn(name = "worker_id", nullable = false)
	private User worker;

	@Setter
	@Enumerated(EnumType.STRING)
	@Column(nullable = false, length = 32)
	private AttendanceStatus status;

	@Setter
	@Column(name = "hourly_rate", nullable = false, precision = 12, scale = 2)
	private BigDecimal hourlyRate;

	@Setter
	@Column(name = "break_minutes", nullable = false)
	private Integer breakMinutes;

	@Setter
	@Column(name = "worked_minutes")
	private Integer workedMinutes;

	@Setter
	@Column(name = "calculated_salary", precision = 12, scale = 2)
	private BigDecimal calculatedSalary;

	@Setter
	@Column(name = "joined_at", nullable = false)
	private OffsetDateTime joinedAt;

	@Setter
	@Column(name = "approved_at")
	private OffsetDateTime approvedAt;

	@Column(name = "created_at", nullable = false, updatable = false)
	private Instant createdAt;

	@Column(name = "updated_at", nullable = false)
	private Instant updatedAt;

	/**
	 * Sets creation and update timestamps before the attendance row is first persisted.
	 */
	@PrePersist
	void prePersist() {
		Instant now = Instant.now();
		createdAt = now;
		updatedAt = now;
	}

	/**
	 * Refreshes the update timestamp before an existing attendance row is stored.
	 */
	@PreUpdate
	void preUpdate() {
		updatedAt = Instant.now();
	}
}
