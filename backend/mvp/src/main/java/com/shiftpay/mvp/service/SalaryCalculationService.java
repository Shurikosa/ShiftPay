package com.shiftpay.mvp.service;

import com.shiftpay.mvp.exception.ShiftStateConflictException;
import org.springframework.stereotype.Service;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.Duration;
import java.time.OffsetDateTime;

/**
 * Performs salary and worked-minute calculations for closed shifts.
 *
 * <p>Money is calculated with {@link BigDecimal}. The service rejects missing timestamps, negative durations,
 * negative breaks, breaks longer than the shift, missing rates, and negative rates. Salary is rounded to scale two
 * with {@link RoundingMode#HALF_UP}.</p>
 */
@Service
public class SalaryCalculationService {

	private static final BigDecimal MINUTES_PER_HOUR = BigDecimal.valueOf(60);

	/**
	 * Calculates whole minutes between actual start and end timestamps.
	 *
	 * @param actualStartTime actual shift start time
	 * @param actualEndTime actual shift end time
	 * @return non-negative shift duration in minutes
	 */
	public long calculateDurationMinutes(OffsetDateTime actualStartTime, OffsetDateTime actualEndTime) {
		if (actualStartTime == null) {
			throw new ShiftStateConflictException("Shift actualStartTime is required before closing");
		}
		if (actualEndTime == null) {
			throw new ShiftStateConflictException("Shift actualEndTime is required before salary calculation");
		}

		long durationMinutes = Duration.between(actualStartTime, actualEndTime).toMinutes();
		if (durationMinutes < 0) {
			throw new ShiftStateConflictException("Shift actualEndTime must be after or equal to actualStartTime");
		}
		return durationMinutes;
	}

	/**
	 * Calculates worked minutes and salary from actual timestamps, break minutes, and hourly rate.
	 *
	 * @param actualStartTime actual shift start time
	 * @param actualEndTime actual shift end time
	 * @param breakMinutes break minutes to deduct, null treated as zero
	 * @param hourlyRate attendance hourly rate snapshot or override
	 * @return calculated worked minutes and salary
	 */
	public SalaryCalculationResult calculate(
			OffsetDateTime actualStartTime,
			OffsetDateTime actualEndTime,
			Integer breakMinutes,
			BigDecimal hourlyRate
	) {
		return calculate(calculateDurationMinutes(actualStartTime, actualEndTime), breakMinutes, hourlyRate);
	}

	/**
	 * Calculates worked minutes and salary from an already known shift duration.
	 *
	 * @param durationMinutes non-negative shift duration in minutes
	 * @param breakMinutes break minutes to deduct, null treated as zero
	 * @param hourlyRate attendance hourly rate snapshot or override
	 * @return calculated worked minutes and salary
	 */
	public SalaryCalculationResult calculate(
			long durationMinutes,
			Integer breakMinutes,
			BigDecimal hourlyRate
	) {
		int safeBreakMinutes = breakMinutes == null ? 0 : breakMinutes;
		if (safeBreakMinutes < 0) {
			throw new ShiftStateConflictException("Break minutes cannot be negative");
		}
		if (safeBreakMinutes > durationMinutes) {
			throw new ShiftStateConflictException("Break minutes cannot be greater than shift duration");
		}
		if (hourlyRate == null) {
			throw new ShiftStateConflictException("Attendance hourlyRate is required for salary calculation");
		}
		if (hourlyRate.signum() < 0) {
			throw new ShiftStateConflictException("Attendance hourlyRate cannot be negative");
		}

		long workedMinutes = durationMinutes - safeBreakMinutes;
		BigDecimal calculatedSalary = hourlyRate
				.multiply(BigDecimal.valueOf(workedMinutes))
				.divide(MINUTES_PER_HOUR, 2, RoundingMode.HALF_UP);

		return new SalaryCalculationResult(Math.toIntExact(workedMinutes), calculatedSalary);
	}

	/**
	 * Calculation result persisted to approved attendance when a shift closes.
	 *
	 * @param workedMinutes duration minus break minutes
	 * @param calculatedSalary salary rounded to scale two
	 */
	public record SalaryCalculationResult(
			Integer workedMinutes,
			BigDecimal calculatedSalary
	) {
	}
}
