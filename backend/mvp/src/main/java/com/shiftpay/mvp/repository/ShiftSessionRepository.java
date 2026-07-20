package com.shiftpay.mvp.repository;

import com.shiftpay.mvp.entity.ShiftSession;
import jakarta.persistence.LockModeType;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.Optional;

/**
 * Repository for {@link ShiftSession} entities.
 *
 * <p>Custom lock queries are used for lifecycle transitions and worker joins to keep shift state changes serialized.</p>
 */
public interface ShiftSessionRepository extends JpaRepository<ShiftSession, Long> {

	/**
	 * Checks whether a generated join code is already assigned to a shift.
	 *
	 * @param joinCode generated join code
	 * @return true when the join code is already in use
	 */
	boolean existsByJoinCode(String joinCode);

	/**
	 * Loads a shift by id with a pessimistic write lock for start, close, and approval workflows.
	 *
	 * @param shiftId shift session id
	 * @return locked shift session when it exists
	 */
	@Lock(LockModeType.PESSIMISTIC_WRITE)
	@Query("select shiftSession from ShiftSession shiftSession where shiftSession.id = :shiftId")
	Optional<ShiftSession> findByIdForUpdate(@Param("shiftId") Long shiftId);

	/**
	 * Loads a shift by join code with a pessimistic write lock for worker join.
	 *
	 * @param joinCode normalized join code
	 * @return locked shift session when the code exists
	 */
	@Lock(LockModeType.PESSIMISTIC_WRITE)
	@Query("select shiftSession from ShiftSession shiftSession where shiftSession.joinCode = :joinCode")
	Optional<ShiftSession> findByJoinCodeForUpdate(@Param("joinCode") String joinCode);
}
