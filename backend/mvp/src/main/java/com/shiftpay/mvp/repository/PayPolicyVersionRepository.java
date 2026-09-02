package com.shiftpay.mvp.repository;

import com.shiftpay.mvp.entity.PayPolicyVersion;
import jakarta.persistence.LockModeType;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.List;
import java.util.Optional;

/**
 * Repository for immutable pay policy versions.
 */
public interface PayPolicyVersionRepository extends JpaRepository<PayPolicyVersion, Long> {

	/**
	 * Loads the current policy version with its rules for a company.
	 *
	 * @param companyId company id
	 * @return current policy version when the invariant is intact
	 */
	@Query("""
			select distinct policyVersion
			from PayPolicy policy
			join policy.currentVersion policyVersion
			join fetch policyVersion.company
			left join fetch policyVersion.rules
			where policy.company.id = :companyId
			""")
	Optional<PayPolicyVersion> findCurrentByCompanyIdWithRules(@Param("companyId") Long companyId);

	/**
	 * Locks the current policy version while starting a shift.
	 *
	 * @param companyId company id
	 * @return locked current versions
	 */
	@Lock(LockModeType.PESSIMISTIC_WRITE)
	@Query("""
			select policyVersion
			from PayPolicy policy
			join policy.currentVersion policyVersion
			where policy.company.id = :companyId
			""")
	List<PayPolicyVersion> findCurrentByCompanyIdForUpdate(@Param("companyId") Long companyId);

	/**
	 * Lists all policy versions with rules for the company, newest version first.
	 *
	 * @param companyId company id
	 * @return policy versions ordered for audit display
	 */
	@Query("""
			select distinct policyVersion
			from PayPolicyVersion policyVersion
			join fetch policyVersion.company
			left join fetch policyVersion.rules
			where policyVersion.company.id = :companyId
			order by policyVersion.version desc, policyVersion.id desc
			""")
	List<PayPolicyVersion> findByCompanyIdWithRulesOrderByVersionDesc(@Param("companyId") Long companyId);

	/**
	 * Finds the highest version number for a policy root.
	 *
	 * @param payPolicyId pay policy root id
	 * @return maximum version number, or null for an empty policy
	 */
	@Query("select max(policyVersion.version) from PayPolicyVersion policyVersion where policyVersion.payPolicy.id = :payPolicyId")
	Integer findMaxVersionByPayPolicyId(@Param("payPolicyId") Long payPolicyId);
}
