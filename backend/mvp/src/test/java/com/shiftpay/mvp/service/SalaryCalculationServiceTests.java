package com.shiftpay.mvp.service;

import com.shiftpay.mvp.exception.ShiftStateConflictException;
import org.junit.jupiter.api.Test;

import java.math.BigDecimal;
import java.time.OffsetDateTime;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

class SalaryCalculationServiceTests {

	private final SalaryCalculationService salaryCalculationService = new SalaryCalculationService();

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
