package com.shiftpay.mvp.service;

import com.shiftpay.mvp.exception.ShiftStateConflictException;
import org.junit.jupiter.api.Test;

import java.math.BigDecimal;
import java.time.OffsetDateTime;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

/**
 * Service unit tests for salary and worked-minute calculation.
 *
 * <p>The class covers the core salary formula, break deduction, zero-rate behavior, HALF_UP money rounding, and
 * validation for impossible break durations.</p>
 */
class SalaryCalculationServiceTests {

	private final SalaryCalculationService salaryCalculationService = new SalaryCalculationService();

	/**
	 * Calculates a nine-hour shift with a one-hour break and expects 480 worked minutes and salary scale two.
	 */
	@Test
	void standardDayCalculatesWorkedMinutesAndSalary() {
		SalaryCalculationService.SalaryCalculationResult result = salaryCalculationService.calculate(
				OffsetDateTime.parse("2026-07-06T08:00:00Z"),
				OffsetDateTime.parse("2026-07-06T17:00:00Z"),
				60,
				new BigDecimal("15.00")
		);

		assertThat(result.workedMinutes()).isEqualTo(480);
		assertThat(result.calculatedSalary()).isEqualByComparingTo("120.00");
		assertThat(result.calculatedSalary().scale()).isEqualTo(2);
	}

	/**
	 * Uses a half-hour duration and fractional rate to verify salary is rounded HALF_UP to two decimals.
	 */
	@Test
	void salaryRoundsHalfUpToTwoDecimalPlaces() {
		SalaryCalculationService.SalaryCalculationResult result = salaryCalculationService.calculate(
				30,
				0,
				new BigDecimal("20.01")
		);

		assertThat(result.workedMinutes()).isEqualTo(30);
		assertThat(result.calculatedSalary()).isEqualByComparingTo("10.01");
	}

	/**
	 * Confirms a zero-minute break leaves the full shift duration as worked time.
	 */
	@Test
	void zeroBreakKeepsFullShiftDuration() {
		SalaryCalculationService.SalaryCalculationResult result = salaryCalculationService.calculate(
				OffsetDateTime.parse("2026-07-06T08:00:00Z"),
				OffsetDateTime.parse("2026-07-06T09:00:00Z"),
				0,
				new BigDecimal("12.00")
		);

		assertThat(result.workedMinutes()).isEqualTo(60);
		assertThat(result.calculatedSalary()).isEqualByComparingTo("12.00");
	}

	/**
	 * Allows a valid zero hourly rate and expects worked minutes with a zero salary.
	 */
	@Test
	void zeroRateProducesZeroSalary() {
		SalaryCalculationService.SalaryCalculationResult result = salaryCalculationService.calculate(
				OffsetDateTime.parse("2026-07-06T08:00:00Z"),
				OffsetDateTime.parse("2026-07-06T17:00:00Z"),
				60,
				new BigDecimal("0.00")
		);

		assertThat(result.workedMinutes()).isEqualTo(480);
		assertThat(result.calculatedSalary()).isEqualByComparingTo("0.00");
	}

	/**
	 * Rejects break minutes greater than total duration because that would create negative worked time.
	 */
	@Test
	void breakGreaterThanDurationFails() {
		assertThatThrownBy(() -> salaryCalculationService.calculate(
				60,
				61,
				new BigDecimal("15.00")
		))
				.isInstanceOf(ShiftStateConflictException.class)
				.hasMessage("Break minutes cannot be greater than shift duration");
	}
}
