package com.shiftpay.mvp.dto;

import com.shiftpay.mvp.entity.Company;

/**
 * Response DTO returned after a foreman creates a company.
 *
 * @param id company id
 * @param name company display name
 * @param joinCode generated code workers use to join the company
	 * @param currencyLabel company display-only currency label
	 * @param defaultWorkerHourlyRate company default worker rate
	 * @param defaultForemanHourlyRate company default foreman rate
	 * @param timeZone company IANA timezone id
 */
public record CreateCompanyResponse(
		Long id,
		String name,
		String joinCode,
		String currencyLabel,
		java.math.BigDecimal defaultWorkerHourlyRate,
		java.math.BigDecimal defaultForemanHourlyRate,
		String timeZone
) {

	/**
	 * Maps a company entity to the create response.
	 *
	 * @param company saved company entity
	 * @return create company response
	 */
	public static CreateCompanyResponse from(Company company) {
		return new CreateCompanyResponse(
				company.getId(),
				company.getName(),
				company.getJoinCode(),
				company.getCurrencyLabel(),
				company.getDefaultWorkerHourlyRate(),
				company.getDefaultForemanHourlyRate(),
				company.getTimeZone()
		);
	}
}
