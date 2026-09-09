package com.shiftpay.mvp.service;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.Duration;
import java.time.Instant;
import java.util.Objects;

/**
 * Stable payable interval input for overtime allocation context.
 *
 * @param stableId required database or test id used as deterministic tie-breaker
 * @param workerId worker scope when provided by production integration
 * @param companyId company scope when provided by production integration
 * @param shiftActualStartTime shift actual start metadata
 * @param attendancePayableStartTime attendance payable start tie-breaker
 * @param start payable interval start instant
 * @param end payable interval end instant
 * @param payableSeconds exact payable seconds in the interval
 * @param payableMinutesExact exact payable minutes in the interval
 * @param current true when this is the interval currently being calculated
 */
public record PremiumPayableInterval(
		Long stableId,
		Long workerId,
		Long companyId,
		Instant shiftActualStartTime,
		Instant attendancePayableStartTime,
		Instant start,
		Instant end,
		BigDecimal payableSeconds,
		BigDecimal payableMinutesExact,
		boolean current
) {

	private static final int DURATION_SCALE = 9;
	private static final int MINUTES_SCALE = 8;
	private static final BigDecimal SECONDS_PER_MINUTE = BigDecimal.valueOf(60);

	public PremiumPayableInterval {
		if (stableId == null) {
			throw new IllegalArgumentException("stableId is required for overtime context ordering");
		}
		Objects.requireNonNull(start, "start");
		Objects.requireNonNull(end, "end");
		Objects.requireNonNull(payableSeconds, "payableSeconds");
		Objects.requireNonNull(payableMinutesExact, "payableMinutesExact");
		if (end.isBefore(start)) {
			throw new IllegalArgumentException("end must not be before start");
		}
		payableSeconds = payableSeconds.setScale(DURATION_SCALE, RoundingMode.HALF_UP);
		payableMinutesExact = payableMinutesExact.setScale(MINUTES_SCALE, RoundingMode.HALF_UP);
		if (payableSeconds.signum() < 0) {
			throw new IllegalArgumentException("payableSeconds must not be negative");
		}
		if (payableMinutesExact.signum() < 0) {
			throw new IllegalArgumentException("payableMinutesExact must not be negative");
		}
		BigDecimal expectedSeconds = secondsExact(Duration.between(start, end));
		if (payableSeconds.compareTo(expectedSeconds) != 0) {
			throw new IllegalArgumentException("payableSeconds must match interval duration");
		}
		BigDecimal expectedMinutes = expectedSeconds.divide(
				SECONDS_PER_MINUTE,
				MINUTES_SCALE,
				RoundingMode.HALF_UP
		);
		if (payableMinutesExact.compareTo(expectedMinutes) != 0) {
			throw new IllegalArgumentException("payableMinutesExact must match interval duration");
		}
	}

	/**
	 * Creates a previous finalized payable interval with derived exact duration fields.
	 *
	 * @param stableId required stable id/tie-breaker
	 * @param shiftActualStartTime shift actual start time metadata
	 * @param attendancePayableStartTime attendance payable start time
	 * @param start interval start
	 * @param end interval end
	 * @return previous finalized payable interval
	 */
	public static PremiumPayableInterval previousFinalized(
			Long stableId,
			Instant shiftActualStartTime,
			Instant attendancePayableStartTime,
			Instant start,
			Instant end
	) {
		return previousFinalized(null, null, stableId, shiftActualStartTime, attendancePayableStartTime, start, end);
	}

	/**
	 * Creates a scoped previous finalized payable interval with derived exact duration fields.
	 *
	 * @param workerId worker id
	 * @param companyId company id
	 * @param stableId required stable id/tie-breaker
	 * @param shiftActualStartTime shift actual start time metadata
	 * @param attendancePayableStartTime attendance payable start time
	 * @param start interval start
	 * @param end interval end
	 * @return previous finalized payable interval
	 */
	public static PremiumPayableInterval previousFinalized(
			Long workerId,
			Long companyId,
			Long stableId,
			Instant shiftActualStartTime,
			Instant attendancePayableStartTime,
			Instant start,
			Instant end
	) {
		return from(workerId, companyId, stableId, shiftActualStartTime, attendancePayableStartTime, start, end, false);
	}

	/**
	 * Creates the current payable interval with derived exact duration fields.
	 *
	 * @param stableId required stable id/tie-breaker
	 * @param shiftActualStartTime shift actual start time metadata
	 * @param attendancePayableStartTime attendance payable start time
	 * @param start interval start
	 * @param end interval end
	 * @return current payable interval
	 */
	public static PremiumPayableInterval current(
			Long stableId,
			Instant shiftActualStartTime,
			Instant attendancePayableStartTime,
			Instant start,
			Instant end
	) {
		return current(null, null, stableId, shiftActualStartTime, attendancePayableStartTime, start, end);
	}

	/**
	 * Creates the scoped current payable interval with derived exact duration fields.
	 *
	 * @param workerId worker id
	 * @param companyId company id
	 * @param stableId required stable id/tie-breaker
	 * @param shiftActualStartTime shift actual start time metadata
	 * @param attendancePayableStartTime attendance payable start time
	 * @param start interval start
	 * @param end interval end
	 * @return current payable interval
	 */
	public static PremiumPayableInterval current(
			Long workerId,
			Long companyId,
			Long stableId,
			Instant shiftActualStartTime,
			Instant attendancePayableStartTime,
			Instant start,
			Instant end
	) {
		return from(workerId, companyId, stableId, shiftActualStartTime, attendancePayableStartTime, start, end, true);
	}

	private static PremiumPayableInterval from(
			Long workerId,
			Long companyId,
			Long stableId,
			Instant shiftActualStartTime,
			Instant attendancePayableStartTime,
			Instant start,
			Instant end,
			boolean current
	) {
		BigDecimal seconds = secondsExact(Duration.between(start, end));
		BigDecimal minutes = seconds.divide(SECONDS_PER_MINUTE, MINUTES_SCALE, RoundingMode.HALF_UP);
		return new PremiumPayableInterval(
				stableId,
				workerId,
				companyId,
				shiftActualStartTime,
				attendancePayableStartTime,
				start,
				end,
				seconds,
				minutes,
				current
		);
	}

	private static BigDecimal secondsExact(Duration duration) {
		return BigDecimal.valueOf(duration.getSeconds())
				.add(BigDecimal.valueOf(duration.getNano(), DURATION_SCALE))
				.setScale(DURATION_SCALE, RoundingMode.HALF_UP);
	}
}
