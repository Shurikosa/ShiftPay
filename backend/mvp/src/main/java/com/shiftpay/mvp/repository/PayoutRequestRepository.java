package com.shiftpay.mvp.repository;

import com.shiftpay.mvp.entity.PayoutRequest;
import com.shiftpay.mvp.entity.PayoutRequestStatus;
import jakarta.persistence.LockModeType;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.List;
import java.util.Optional;

/**
 * Repository for payout request headers.
 */
public interface PayoutRequestRepository extends JpaRepository<PayoutRequest, Long> {

	/**
	 * Lists payout requests created by one worker.
	 *
	 * @param workerId current worker id
	 * @param status optional status filter
	 * @return worker payout requests ordered newest first
	 */
	@Query("""
			select request
			from PayoutRequest request
			join fetch request.company
			join fetch request.worker
			join fetch request.managerForeman
			where request.worker.id = :workerId
			  and (:status is null or request.status = :status)
			order by request.requestedAt desc, request.id desc
			""")
	List<PayoutRequest> findByWorkerIdWithDetails(
			@Param("workerId") Long workerId,
			@Param("status") PayoutRequestStatus status
	);

	/**
	 * Lists managed payout requests for one foreman and company.
	 *
	 * @param foremanId current foreman id
	 * @param companyId current foreman's company id
	 * @param status required status filter
	 * @return managed payout requests ordered oldest first for review
	 */
	@Query("""
			select request
			from PayoutRequest request
			join fetch request.company
			join fetch request.worker
			join fetch request.managerForeman
			where request.managerForeman.id = :foremanId
			  and request.company.id = :companyId
			  and request.status = :status
			order by request.requestedAt asc, request.id asc
			""")
	List<PayoutRequest> findManagedByForemanIdAndCompanyIdWithDetails(
			@Param("foremanId") Long foremanId,
			@Param("companyId") Long companyId,
			@Param("status") PayoutRequestStatus status
	);

	/**
	 * Locks a payout request header before approval.
	 *
	 * @param requestId payout request id
	 * @return locked request header when found
	 */
	@Lock(LockModeType.PESSIMISTIC_WRITE)
	@Query("""
			select request
			from PayoutRequest request
			join fetch request.company
			join fetch request.worker
			join fetch request.managerForeman
			where request.id = :requestId
			""")
	Optional<PayoutRequest> findByIdForUpdate(@Param("requestId") Long requestId);
}
