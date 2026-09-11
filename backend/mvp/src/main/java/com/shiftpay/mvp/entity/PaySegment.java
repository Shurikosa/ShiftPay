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
import jakarta.persistence.Table;
import lombok.Getter;
import lombok.Setter;

import java.math.BigDecimal;
import java.time.Instant;
import java.time.OffsetDateTime;

/**
 * Persisted premium pay segment snapshot.
 */
@Getter
@Entity
@Table(name = "pay_segments")
public class PaySegment {

	@Id
	@GeneratedValue(strategy = GenerationType.IDENTITY)
	private Long id;

	@Setter
	@ManyToOne(fetch = FetchType.LAZY, optional = false)
	@JoinColumn(name = "pay_calculation_id", nullable = false)
	private PayCalculation payCalculation;

	@Setter
	@Column(name = "segment_start", nullable = false)
	private OffsetDateTime start;

	@Setter
	@Column(name = "segment_end", nullable = false)
	private OffsetDateTime end;

	@Setter
	@Column(name = "payable_seconds", nullable = false, precision = 18, scale = 9)
	private BigDecimal payableSeconds;

	@Setter
	@Column(name = "payable_minutes", nullable = false)
	private Long payableMinutes;

	@Setter
	@Column(name = "payable_minutes_exact", nullable = false, precision = 18, scale = 8)
	private BigDecimal payableMinutesExact;

	@Setter
	@Column(name = "base_hourly_rate", nullable = false, precision = 12, scale = 2)
	private BigDecimal baseHourlyRate;

	@Setter
	@Column(name = "applied_rules_snapshot", nullable = false)
	private String appliedRulesSnapshot;

	@Setter
	@Enumerated(EnumType.STRING)
	@Column(name = "stacking_strategy", nullable = false, length = 32)
	private PayPolicyStackingStrategy stackingStrategy;

	@Setter
	@Column(name = "effective_premium_percent", nullable = false, precision = 14, scale = 4)
	private BigDecimal effectivePremiumPercent;

	@Setter
	@Column(name = "effective_hourly_rate", nullable = false, precision = 14, scale = 8)
	private BigDecimal effectiveHourlyRate;

	@Setter
	@Column(name = "base_amount", nullable = false, precision = 20, scale = 8)
	private BigDecimal baseAmount;

	@Setter
	@Column(name = "premium_amount", nullable = false, precision = 20, scale = 8)
	private BigDecimal premiumAmount;

	@Setter
	@Column(name = "total_amount", nullable = false, precision = 20, scale = 8)
	private BigDecimal totalAmount;

	@Column(name = "created_at", nullable = false, updatable = false)
	private Instant createdAt;

	/**
	 * Sets creation timestamp before the segment snapshot is first persisted.
	 */
	@PrePersist
	void prePersist() {
		createdAt = Instant.now();
	}
}
