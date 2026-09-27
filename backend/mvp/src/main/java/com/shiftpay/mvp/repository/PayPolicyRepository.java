package com.shiftpay.mvp.repository;

import com.shiftpay.mvp.entity.PayPolicy;
import jakarta.persistence.LockModeType;
import org.springframework.data.jpa.repository.EntityGraph;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.Optional;

/**
 * Repository for company pay policy roots.
 */
public interface PayPolicyRepository extends JpaRepository<PayPolicy, Long> {

	/**
	 * Finds the policy root for a company with its current version.
	 *
	 * @param companyId company id
	 * @return pay policy when present
	 */
	@EntityGraph(attributePaths = {"company", "currentVersion"})
	@Query("select policy from PayPolicy policy where policy.company.id = :companyId")
	Optional<PayPolicy> findByCompanyIdWithCurrentVersion(@Param("companyId") Long companyId);

	/**
	 * Locks the policy root for immutable-version updates.
	 *
	 * @param companyId company id
	 * @return locked pay policy root when present
	 */
	@Lock(LockModeType.PESSIMISTIC_WRITE)
	@Query("""
			select policy
			from PayPolicy policy
			join fetch policy.company
			left join fetch policy.currentVersion
			where policy.company.id = :companyId
			""")
	Optional<PayPolicy> findByCompanyIdForUpdate(@Param("companyId") Long companyId);
}
