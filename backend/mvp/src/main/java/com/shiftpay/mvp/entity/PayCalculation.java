package com.shiftpay.mvp.entity;

import jakarta.persistence.CascadeType;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.FetchType;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.OneToMany;
import jakarta.persistence.OneToOne;
import jakarta.persistence.PrePersist;
import jakarta.persistence.Table;
import lombok.Getter;
import lombok.Setter;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.ArrayList;
import java.util.List;

/**
 * Persisted premium pay snapshot for one worker attendance row.
 */
@Getter
@Entity
@Table(name = "pay_calculations")
public class PayCalculation {

	@Id
	@GeneratedValue(strategy = GenerationType.IDENTITY)
	private Long id;

	@Setter
	@OneToOne(fetch = FetchType.LAZY, optional = false)
	@JoinColumn(name = "attendance_id", nullable = false)
	private ShiftAttendance attendance;

	@Setter
	@ManyToOne(fetch = FetchType.LAZY, optional = false)
	@JoinColumn(name = "shift_session_id", nullable = false)
	private ShiftSession shiftSession;

	@Setter
	@ManyToOne(fetch = FetchType.LAZY, optional = false)
	@JoinColumn(name = "pay_policy_version_id", nullable = false)
	private PayPolicyVersion payPolicyVersion;

	@Setter
	@Column(name = "total_raw_seconds", nullable = false, precision = 18, scale = 9)
	private BigDecimal totalRawSeconds;

	@Setter
	@Column(name = "total_raw_minutes_exact", nullable = false, precision = 18, scale = 8)
	private BigDecimal totalRawMinutesExact;

	@Setter
	@Column(name = "total_base_amount", nullable = false, precision = 20, scale = 8)
	private BigDecimal totalBaseAmount;

	@Setter
	@Column(name = "total_premium_amount", nullable = false, precision = 20, scale = 8)
	private BigDecimal totalPremiumAmount;

	@Setter
	@Column(name = "total_amount", nullable = false, precision = 20, scale = 8)
	private BigDecimal totalAmount;

	@OneToMany(mappedBy = "payCalculation", cascade = CascadeType.ALL, orphanRemoval = true)
	private List<PaySegment> segments = new ArrayList<>();

	@Column(name = "created_at", nullable = false, updatable = false)
	private Instant createdAt;

	/**
	 * Sets creation timestamp before the calculation snapshot is first persisted.
	 */
	@PrePersist
	void prePersist() {
		createdAt = Instant.now();
	}
}
