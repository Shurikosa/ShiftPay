package com.shiftpay.mvp.service;

import java.time.Instant;
import java.util.HashSet;
import java.util.List;
import java.util.Objects;
import java.util.Set;
import java.util.stream.Stream;

/**
 * Pure premium calculation input for overtime allocation.
 *
 * @param previousFinalizedIntervals previous CLOSED/payroll-finalized payable intervals
 * @param currentInterval payable interval currently being calculated
 */
public record PremiumPayCalculationContext(
		List<PremiumPayableInterval> previousFinalizedIntervals,
		PremiumPayableInterval currentInterval
) {

	private static final long CURRENT_ONLY_STABLE_ID = 0L;

	public PremiumPayCalculationContext {
		previousFinalizedIntervals = List.copyOf(Objects.requireNonNull(
				previousFinalizedIntervals,
				"previousFinalizedIntervals"
		));
		Objects.requireNonNull(currentInterval, "currentInterval");
		if (!currentInterval.current()) {
			throw new IllegalArgumentException("currentInterval must be marked current");
		}
		Set<Long> stableIds = new HashSet<>();
		requireUniqueStableId(currentInterval, stableIds);
		for (PremiumPayableInterval interval : previousFinalizedIntervals) {
			Objects.requireNonNull(interval, "previousFinalizedIntervals contains null");
			if (interval.current()) {
				throw new IllegalArgumentException("previousFinalizedIntervals must not contain current intervals");
			}
			requireUniqueStableId(interval, stableIds);
		}
	}

	/**
	 * Creates context containing only the current payable interval.
	 *
	 * @param intervalStart current interval start
	 * @param intervalEnd current interval end
	 * @return calculation context
	 */
	public static PremiumPayCalculationContext currentOnly(Instant intervalStart, Instant intervalEnd) {
		return new PremiumPayCalculationContext(
				List.of(),
				PremiumPayableInterval.current(CURRENT_ONLY_STABLE_ID, intervalStart, intervalStart, intervalStart, intervalEnd)
		);
	}

	/**
	 * Creates context with previous finalized intervals and the current interval.
	 *
	 * @param previousFinalizedIntervals previous finalized intervals
	 * @param currentInterval current interval
	 * @return calculation context
	 */
	public static PremiumPayCalculationContext of(
			List<PremiumPayableInterval> previousFinalizedIntervals,
			PremiumPayableInterval currentInterval
	) {
		return new PremiumPayCalculationContext(previousFinalizedIntervals, currentInterval);
	}

	/**
	 * Returns previous finalized intervals plus the current interval.
	 *
	 * @return all intervals in this calculation context
	 */
	public List<PremiumPayableInterval> allIntervals() {
		return Stream.concat(previousFinalizedIntervals.stream(), Stream.of(currentInterval)).toList();
	}

	private void requireUniqueStableId(PremiumPayableInterval interval, Set<Long> stableIds) {
		if (!stableIds.add(interval.stableId())) {
			throw new IllegalArgumentException("stableId must be unique across calculation context");
		}
	}
}
