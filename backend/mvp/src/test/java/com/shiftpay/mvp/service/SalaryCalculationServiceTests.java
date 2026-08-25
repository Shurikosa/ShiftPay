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
 * <p>The class covers the core salary formula, break deduction, zero-rate behavior, HALF_UP money rounding, zero
 * clamping when unpaid minutes exceed the work window, and validation for negative values.</p>
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
	 * Deducts both static break and dynamic pause minutes from the shift duration.
	 */
	@Test
	void pauseMinutesAreDeductedWithBreakMinutes() {
		SalaryCalculationService.SalaryCalculationResult result = salaryCalculationService.calculate(
				180,
				30,
				45,
				new BigDecimal("20.00")
		);

		assertThat(result.workedMinutes()).isEqualTo(105);
		assertThat(result.calculatedSalary()).isEqualByComparingTo("35.00");
	}

	/**
	 * Clamps paid minutes and salary to zero when break minutes exceed the payable duration.
	 */
	@Test
	void breakGreaterThanDurationClampsToZero() {
		SalaryCalculationService.SalaryCalculationResult result = salaryCalculationService.calculate(
				60,
				61,
				new BigDecimal("15.00")
		);

		assertThat(result.workedMinutes()).isZero();
		assertThat(result.calculatedSalary()).isEqualByComparingTo("0.00");
		assertThat(result.calculatedSalary().scale()).isEqualTo(2);
	}

	/**
	 * Clamps paid minutes and salary to zero when static break plus dynamic pause exceed the payable duration.
	 */
	@Test
	void breakAndPauseGreaterThanDurationClampsToZero() {
		SalaryCalculationService.SalaryCalculationResult result = salaryCalculationService.calculate(
				20,
				10,
				15,
				new BigDecimal("30.00")
		);

		assertThat(result.workedMinutes()).isZero();
		assertThat(result.calculatedSalary()).isEqualByComparingTo("0.00");
	}

	/**
	 * Rejects negative break minutes before any clamping is applied.
	 */
	@Test
	void negativeBreakStillFails() {
		assertThatThrownBy(() -> salaryCalculationService.calculate(
				60,
				-1,
				new BigDecimal("15.00")
		))
				.isInstanceOf(ShiftStateConflictException.class)
				.hasMessage("Break minutes cannot be negative");
	}

	/**
	 * Rejects negative durations before any clamping is applied.
	 */
	@Test
	void negativeDurationStillFails() {
		assertThatThrownBy(() -> salaryCalculationService.calculate(
				-1,
				0,
				new BigDecimal("15.00")
		))
				.isInstanceOf(ShiftStateConflictException.class)
				.hasMessage("Shift duration cannot be negative");
	}

	/**
	 * Rejects negative pause minutes before any clamping is applied.
	 */
	@Test
	void negativePauseStillFails() {
		assertThatThrownBy(() -> salaryCalculationService.calculate(
				60,
				0,
				-1,
				new BigDecimal("15.00")
		))
				.isInstanceOf(ShiftStateConflictException.class)
				.hasMessage("Pause minutes cannot be negative");
	}

	/**
	 * Rejects negative hourly rates before salary calculation.
	 */
	@Test
	void negativeRateStillFails() {
		assertThatThrownBy(() -> salaryCalculationService.calculate(
				60,
				0,
				new BigDecimal("-0.01")
		))
				.isInstanceOf(ShiftStateConflictException.class)
				.hasMessage("Attendance hourlyRate cannot be negative");
	}
}
