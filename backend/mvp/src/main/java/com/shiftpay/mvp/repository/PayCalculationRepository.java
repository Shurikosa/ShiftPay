package com.shiftpay.mvp.repository;

import com.shiftpay.mvp.entity.PayCalculation;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.Collection;
import java.util.List;
import java.util.Optional;

/**
 * Repository for persisted worker pay calculation snapshots.
 */
public interface PayCalculationRepository extends JpaRepository<PayCalculation, Long> {

	/**
	 * Loads one calculation snapshot by attendance id with segments.
	 *
	 * @param attendanceId attendance id
	 * @return calculation snapshot when one was persisted
	 */
	@Query("""
			select distinct calculation
			from PayCalculation calculation
			left join fetch calculation.segments
			where calculation.attendance.id = :attendanceId
			""")
	Optional<PayCalculation> findByAttendanceIdWithSegments(@Param("attendanceId") Long attendanceId);

	/**
	 * Loads calculation snapshots for all attendance rows on a shift.
	 *
	 * @param shiftSessionId shift session id
	 * @return calculations with segments
	 */
	@Query("""
			select distinct calculation
			from PayCalculation calculation
			left join fetch calculation.segments
			where calculation.shiftSession.id = :shiftSessionId
			""")
	List<PayCalculation> findAllByShiftSessionIdWithSegments(@Param("shiftSessionId") Long shiftSessionId);

	/**
	 * Loads calculation snapshots for attendance rows with segments.
	 *
	 * @param attendanceIds attendance ids
	 * @return calculations with segments
	 */
	@Query("""
			select distinct calculation
			from PayCalculation calculation
			join fetch calculation.attendance
			left join fetch calculation.segments
			where calculation.attendance.id in :attendanceIds
			""")
	List<PayCalculation> findAllByAttendanceIdInWithSegments(@Param("attendanceIds") Collection<Long> attendanceIds);

	/**
	 * Loads calculation snapshots for projection-based attendance reads.
	 *
	 * <p>Segments are fetch-joined in one bounded query. The query deliberately does not fetch or materialize
	 * {@code ShiftAttendance}; scalar attendance projections already supply the response fields and ids used to map
	 * these snapshots.</p>
	 *
	 * @param attendanceIds finalized attendance ids whose snapshots may be returned
	 * @return calculation snapshots with segments
	 */
	@Query("""
			select distinct calculation
			from PayCalculation calculation
			left join fetch calculation.segments
			where calculation.attendance.id in :attendanceIds
			""")
	List<PayCalculation> findAllByAttendanceIdInWithSegmentsForRead(@Param("attendanceIds") Collection<Long> attendanceIds);

	/**
	 * Removes an existing calculation snapshot for recalculating a not-yet-closed attendance in the same transaction.
	 *
	 * @param attendanceId attendance id
	 */
	void deleteByAttendanceId(Long attendanceId);
}
