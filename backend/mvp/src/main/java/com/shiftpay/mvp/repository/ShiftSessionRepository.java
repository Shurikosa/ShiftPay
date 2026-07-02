package com.shiftpay.mvp.repository;

import com.shiftpay.mvp.entity.ShiftSession;
import org.springframework.data.jpa.repository.JpaRepository;

public interface ShiftSessionRepository extends JpaRepository<ShiftSession, Long> {

	boolean existsByJoinCode(String joinCode);
}
