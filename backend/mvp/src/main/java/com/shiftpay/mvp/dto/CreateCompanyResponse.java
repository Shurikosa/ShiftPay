package com.shiftpay.mvp.dto;

import com.shiftpay.mvp.entity.Company;

/**
 * Response DTO returned after a foreman creates a company.
 *
 * @param id company id
 * @param name company display name
 * @param joinCode generated code workers use to join the company
 * @param timeZone company IANA timezone id
 */
public record CreateCompanyResponse(
		Long id,
		String name,
		String joinCode,
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
				company.getTimeZone()
		);
	}
}
