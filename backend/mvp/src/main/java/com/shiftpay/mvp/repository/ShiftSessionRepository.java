package com.shiftpay.mvp.repository;

import com.shiftpay.mvp.entity.ShiftSession;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Optional;

public interface ShiftSessionRepository extends JpaRepository<ShiftSession, Long> {

	boolean existsByJoinCode(String joinCode);

	Optional<ShiftSession> findByJoinCode(String joinCode);
}
