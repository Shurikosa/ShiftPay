package com.shiftpay.mvp.repository;

import com.shiftpay.mvp.entity.ShiftAttendance;
import jakarta.persistence.LockModeType;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.List;
import java.util.Optional;

public interface ShiftAttendanceRepository extends JpaRepository<ShiftAttendance, Long> {

	boolean existsByShiftSessionIdAndWorkerId(Long shiftSessionId, Long workerId);

	@Lock(LockModeType.PESSIMISTIC_WRITE)
	@Query("""
			select attendance
			from ShiftAttendance attendance
			where attendance.id = :attendanceId
			  and attendance.shiftSession.id = :shiftId
			""")
	Optional<ShiftAttendance> findByIdAndShiftSessionIdForUpdate(
			@Param("attendanceId") Long attendanceId,
			@Param("shiftId") Long shiftId
	);

	@Lock(LockModeType.PESSIMISTIC_WRITE)
	@Query("""
			select attendance
			from ShiftAttendance attendance
			where attendance.shiftSession.id = :shiftId
			order by attendance.id asc
			""")
	List<ShiftAttendance> findAllByShiftSessionIdForUpdate(@Param("shiftId") Long shiftId);

	@Query("""
			select attendance
			from ShiftAttendance attendance
			join fetch attendance.worker
			where attendance.shiftSession.id = :shiftId
			order by attendance.joinedAt asc, attendance.id asc
			""")
	List<ShiftAttendance> findAllByShiftSessionIdWithWorker(@Param("shiftId") Long shiftId);

	@Query("""
			select attendance
			from ShiftAttendance attendance
			join fetch attendance.shiftSession shiftSession
			where attendance.worker.id = :workerId
			  and shiftSession.status in (
				com.shiftpay.mvp.entity.ShiftStatus.OPEN,
				com.shiftpay.mvp.entity.ShiftStatus.ACTIVE,
				com.shiftpay.mvp.entity.ShiftStatus.CLOSED
			  )
			order by attendance.joinedAt desc, attendance.id desc
			""")
	List<ShiftAttendance> findMyShiftHistoryByWorkerId(@Param("workerId") Long workerId);

	@Query("""
			select attendance
			from ShiftAttendance attendance
			join fetch attendance.worker worker
			where attendance.shiftSession.id = :shiftId
			  and attendance.status = com.shiftpay.mvp.entity.AttendanceStatus.APPROVED
			order by worker.lastName asc, worker.firstName asc, worker.id asc
			""")
	List<ShiftAttendance> findApprovedByShiftSessionIdWithWorkerOrderByWorkerName(
			@Param("shiftId") Long shiftId
	);
}
