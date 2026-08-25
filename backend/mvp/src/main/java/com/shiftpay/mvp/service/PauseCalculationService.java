package com.shiftpay.mvp.service;

import com.shiftpay.mvp.entity.PauseScope;
import com.shiftpay.mvp.entity.ShiftPauseInterval;
import org.springframework.stereotype.Service;

import java.time.Duration;
import java.time.OffsetDateTime;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.List;
import java.util.Objects;

/**
 * Calculates effective pause minutes by merging applicable pause intervals.
 */
@Service
public class PauseCalculationService {

	/**
	 * Calculates union pause minutes for one user, clipped to the supplied shift window.
	 *
	 * @param intervals intervals for the shift
	 * @param userId user whose effective pause time is being calculated
	 * @param windowStart shift actual start time
	 * @param windowEnd shift actual end time or current effective end time
	 * @return whole pause minutes after merging overlaps
	 */
	public int calculateEffectivePauseMinutes(
			List<ShiftPauseInterval> intervals,
			Long userId,
			OffsetDateTime windowStart,
			OffsetDateTime windowEnd
	) {
		if (windowStart == null || windowEnd == null || !windowEnd.isAfter(windowStart)) {
			return 0;
		}

		List<IntervalRange> ranges = intervals.stream()
				.filter((interval) -> appliesToUser(interval, userId))
				.map((interval) -> clip(interval, windowStart, windowEnd))
				.filter(Objects::nonNull)
				.sorted(Comparator.comparing(IntervalRange::start))
				.toList();
		if (ranges.isEmpty()) {
			return 0;
		}

		List<IntervalRange> merged = new ArrayList<>();
		for (IntervalRange range : ranges) {
			if (merged.isEmpty()) {
				merged.add(range);
				continue;
			}

			IntervalRange last = merged.getLast();
			if (!range.start().isAfter(last.end())) {
				merged.set(merged.size() - 1, new IntervalRange(last.start(), max(last.end(), range.end())));
			}
			else {
				merged.add(range);
			}
		}

		long totalMinutes = merged.stream()
				.mapToLong((range) -> Duration.between(range.start(), range.end()).toMinutes())
				.sum();
		return Math.toIntExact(totalMinutes);
	}

	private boolean appliesToUser(ShiftPauseInterval interval, Long userId) {
		if (interval.getScope() == PauseScope.ALL) {
			return true;
		}
		return interval.getUser() != null && Objects.equals(interval.getUser().getId(), userId);
	}

	private IntervalRange clip(
			ShiftPauseInterval interval,
			OffsetDateTime windowStart,
			OffsetDateTime windowEnd
	) {
		OffsetDateTime start = max(interval.getStartedAt(), windowStart);
		OffsetDateTime end = min(interval.getEndedAt() == null ? windowEnd : interval.getEndedAt(), windowEnd);
		if (!end.isAfter(start)) {
			return null;
		}
		return new IntervalRange(start, end);
	}

	private OffsetDateTime min(OffsetDateTime first, OffsetDateTime second) {
		return first.isBefore(second) ? first : second;
	}

	private OffsetDateTime max(OffsetDateTime first, OffsetDateTime second) {
		return first.isAfter(second) ? first : second;
	}

	private record IntervalRange(OffsetDateTime start, OffsetDateTime end) {
	}
}
