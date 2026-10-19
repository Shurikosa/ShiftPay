package com.shiftpay.mvp.repository;

import com.shiftpay.mvp.entity.EmailIdentityLock;
import jakarta.persistence.LockModeType;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.Optional;

public interface EmailIdentityLockRepository extends JpaRepository<EmailIdentityLock, String> {

	@Lock(LockModeType.PESSIMISTIC_WRITE)
	@Query("select emailLock from EmailIdentityLock emailLock where emailLock.normalizedEmail = :email")
	Optional<EmailIdentityLock> findByEmailForUpdate(@Param("email") String email);
}
