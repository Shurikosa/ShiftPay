package com.shiftpay.mvp.entity;

import jakarta.persistence.CascadeType;
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
import jakarta.persistence.OneToMany;
import jakarta.persistence.PrePersist;
import jakarta.persistence.PreUpdate;
import jakarta.persistence.Table;
import lombok.Getter;
import lombok.Setter;

import java.math.BigDecimal;
import java.time.Instant;
import java.time.OffsetDateTime;
import java.util.ArrayList;
import java.util.List;

/**
 * Worker payout request header with approval state and backend-calculated totals.
 */
@Getter
@Entity
@Table(name = "payout_requests")
public class PayoutRequest {

	@Id
	@GeneratedValue(strategy = GenerationType.IDENTITY)
	private Long id;

	@Setter
	@ManyToOne(fetch = FetchType.LAZY, optional = false)
	@JoinColumn(name = "company_id", nullable = false)
	private Company company;

	@Setter
	@ManyToOne(fetch = FetchType.LAZY, optional = false)
	@JoinColumn(name = "worker_id", nullable = false)
	private User worker;

	@Setter
	@ManyToOne(fetch = FetchType.LAZY, optional = false)
	@JoinColumn(name = "manager_foreman_id", nullable = false)
	private User managerForeman;

	@Setter
	@Enumerated(EnumType.STRING)
	@Column(nullable = false, length = 32)
	private PayoutRequestStatus status;

	@Setter
	@Column(name = "raw_payable_minutes_total", nullable = false)
	private Integer rawPayableMinutesTotal;

	@Setter
	@Column(name = "payout_rounded_minutes_total", nullable = false)
	private Integer payoutRoundedMinutesTotal;

	@Setter
	@Column(name = "exact_calculated_amount_total", nullable = false, precision = 12, scale = 2)
	private BigDecimal exactCalculatedAmountTotal;

	@Setter
	@Column(name = "payout_amount", nullable = false, precision = 12, scale = 0)
	private BigDecimal payoutAmount;

	@Setter
	@Column(name = "requested_at", nullable = false)
	private OffsetDateTime requestedAt;

	@Setter
	@ManyToOne(fetch = FetchType.LAZY)
	@JoinColumn(name = "approved_by")
	private User approvedBy;

	@Setter
	@Column(name = "approved_at")
	private OffsetDateTime approvedAt;

	@Setter
	@Column(name = "paid_at")
	private OffsetDateTime paidAt;

	@OneToMany(mappedBy = "payoutRequest", cascade = CascadeType.ALL, orphanRemoval = true)
	private List<PayoutRequestItem> items = new ArrayList<>();

	@Column(name = "created_at", nullable = false, updatable = false)
	private Instant createdAt;

	@Column(name = "updated_at", nullable = false)
	private Instant updatedAt;

	/**
	 * Adds an item snapshot to this request and sets the owning side.
	 *
	 * @param item payout request item to append
	 */
	public void addItem(PayoutRequestItem item) {
		item.setPayoutRequest(this);
		items.add(item);
	}

	/**
	 * Sets creation and update timestamps before the request is first persisted.
	 */
	@PrePersist
	void prePersist() {
		Instant now = Instant.now();
		createdAt = now;
		updatedAt = now;
	}

	/**
	 * Refreshes the update timestamp before an existing request is stored.
	 */
	@PreUpdate
	void preUpdate() {
		updatedAt = Instant.now();
	}
}
