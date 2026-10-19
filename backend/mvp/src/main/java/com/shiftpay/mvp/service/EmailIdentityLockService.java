package com.shiftpay.mvp.service;

import com.shiftpay.mvp.repository.EmailIdentityLockRepository;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.stereotype.Service;

@Service
public class EmailIdentityLockService {

	private final EmailIdentityLockRepository repository;
	private final EmailIdentityLockInitializer initializer;

	public EmailIdentityLockService(
			EmailIdentityLockRepository repository,
			EmailIdentityLockInitializer initializer
	) {
		this.repository = repository;
		this.initializer = initializer;
	}

	public void acquire(String normalizedEmail) {
		try {
			initializer.insertIfMissing(normalizedEmail);
		}
		catch (DataIntegrityViolationException exception) {
			// A concurrent transaction created the same lock row first.
		}
		repository.findByEmailForUpdate(normalizedEmail)
				.orElseThrow(() -> new IllegalStateException("Email identity lock was not created"));
	}
}
