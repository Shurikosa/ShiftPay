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

/**
 * Immutable premium rule snapshot for one pay policy version.
 */
@Getter
@Entity
@Table(name = "pay_policy_rules")
public class PayPolicyRule {

	@Id
	@GeneratedValue(strategy = GenerationType.IDENTITY)
	private Long id;

	@Setter
	@ManyToOne(fetch = FetchType.LAZY, optional = false)
	@JoinColumn(name = "pay_policy_version_id", nullable = false)
	private PayPolicyVersion payPolicyVersion;

	@Setter
	@Column(nullable = false, length = 255)
	private String name;

	@Setter
	@Enumerated(EnumType.STRING)
	@Column(nullable = false, length = 32)
	private PayPolicyRuleType type;

	@Setter
	@Column(nullable = false)
	private boolean enabled;

	@Setter
	@Column(name = "premium_percent", nullable = false, precision = 14, scale = 4)
	private BigDecimal premiumPercent;

	@Setter
	@Column(name = "condition_config", nullable = false)
	private String conditionConfig;

	@Setter
	@Column(name = "sort_order", nullable = false)
	private Integer sortOrder;

	@Column(name = "created_at", nullable = false, updatable = false)
	private Instant createdAt;

	/**
	 * Sets creation timestamp before the rule is first persisted.
	 */
	@PrePersist
	void prePersist() {
		createdAt = Instant.now();
	}
}
