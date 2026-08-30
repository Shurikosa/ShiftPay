package com.shiftpay.mvp.repository;

import com.shiftpay.mvp.entity.ShiftAttendance;
import jakarta.persistence.LockModeType;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.Collection;
import java.util.List;
import java.util.Optional;

/**
 * Repository for {@link ShiftAttendance} rows.
 *
 * <p>Custom queries support duplicate join checks, attendance management, close-time salary calculation, personal
 * shift history, and closed-shift summaries without exposing entities directly through controllers.</p>
 */
public interface ShiftAttendanceRepository extends JpaRepository<ShiftAttendance, Long> {

	/**
	 * Checks whether a worker already has attendance for a shift.
	 *
	 * @param shiftSessionId shift session id
	 * @param workerId worker user id
	 * @return true when the worker has already joined that shift
	 */
	boolean existsByShiftSessionIdAndWorkerId(Long shiftSessionId, Long workerId);

	/**
	 * Loads one worker attendance row for participation checks.
	 *
	 * @param shiftSessionId shift session id
	 * @param workerId worker user id
	 * @return attendance row when the worker joined the shift
	 */
	@Query("""
			select attendance
			from ShiftAttendance attendance
			join fetch attendance.shiftSession shiftSession
			join fetch shiftSession.company
			where attendance.shiftSession.id = :shiftSessionId
			  and attendance.worker.id = :workerId
			""")
	Optional<ShiftAttendance> findByShiftSessionIdAndWorkerId(
			@Param("shiftSessionId") Long shiftSessionId,
			@Param("workerId") Long workerId
	);

	/**
	 * Loads one attendance row by attendance id and shift id with a pessimistic write lock.
	 *
	 * <p>Approval uses this to serialize concurrent approval attempts and to return not found when the URL shift id
	 * does not match the attendance row.</p>
	 *
	 * @param attendanceId attendance id from the URL
	 * @param shiftId shift session id from the URL
	 * @return locked attendance row when it exists for the shift
	 */
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

	/**
	 * Loads all attendance rows for a shift with pessimistic write locks.
	 *
	 * <p>Close shift uses this after locking the shift session so salary fields are written consistently.</p>
	 *
	 * @param shiftId shift session id
	 * @return locked attendance rows ordered by id
	 */
	@Lock(LockModeType.PESSIMISTIC_WRITE)
	@Query("""
			select attendance
			from ShiftAttendance attendance
			where attendance.shiftSession.id = :shiftId
			order by attendance.id asc
			""")
	List<ShiftAttendance> findAllByShiftSessionIdForUpdate(@Param("shiftId") Long shiftId);

	/**
	 * Lists attendance for shift management and fetches worker identity in the same query.
	 *
	 * @param shiftId shift session id
	 * @return attendance rows ordered by join time and id
	 */
	@Query("""
			select attendance
			from ShiftAttendance attendance
			join fetch attendance.worker
			where attendance.shiftSession.id = :shiftId
			order by attendance.joinedAt asc, attendance.id asc
			""")
	List<ShiftAttendance> findAllByShiftSessionIdWithWorker(@Param("shiftId") Long shiftId);

	/**
	 * Lists the current user's worker-attendance history and fetches shift details in the same query.
	 *
	 * @param workerId current authenticated user id
	 * @return attendance history for OPEN, ACTIVE, CLOSED, and CANCELLED shifts, newest joins first
	 */
	@Query("""
			select attendance
			from ShiftAttendance attendance
			join fetch attendance.shiftSession shiftSession
			join fetch shiftSession.company
			where attendance.worker.id = :workerId
			  and shiftSession.status in (
				com.shiftpay.mvp.entity.ShiftStatus.OPEN,
				com.shiftpay.mvp.entity.ShiftStatus.ACTIVE,
				com.shiftpay.mvp.entity.ShiftStatus.CLOSED,
				com.shiftpay.mvp.entity.ShiftStatus.CANCELLED
			  )
			order by attendance.joinedAt desc, attendance.id desc
			""")
	List<ShiftAttendance> findMyShiftHistoryByWorkerId(@Param("workerId") Long workerId);

	/**
	 * Lists payable closed attendance for the worker payroll screen.
	 *
	 * @param workerId current worker id
	 * @param companyId current worker company id
	 * @return payable attendance ordered by closed shift end time and id
	 */
	@Query("""
			select attendance
			from ShiftAttendance attendance
			join fetch attendance.shiftSession shiftSession
			join fetch shiftSession.company
			join fetch shiftSession.createdBy
			where attendance.worker.id = :workerId
			  and shiftSession.company.id = :companyId
			  and attendance.status = com.shiftpay.mvp.entity.AttendanceStatus.APPROVED
			  and shiftSession.status = com.shiftpay.mvp.entity.ShiftStatus.CLOSED
			  and attendance.paymentStatus = com.shiftpay.mvp.entity.PaymentStatus.UNPAID
			  and attendance.workedMinutes is not null
			  and attendance.calculatedSalary is not null
			order by shiftSession.actualEndTime desc, attendance.id desc
			""")
	List<ShiftAttendance> findPayableByWorkerIdAndCompanyId(
			@Param("workerId") Long workerId,
			@Param("companyId") Long companyId
	);

	/**
	 * Loads selected attendance rows for a worker payout preview.
	 *
	 * @param attendanceIds selected attendance ids
	 * @param workerId current worker id
	 * @return selected attendance owned by the worker
	 */
	@Query("""
			select attendance
			from ShiftAttendance attendance
			join fetch attendance.worker worker
			left join fetch worker.company
			join fetch attendance.shiftSession shiftSession
			join fetch shiftSession.company
			join fetch shiftSession.createdBy
			where attendance.id in :attendanceIds
			  and worker.id = :workerId
			""")
	List<ShiftAttendance> findSelectedByIdsAndWorkerIdWithDetails(
			@Param("attendanceIds") Collection<Long> attendanceIds,
			@Param("workerId") Long workerId
	);

	/**
	 * Locks selected attendance rows before payout request creation.
	 *
	 * @param attendanceIds selected attendance ids
	 * @param workerId current worker id
	 * @return locked selected attendance owned by the worker
	 */
	@Lock(LockModeType.PESSIMISTIC_WRITE)
	@Query("""
			select attendance
			from ShiftAttendance attendance
			join fetch attendance.worker worker
			left join fetch worker.company
			join fetch attendance.shiftSession shiftSession
			join fetch shiftSession.company
			join fetch shiftSession.createdBy
			where attendance.id in :attendanceIds
			  and worker.id = :workerId
			""")
	List<ShiftAttendance> findSelectedByIdsAndWorkerIdForUpdate(
			@Param("attendanceIds") Collection<Long> attendanceIds,
			@Param("workerId") Long workerId
	);

	/**
	 * Locks attendance rows selected by a payout request during approval.
	 *
	 * @param attendanceIds selected attendance ids
	 * @return locked attendance rows with shift details
	 */
	@Lock(LockModeType.PESSIMISTIC_WRITE)
	@Query("""
			select attendance
			from ShiftAttendance attendance
			join fetch attendance.shiftSession shiftSession
			join fetch shiftSession.company
			join fetch shiftSession.createdBy
			where attendance.id in :attendanceIds
			""")
	List<ShiftAttendance> findAllByIdInForUpdate(@Param("attendanceIds") Collection<Long> attendanceIds);

	/**
	 * Lists approved attendance for a closed shift summary and fetches worker identity in the same query.
	 *
	 * @param shiftId shift session id
	 * @return approved attendance rows ordered by worker name and id
	 */
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
