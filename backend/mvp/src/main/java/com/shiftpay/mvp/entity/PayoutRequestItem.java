package com.shiftpay.mvp.entity;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
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
 * Snapshot of one attendance row included in a payout request.
 */
@Getter
@Entity
@Table(name = "payout_request_items")
public class PayoutRequestItem {

	@Id
	@GeneratedValue(strategy = GenerationType.IDENTITY)
	private Long id;

	@Setter
	@ManyToOne(fetch = FetchType.LAZY, optional = false)
	@JoinColumn(name = "payout_request_id", nullable = false)
	private PayoutRequest payoutRequest;

	@Setter
	@ManyToOne(fetch = FetchType.LAZY, optional = false)
	@JoinColumn(name = "attendance_id", nullable = false)
	private ShiftAttendance attendance;

	@Setter
	@ManyToOne(fetch = FetchType.LAZY, optional = false)
	@JoinColumn(name = "shift_session_id", nullable = false)
	private ShiftSession shiftSession;

	@Setter
	@Column(name = "shift_title", nullable = false, length = 255)
	private String shiftTitle;

	@Setter
	@Column(name = "shift_actual_start_time", nullable = false)
	private OffsetDateTime shiftActualStartTime;

	@Setter
	@Column(name = "shift_actual_end_time", nullable = false)
	private OffsetDateTime shiftActualEndTime;

	@Setter
	@Column(name = "raw_payable_minutes", nullable = false)
	private Integer rawPayableMinutes;

	@Setter
	@Column(name = "payout_rounded_minutes", nullable = false)
	private Integer payoutRoundedMinutes;

	@Setter
	@Column(name = "hourly_rate", nullable = false, precision = 12, scale = 2)
	private BigDecimal hourlyRate;

	@Setter
	@Column(name = "calculated_salary", nullable = false, precision = 12, scale = 2)
	private BigDecimal calculatedSalary;

	@Setter
	@Column(name = "rounded_item_amount_exact", nullable = false, precision = 12, scale = 4)
	private BigDecimal roundedItemAmountExact;

	@Setter
	@Column(name = "payout_amount", nullable = false, precision = 12, scale = 0)
	private BigDecimal payoutAmount;

	@Setter
	@Column(name = "paid_at")
	private OffsetDateTime paidAt;

	@Column(name = "created_at", nullable = false, updatable = false)
	private Instant createdAt;

	/**
	 * Sets creation timestamp before the item is first persisted.
	 */
	@PrePersist
	void prePersist() {
		createdAt = Instant.now();
	}
}
