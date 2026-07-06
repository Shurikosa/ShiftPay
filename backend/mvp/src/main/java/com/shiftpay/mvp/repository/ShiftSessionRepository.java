package com.shiftpay.mvp.repository;

import com.shiftpay.mvp.entity.ShiftSession;
import jakarta.persistence.LockModeType;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.Optional;

public interface ShiftSessionRepository extends JpaRepository<ShiftSession, Long> {

	boolean existsByJoinCode(String joinCode);

	@Lock(LockModeType.PESSIMISTIC_WRITE)
	@Query("select shiftSession from ShiftSession shiftSession where shiftSession.id = :shiftId")
	Optional<ShiftSession> findByIdForUpdate(@Param("shiftId") Long shiftId);

	@Lock(LockModeType.PESSIMISTIC_WRITE)
	@Query("select shiftSession from ShiftSession shiftSession where shiftSession.joinCode = :joinCode")
	Optional<ShiftSession> findByJoinCodeForUpdate(@Param("joinCode") String joinCode);
}
