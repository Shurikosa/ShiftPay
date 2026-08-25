package com.shiftpay.mvp.dto;

import com.fasterxml.jackson.annotation.JsonInclude;
import com.shiftpay.mvp.entity.Company;

/**
 * Response DTO for company identity shown in mobile menus and dashboards.
 *
 * @param id company id
 * @param name company display name
 * @param joinCode shareable company join code, included only where allowed
 */
public record CompanySummaryResponse(
		Long id,
		String name,
		@JsonInclude(JsonInclude.Include.NON_NULL)
		String joinCode
) {

	/**
	 * Maps a company entity to a summary DTO.
	 *
	 * @param company company entity
	 * @param includeJoinCode whether the caller may receive the company join code
	 * @return company summary response
	 */
	public static CompanySummaryResponse from(Company company, boolean includeJoinCode) {
		if (company == null) {
			return null;
		}
		return new CompanySummaryResponse(
				company.getId(),
				company.getName(),
				includeJoinCode ? company.getJoinCode() : null
		);
	}
}
