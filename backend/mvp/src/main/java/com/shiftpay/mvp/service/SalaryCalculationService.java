package com.shiftpay.mvp.service;

import com.shiftpay.mvp.exception.ShiftStateConflictException;
import org.springframework.stereotype.Service;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.Duration;
import java.time.OffsetDateTime;

@Service
public class SalaryCalculationService {

	private static final BigDecimal MINUTES_PER_HOUR = BigDecimal.valueOf(60);

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

	public SalaryCalculationResult calculate(
			OffsetDateTime actualStartTime,
			OffsetDateTime actualEndTime,
			Integer breakMinutes,
			BigDecimal hourlyRate
	) {
		return calculate(calculateDurationMinutes(actualStartTime, actualEndTime), breakMinutes, hourlyRate);
	}

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

	public record SalaryCalculationResult(
			Integer workedMinutes,
			BigDecimal calculatedSalary
	) {
	}
}
