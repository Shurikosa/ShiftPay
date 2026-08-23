package com.shiftpay.mvp.repository;

import com.shiftpay.mvp.entity.Company;
import jakarta.persistence.LockModeType;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.Optional;

/**
 * Repository for {@link Company} entities.
 */
public interface CompanyRepository extends JpaRepository<Company, Long> {

	/**
	 * Checks whether a generated company join code is already assigned.
	 *
	 * @param joinCode generated join code
	 * @return true when the join code is already in use
	 */
	boolean existsByJoinCode(String joinCode);

	/**
	 * Finds a company by normalized join code.
	 *
	 * @param joinCode normalized company join code
	 * @return matching company when present
	 */
	Optional<Company> findByJoinCode(String joinCode);

	/**
	 * Locks a company by normalized join code for worker join workflows.
	 *
	 * @param joinCode normalized company join code
	 * @return locked company when present
	 */
	@Lock(LockModeType.PESSIMISTIC_WRITE)
	@Query("select company from Company company where company.joinCode = :joinCode")
	Optional<Company> findByJoinCodeForUpdate(@Param("joinCode") String joinCode);
}
