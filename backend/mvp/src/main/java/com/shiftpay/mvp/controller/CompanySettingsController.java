package com.shiftpay.mvp.controller;

import com.shiftpay.mvp.dto.CompanySettingsResponse;
import com.shiftpay.mvp.dto.UpdateCompanySettingsRequest;
import com.shiftpay.mvp.security.AuthenticatedUserPrincipal;
import com.shiftpay.mvp.service.CompanyService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.responses.ApiResponse;
import jakarta.validation.Valid;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

/** FOREMAN-only Company Settings endpoints. */
@RestController
@RequestMapping("/api/v1/me/company")
public class CompanySettingsController {
	private final CompanyService companyService;

	public CompanySettingsController(CompanyService companyService) {
		this.companyService = companyService;
	}

	@Operation(summary = "Get my company settings", description = "Available only to the authenticated FOREMAN.")
	@ApiResponse(responseCode = "403", description = "WORKER and ADMIN are forbidden")
	@GetMapping
	public CompanySettingsResponse getMyCompany(@AuthenticationPrincipal AuthenticatedUserPrincipal principal) {
		return companyService.getMyCompany(principal);
	}

	@Operation(summary = "Update my company settings", description = "Available only to the authenticated FOREMAN.")
	@ApiResponse(responseCode = "400", description = "Invalid company settings")
	@ApiResponse(responseCode = "403", description = "WORKER and ADMIN are forbidden")
	@ApiResponse(responseCode = "409", description = "The FOREMAN has no company")
	@PutMapping
	public CompanySettingsResponse updateMyCompany(
			@Valid @RequestBody UpdateCompanySettingsRequest request,
			@AuthenticationPrincipal AuthenticatedUserPrincipal principal
	) {
		return companyService.updateMyCompany(request, principal);
	}
}
