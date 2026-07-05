package com.shiftpay.mvp.repository;

import com.shiftpay.mvp.entity.ShiftAttendance;
import org.springframework.data.jpa.repository.JpaRepository;

public interface ShiftAttendanceRepository extends JpaRepository<ShiftAttendance, Long> {

	boolean existsByShiftSessionIdAndWorkerId(Long shiftSessionId, Long workerId);
}
