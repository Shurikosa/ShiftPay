package com.shiftpay.mvp.service;

import com.shiftpay.mvp.entity.EmailIdentityLock;
import com.shiftpay.mvp.repository.EmailIdentityLockRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;

@Service
public class EmailIdentityLockInitializer {

	private final EmailIdentityLockRepository repository;

	public EmailIdentityLockInitializer(EmailIdentityLockRepository repository) {
		this.repository = repository;
	}

	@Transactional(propagation = Propagation.REQUIRES_NEW)
	public void insertIfMissing(String normalizedEmail) {
		if (!repository.existsById(normalizedEmail)) {
			repository.saveAndFlush(new EmailIdentityLock(normalizedEmail));
		}
	}
}
