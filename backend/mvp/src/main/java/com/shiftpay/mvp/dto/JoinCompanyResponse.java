package com.shiftpay.mvp.dto;

import com.shiftpay.mvp.entity.Company;

/**
 * Response DTO returned after a worker joins a company.
 *
 * @param id company id
 * @param name company display name
 * @param timeZone company IANA timezone id
 */
public record JoinCompanyResponse(
		Long id,
		String name,
		String timeZone
) {

	/**
	 * Maps a company entity to the worker join response.
	 *
	 * @param company joined company entity
	 * @return join company response
	 */
	public static JoinCompanyResponse from(Company company) {
		return new JoinCompanyResponse(
				company.getId(),
				company.getName(),
				company.getTimeZone()
		);
	}
}
