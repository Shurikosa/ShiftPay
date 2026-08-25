package com.shiftpay.mvp.controller;

import com.shiftpay.mvp.dto.CreateCompanyRequest;
import com.shiftpay.mvp.dto.CreateCompanyResponse;
import com.shiftpay.mvp.dto.JoinCompanyRequest;
import com.shiftpay.mvp.dto.JoinCompanyResponse;
import com.shiftpay.mvp.security.AuthenticatedUserPrincipal;
import com.shiftpay.mvp.service.CompanyService;
import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

/**
 * Handles company onboarding endpoints under {@code /api/v1/companies}.
 *
 * <p>Foremen create companies and workers join existing companies by code. Role restrictions are defined in Spring
 * Security, while one-company MVP rules are enforced by {@link CompanyService}.</p>
 */
@RestController
@RequestMapping("/api/v1/companies")
public class CompanyController {

	private final CompanyService companyService;

	/**
	 * Creates the controller with the company business service.
	 *
	 * @param companyService service used for company onboarding
	 */
	public CompanyController(CompanyService companyService) {
		this.companyService = companyService;
	}

	/**
	 * Handles {@code POST /api/v1/companies}.
	 *
	 * @param request create company request
	 * @param principal authenticated foreman principal
	 * @return created company response with generated join code
	 */
	@PostMapping
	@ResponseStatus(HttpStatus.CREATED)
	public CreateCompanyResponse createCompany(
			@Valid @RequestBody CreateCompanyRequest request,
			@AuthenticationPrincipal AuthenticatedUserPrincipal principal
	) {
		return companyService.createCompany(request, principal);
	}

	/**
	 * Handles {@code POST /api/v1/companies/join}.
	 *
	 * @param request join code request
	 * @param principal authenticated worker principal
	 * @return joined company response
	 */
	@PostMapping("/join")
	public JoinCompanyResponse joinCompany(
			@Valid @RequestBody JoinCompanyRequest request,
			@AuthenticationPrincipal AuthenticatedUserPrincipal principal
	) {
		return companyService.joinCompany(request, principal);
	}
}
