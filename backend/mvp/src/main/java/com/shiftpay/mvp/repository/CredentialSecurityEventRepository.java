package com.shiftpay.mvp.repository;

import com.shiftpay.mvp.entity.CredentialSecurityEvent;
import com.shiftpay.mvp.entity.CredentialSecurityEventType;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.time.Instant;
import java.util.Optional;

public interface CredentialSecurityEventRepository extends JpaRepository<CredentialSecurityEvent, Long> {

	long countByUserIdAndEventTypeAndOccurredAtGreaterThanEqual(
			Long userId,
			CredentialSecurityEventType eventType,
			Instant threshold
	);

	long countByNormalizedTargetEmailAndEventTypeAndOccurredAtGreaterThanEqual(
			String target,
			CredentialSecurityEventType eventType,
			Instant threshold
	);

	Optional<CredentialSecurityEvent> findFirstByUserIdAndEventTypeAndOccurredAtGreaterThanEqualOrderByOccurredAtAsc(
			Long userId,
			CredentialSecurityEventType eventType,
			Instant threshold
	);

	Optional<CredentialSecurityEvent> findFirstByNormalizedTargetEmailAndEventTypeAndOccurredAtGreaterThanEqualOrderByOccurredAtAsc(
			String target,
			CredentialSecurityEventType eventType,
			Instant threshold
	);

	@Modifying
	@Query("delete from CredentialSecurityEvent event where event.user.id = :userId and event.eventType = :type")
	void deleteByUserIdAndType(@Param("userId") Long userId, @Param("type") CredentialSecurityEventType type);
}
