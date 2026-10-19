package com.shiftpay.mvp.repository;

import com.shiftpay.mvp.entity.PendingEmailChange;
import jakarta.persistence.LockModeType;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.Optional;

public interface PendingEmailChangeRepository extends JpaRepository<PendingEmailChange, Long> {

	Optional<PendingEmailChange> findByUserId(Long userId);

	@Lock(LockModeType.PESSIMISTIC_WRITE)
	@Query("select change from PendingEmailChange change where change.user.id = :userId")
	Optional<PendingEmailChange> findByUserIdForUpdate(@Param("userId") Long userId);
}
