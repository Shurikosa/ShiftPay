package com.shiftpay.mvp.repository;

import com.shiftpay.mvp.entity.ShiftPauseInterval;
import jakarta.persistence.LockModeType;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.List;
import java.util.Optional;

/**
 * Repository for persisted shift pause intervals.
 */
public interface ShiftPauseIntervalRepository extends JpaRepository<ShiftPauseInterval, Long> {

	/**
	 * Finds an active ALL pause for a shift with a write lock.
	 *
	 * @param shiftId shift session id
	 * @return active global pause when present
	 */
	@Lock(LockModeType.PESSIMISTIC_WRITE)
	@Query("""
			select pauseInterval
			from ShiftPauseInterval pauseInterval
			where pauseInterval.shiftSession.id = :shiftId
			  and pauseInterval.scope = com.shiftpay.mvp.entity.PauseScope.ALL
			  and pauseInterval.endedAt is null
			order by pauseInterval.startedAt desc, pauseInterval.id desc
			""")
	Optional<ShiftPauseInterval> findActiveAllForUpdate(@Param("shiftId") Long shiftId);

	/**
	 * Finds an active personal pause for one user on one shift with a write lock.
	 *
	 * @param shiftId shift session id
	 * @param userId user id targeted by the pause
	 * @return active personal pause when present
	 */
	@Lock(LockModeType.PESSIMISTIC_WRITE)
	@Query("""
			select pauseInterval
			from ShiftPauseInterval pauseInterval
			where pauseInterval.shiftSession.id = :shiftId
			  and pauseInterval.scope = com.shiftpay.mvp.entity.PauseScope.PERSONAL
			  and pauseInterval.user.id = :userId
			  and pauseInterval.endedAt is null
			order by pauseInterval.startedAt desc, pauseInterval.id desc
			""")
	Optional<ShiftPauseInterval> findActivePersonalForUpdate(
			@Param("shiftId") Long shiftId,
			@Param("userId") Long userId
	);

	/**
	 * Lists all pause intervals for a shift with locks for close-time auto-ending and salary calculation.
	 *
	 * @param shiftId shift session id
	 * @return locked pause intervals ordered by start time and id
	 */
	@Lock(LockModeType.PESSIMISTIC_WRITE)
	@Query("""
			select pauseInterval
			from ShiftPauseInterval pauseInterval
			left join fetch pauseInterval.user
			where pauseInterval.shiftSession.id = :shiftId
			order by pauseInterval.startedAt asc, pauseInterval.id asc
			""")
	List<ShiftPauseInterval> findAllByShiftSessionIdForUpdate(@Param("shiftId") Long shiftId);

	/**
	 * Lists all pause intervals for a shift for DTO pause-state mapping.
	 *
	 * @param shiftId shift session id
	 * @return pause intervals ordered by start time and id
	 */
	@Query("""
			select pauseInterval
			from ShiftPauseInterval pauseInterval
			left join fetch pauseInterval.user
			where pauseInterval.shiftSession.id = :shiftId
			order by pauseInterval.startedAt asc, pauseInterval.id asc
			""")
	List<ShiftPauseInterval> findAllByShiftSessionId(@Param("shiftId") Long shiftId);

	/**
	 * Lists all pause intervals for several shifts for dashboard/history DTO pause-state mapping.
	 *
	 * @param shiftIds shift ids
	 * @return pause intervals ordered by shift and start time
	 */
	@Query("""
			select pauseInterval
			from ShiftPauseInterval pauseInterval
			left join fetch pauseInterval.user
			where pauseInterval.shiftSession.id in :shiftIds
			order by pauseInterval.shiftSession.id asc, pauseInterval.startedAt asc, pauseInterval.id asc
			""")
	List<ShiftPauseInterval> findAllByShiftSessionIdIn(@Param("shiftIds") List<Long> shiftIds);

}
