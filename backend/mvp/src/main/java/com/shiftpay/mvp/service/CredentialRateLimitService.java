package com.shiftpay.mvp.service;

import com.shiftpay.mvp.entity.CredentialSecurityEvent;
import com.shiftpay.mvp.entity.CredentialSecurityEventType;
import com.shiftpay.mvp.entity.User;
import com.shiftpay.mvp.exception.ApiErrorException;
import com.shiftpay.mvp.repository.CredentialSecurityEventRepository;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;

import java.time.Duration;
import java.time.Instant;

@Service
public class CredentialRateLimitService {

	private static final Duration PASSWORD_WINDOW = Duration.ofMinutes(15);
	private static final Duration START_WINDOW = Duration.ofHours(1);
	private static final Duration DELIVERY_WINDOW = Duration.ofHours(24);

	private final CredentialSecurityEventRepository repository;

	public CredentialRateLimitService(CredentialSecurityEventRepository repository) {
		this.repository = repository;
	}

	public void assertCurrentPasswordAllowed(User user, Instant now) {
		Instant threshold = now.minus(PASSWORD_WINDOW);
		if (repository.countByUserIdAndEventTypeAndOccurredAtGreaterThanEqual(
				user.getId(), CredentialSecurityEventType.CURRENT_PASSWORD_FAILURE, threshold) >= 5) {
			Instant oldest = repository
					.findFirstByUserIdAndEventTypeAndOccurredAtGreaterThanEqualOrderByOccurredAtAsc(
							user.getId(), CredentialSecurityEventType.CURRENT_PASSWORD_FAILURE, threshold)
					.orElseThrow()
					.getOccurredAt();
			throw rateLimited("CURRENT_PASSWORD_RATE_LIMITED", "Current password attempts are rate limited",
					retryAfter(oldest.plus(PASSWORD_WINDOW), now));
		}
	}

	public void recordCurrentPasswordFailure(User user, Instant now) {
		record(user, CredentialSecurityEventType.CURRENT_PASSWORD_FAILURE, null, now);
	}

	public void clearCurrentPasswordFailures(User user) {
		repository.deleteByUserIdAndType(user.getId(), CredentialSecurityEventType.CURRENT_PASSWORD_FAILURE);
	}

	public void assertEmailStartAllowed(User user, Instant now) {
		Instant threshold = now.minus(START_WINDOW);
		if (repository.countByUserIdAndEventTypeAndOccurredAtGreaterThanEqual(
				user.getId(), CredentialSecurityEventType.EMAIL_CHANGE_START, threshold) >= 3) {
			Instant oldest = repository
					.findFirstByUserIdAndEventTypeAndOccurredAtGreaterThanEqualOrderByOccurredAtAsc(
							user.getId(), CredentialSecurityEventType.EMAIL_CHANGE_START, threshold)
					.orElseThrow()
					.getOccurredAt();
			throw rateLimited("EMAIL_CHANGE_RATE_LIMITED", "Email change is rate limited",
					retryAfter(oldest.plus(START_WINDOW), now));
		}
	}

	public void assertTargetDeliveryAllowed(String target, Instant now) {
		Instant threshold = now.minus(DELIVERY_WINDOW);
		if (repository.countByNormalizedTargetEmailAndEventTypeAndOccurredAtGreaterThanEqual(
				target, CredentialSecurityEventType.EMAIL_VERIFICATION_DELIVERY, threshold) >= 5) {
			Instant oldest = repository
					.findFirstByNormalizedTargetEmailAndEventTypeAndOccurredAtGreaterThanEqualOrderByOccurredAtAsc(
							target, CredentialSecurityEventType.EMAIL_VERIFICATION_DELIVERY, threshold)
					.orElseThrow()
					.getOccurredAt();
			throw rateLimited("EMAIL_CHANGE_RATE_LIMITED", "Email change is rate limited",
					retryAfter(oldest.plus(DELIVERY_WINDOW), now));
		}
	}

	public void recordAcceptedStart(User user, String target, Instant now) {
		record(user, CredentialSecurityEventType.EMAIL_CHANGE_START, target, now);
		record(user, CredentialSecurityEventType.EMAIL_VERIFICATION_DELIVERY, target, now);
	}

	public void recordAcceptedDelivery(User user, String target, Instant now) {
		record(user, CredentialSecurityEventType.EMAIL_VERIFICATION_DELIVERY, target, now);
	}

	private void record(User user, CredentialSecurityEventType type, String target, Instant now) {
		CredentialSecurityEvent event = new CredentialSecurityEvent();
		event.setUser(user);
		event.setEventType(type);
		event.setNormalizedTargetEmail(target);
		event.setOccurredAt(now);
		repository.save(event);
	}

	private ApiErrorException rateLimited(String code, String message, long retryAfter) {
		return new ApiErrorException(HttpStatus.TOO_MANY_REQUESTS, code, message, retryAfter, null);
	}

	private long retryAfter(Instant availableAt, Instant now) {
		long millis = Math.max(1, Duration.between(now, availableAt).toMillis());
		return Math.max(1, (millis + 999) / 1000);
	}
}
