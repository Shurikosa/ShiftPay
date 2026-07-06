package com.shiftpay.mvp.repository;

import com.shiftpay.mvp.entity.ShiftAttendance;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Optional;

public interface ShiftAttendanceRepository extends JpaRepository<ShiftAttendance, Long> {

	boolean existsByShiftSessionIdAndWorkerId(Long shiftSessionId, Long workerId);

	Optional<ShiftAttendance> findByIdAndShiftSessionId(Long id, Long shiftSessionId);
}
