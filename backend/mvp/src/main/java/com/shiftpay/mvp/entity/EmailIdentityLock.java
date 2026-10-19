package com.shiftpay.mvp.entity;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import lombok.Getter;
import lombok.NoArgsConstructor;

@Getter
@Entity
@Table(name = "email_identity_locks")
@NoArgsConstructor
public class EmailIdentityLock {

	@Id
	@Column(name = "normalized_email", nullable = false, length = 255)
	private String normalizedEmail;

	public EmailIdentityLock(String normalizedEmail) {
		this.normalizedEmail = normalizedEmail;
	}
}
