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
import jakarta.persistence.Table;
import lombok.Getter;
import lombok.Setter;

import java.time.DayOfWeek;
import java.time.Instant;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.List;

/**
 * Immutable pay policy version owned by a company.
 */
@Getter
@Entity
@Table(name = "pay_policy_versions")
public class PayPolicyVersion {

	@Id
	@GeneratedValue(strategy = GenerationType.IDENTITY)
	private Long id;

	@Setter
	@ManyToOne(fetch = FetchType.LAZY, optional = false)
	@JoinColumn(name = "pay_policy_id", nullable = false)
	private PayPolicy payPolicy;

	@Setter
	@ManyToOne(fetch = FetchType.LAZY, optional = false)
	@JoinColumn(name = "company_id", nullable = false)
	private Company company;

	@Setter
	@Column(nullable = false)
	private Integer version;

	@Setter
	@Enumerated(EnumType.STRING)
	@Column(name = "week_starts_on", nullable = false, length = 16)
	private DayOfWeek weekStartsOn;

	@Setter
	@Enumerated(EnumType.STRING)
	@Column(name = "stacking_strategy", nullable = false, length = 32)
	private PayPolicyStackingStrategy stackingStrategy;

	@Setter
	@ManyToOne(fetch = FetchType.LAZY)
	@JoinColumn(name = "created_by")
	private User createdBy;

	@OneToMany(mappedBy = "payPolicyVersion", cascade = CascadeType.ALL, orphanRemoval = true)
	private List<PayPolicyRule> rules = new ArrayList<>();

	@Column(name = "created_at", nullable = false, updatable = false)
	private Instant createdAt;

	/**
	 * Adds an immutable rule snapshot to this version.
	 *
	 * @param rule rule snapshot to attach
	 */
	public void addRule(PayPolicyRule rule) {
		rule.setPayPolicyVersion(this);
		rules.add(rule);
	}

	/**
	 * Returns rules ordered by their stable sort order and id tie-breaker.
	 *
	 * @return sorted immutable rule snapshots
	 */
	public List<PayPolicyRule> sortedRules() {
		return rules.stream()
				.sorted(Comparator.comparing(PayPolicyRule::getSortOrder).thenComparing(PayPolicyRule::getId))
				.toList();
	}

	/**
	 * Sets creation timestamp before the version is first persisted.
	 */
	@PrePersist
	void prePersist() {
		createdAt = Instant.now();
	}
}
