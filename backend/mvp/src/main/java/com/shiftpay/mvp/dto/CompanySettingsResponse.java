package com.shiftpay.mvp.dto;

import com.shiftpay.mvp.entity.Company;

import java.math.BigDecimal;

/** FOREMAN-only mutable company settings with read-only join code and timezone. */
public record CompanySettingsResponse(
		Long id,
		String name,
		String joinCode,
		String currencyLabel,
		BigDecimal defaultWorkerHourlyRate,
		BigDecimal defaultForemanHourlyRate,
		String timeZone
) {
	public static CompanySettingsResponse from(Company company) {
		return new CompanySettingsResponse(
				company.getId(), company.getName(), company.getJoinCode(), company.getCurrencyLabel(),
				company.getDefaultWorkerHourlyRate(), company.getDefaultForemanHourlyRate(), company.getTimeZone()
		);
	}
}
