package com.shiftpay.mvp.repository;

import com.shiftpay.mvp.entity.PayoutRequestItem;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.Collection;
import java.util.List;

/**
 * Repository for payout request item snapshots.
 */
public interface PayoutRequestItemRepository extends JpaRepository<PayoutRequestItem, Long> {

	/**
	 * Loads item snapshots for a set of payout request headers.
	 *
	 * @param requestIds payout request ids
	 * @return items ordered by parent request and item id
	 */
	@Query("""
			select item
			from PayoutRequestItem item
			join fetch item.payoutRequest request
			join fetch item.attendance attendance
			join fetch item.shiftSession shiftSession
			join fetch shiftSession.createdBy
			where request.id in :requestIds
			order by request.id asc, item.id asc
			""")
	List<PayoutRequestItem> findAllByPayoutRequestIdInWithDetails(
			@Param("requestIds") Collection<Long> requestIds
	);

	/**
	 * Loads item snapshots for one payout request.
	 *
	 * @param requestId payout request id
	 * @return items ordered by id
	 */
	@Query("""
			select item
			from PayoutRequestItem item
			join fetch item.attendance attendance
			join fetch item.shiftSession shiftSession
			join fetch shiftSession.createdBy
			where item.payoutRequest.id = :requestId
			order by item.id asc
			""")
	List<PayoutRequestItem> findAllByPayoutRequestIdWithDetails(@Param("requestId") Long requestId);
}
