package com.shiftpay.mvp.service;

import com.shiftpay.mvp.dto.PauseStateResponse;
import com.shiftpay.mvp.entity.PauseScope;
import com.shiftpay.mvp.entity.ShiftPauseInterval;
import com.shiftpay.mvp.entity.ShiftSession;
import org.springframework.stereotype.Component;

import java.time.OffsetDateTime;
import java.time.ZoneOffset;
import java.util.List;
import java.util.Objects;

/**
 * Builds pause state DTO fragments from persisted pause intervals.
 */
@Component
public class PauseViewFactory {

	private final PauseCalculationService pauseCalculationService;

	/**
	 * Creates the factory with the union pause calculation service.
	 *
	 * @param pauseCalculationService service used to calculate effective pause minutes
	 */
	public PauseViewFactory(PauseCalculationService pauseCalculationService) {
		this.pauseCalculationService = pauseCalculationService;
	}

	/**
	 * Builds pause state for one user's view of a shift.
	 *
	 * @param shiftSession shift session
	 * @param intervals pause intervals for the shift
	 * @param userId user whose personal pause state should be shown, or null
	 * @param persistedPauseMinutes close-time persisted pause minutes, or null before close
	 * @return pause state DTO
	 */
	public PauseStateResponse forUser(
			ShiftSession shiftSession,
			List<ShiftPauseInterval> intervals,
			Long userId,
			Integer persistedPauseMinutes
	) {
		return forUser(shiftSession, intervals, userId, persistedPauseMinutes, shiftSession.getActualStartTime());
	}

	/**
	 * Builds pause state from scalar shift fields used by projection-based readers.
	 *
	 * <p>Active all and personal pause flags come from the persisted intervals. When no close-time pause total exists,
	 * the effective pause total is calculated from {@code effectiveWindowStart} to {@code actualEndTime}, falling back
	 * to the current UTC time while the shift has no actual end time.</p>
	 *
	 * @param actualEndTime actual shift end time, or null while the shift remains open
	 * @param intervals persisted pause intervals for the shift
	 * @param userId user whose personal pause state should be shown, or null
	 * @param persistedPauseMinutes close-time persisted pause minutes, or null before close
	 * @param effectiveWindowStart start of the current payable/effective pause window, or null when unavailable
	 * @return pause state DTO
	 */
	public PauseStateResponse forUser(
			OffsetDateTime actualEndTime,
			List<ShiftPauseInterval> intervals,
			Long userId,
			Integer persistedPauseMinutes,
			OffsetDateTime effectiveWindowStart
	) {
		OffsetDateTime allPauseStartedAt = activeAllPauseStartedAt(intervals);
		OffsetDateTime personalPauseStartedAt = userId == null ? null : activePersonalPauseStartedAt(intervals, userId);
		Integer effectivePauseMinutes = persistedPauseMinutes;
		if (effectivePauseMinutes == null && userId != null && effectiveWindowStart != null) {
			OffsetDateTime windowEnd = actualEndTime == null ? OffsetDateTime.now(ZoneOffset.UTC) : actualEndTime;
			effectivePauseMinutes = pauseCalculationService.calculateEffectivePauseMinutes(
					intervals,
					userId,
					effectiveWindowStart,
					windowEnd
			);
		}

		return new PauseStateResponse(
				allPauseStartedAt != null,
				allPauseStartedAt,
				personalPauseStartedAt != null,
				personalPauseStartedAt,
				effectivePauseMinutes
		);
	}

	/**
	 * Builds pause state for one user's view of a shift using a caller-selected effective pause window start.
	 *
	 * @param shiftSession shift session
	 * @param intervals pause intervals for the shift
	 * @param userId user whose personal pause state should be shown, or null
	 * @param persistedPauseMinutes close-time persisted pause minutes, or null before close
	 * @param effectiveWindowStart start of the current payable/effective pause window, or null when unavailable
	 * @return pause state DTO
	 */
	public PauseStateResponse forUser(
			ShiftSession shiftSession,
			List<ShiftPauseInterval> intervals,
			Long userId,
			Integer persistedPauseMinutes,
			OffsetDateTime effectiveWindowStart
	) {
		return forUser(
				shiftSession.getActualEndTime(),
				intervals,
				userId,
				persistedPauseMinutes,
				effectiveWindowStart
		);
	}

	private OffsetDateTime activeAllPauseStartedAt(List<ShiftPauseInterval> intervals) {
		return intervals.stream()
				.filter((interval) -> interval.getScope() == PauseScope.ALL && interval.getEndedAt() == null)
				.map(ShiftPauseInterval::getStartedAt)
				.findFirst()
				.orElse(null);
	}

	private OffsetDateTime activePersonalPauseStartedAt(List<ShiftPauseInterval> intervals, Long userId) {
		return intervals.stream()
				.filter((interval) -> interval.getScope() == PauseScope.PERSONAL)
				.filter((interval) -> interval.getEndedAt() == null)
				.filter((interval) -> interval.getUser() != null)
				.filter((interval) -> Objects.equals(interval.getUser().getId(), userId))
				.map(ShiftPauseInterval::getStartedAt)
				.findFirst()
				.orElse(null);
	}
}
