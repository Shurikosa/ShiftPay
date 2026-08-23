package com.shiftpay.mvp.service;

import com.shiftpay.mvp.dto.CreateCompanyRequest;
import com.shiftpay.mvp.dto.CreateCompanyResponse;
import com.shiftpay.mvp.dto.JoinCompanyRequest;
import com.shiftpay.mvp.dto.JoinCompanyResponse;
import com.shiftpay.mvp.entity.Company;
import com.shiftpay.mvp.entity.Role;
import com.shiftpay.mvp.entity.User;
import com.shiftpay.mvp.exception.CompanyConflictException;
import com.shiftpay.mvp.exception.CompanyNotFoundException;
import com.shiftpay.mvp.repository.CompanyRepository;
import com.shiftpay.mvp.repository.UserRepository;
import com.shiftpay.mvp.security.AuthenticatedUserPrincipal;
import com.shiftpay.mvp.security.JwtAuthenticationException;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.security.SecureRandom;
import java.util.Locale;

/**
 * Business service for mobile MVP company onboarding.
 *
 * <p>Foremen create one company and receive a shareable join code. Workers join one company by code before they can
 * join company-scoped shifts.</p>
 */
@Service
public class CompanyService {

	private static final char[] JOIN_CODE_CHARS = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789".toCharArray();
	private static final int JOIN_CODE_LENGTH = 6;
	private static final int JOIN_CODE_MAX_ATTEMPTS = 20;

	private final CompanyRepository companyRepository;
	private final UserRepository userRepository;
	private final SecureRandom secureRandom;

	/**
	 * Creates the service with repositories and secure join code generation.
	 *
	 * @param companyRepository company repository
	 * @param userRepository user repository used for company assignment
	 */
	public CompanyService(CompanyRepository companyRepository, UserRepository userRepository) {
		this.companyRepository = companyRepository;
		this.userRepository = userRepository;
		this.secureRandom = new SecureRandom();
	}

	/**
	 * Creates a company for the authenticated foreman and assigns that foreman to it.
	 *
	 * @param request create company request
	 * @param principal authenticated foreman principal
	 * @return created company with join code
	 */
	@Transactional
	public CreateCompanyResponse createCompany(
			CreateCompanyRequest request,
			AuthenticatedUserPrincipal principal
	) {
		User foreman = userRepository.findByIdWithCompanyForUpdate(principal.id())
				.orElseThrow(() -> new JwtAuthenticationException("Authenticated user not found"));

		if (foreman.getRole() != Role.FOREMAN) {
			throw new JwtAuthenticationException("Authenticated user role changed");
		}
		if (foreman.getCompany() != null) {
			throw new CompanyConflictException("Foreman already has a company");
		}

		Company company = new Company();
		company.setName(request.name().trim());
		company.setJoinCode(generateUniqueJoinCode());

		try {
			Company savedCompany = companyRepository.saveAndFlush(company);
			foreman.setCompany(savedCompany);
			userRepository.save(foreman);
			return CreateCompanyResponse.from(savedCompany);
		}
		catch (DataIntegrityViolationException exception) {
			throw new CompanyConflictException("Company join code already exists");
		}
	}

	/**
	 * Assigns the authenticated worker to a company by normalized join code.
	 *
	 * @param request join company request
	 * @param principal authenticated worker principal
	 * @return joined company response
	 */
	@Transactional
	public JoinCompanyResponse joinCompany(
			JoinCompanyRequest request,
			AuthenticatedUserPrincipal principal
	) {
		User worker = userRepository.findByIdWithCompanyForUpdate(principal.id())
				.orElseThrow(() -> new JwtAuthenticationException("Authenticated user not found"));

		if (worker.getRole() != Role.WORKER) {
			throw new JwtAuthenticationException("Authenticated user role changed");
		}
		if (worker.getCompany() != null) {
			throw new CompanyConflictException("Worker already belongs to a company");
		}

		String normalizedJoinCode = request.joinCode().trim().toUpperCase(Locale.ROOT);
		Company company = companyRepository.findByJoinCodeForUpdate(normalizedJoinCode)
				.orElseThrow(CompanyNotFoundException::new);

		worker.setCompany(company);
		userRepository.save(worker);
		return JoinCompanyResponse.from(company);
	}

	/**
	 * Generates a company join code that is not already used.
	 *
	 * @return unique company join code
	 */
	private String generateUniqueJoinCode() {
		for (int attempt = 0; attempt < JOIN_CODE_MAX_ATTEMPTS; attempt++) {
			String joinCode = generateJoinCode();
			if (!companyRepository.existsByJoinCode(joinCode)) {
				return joinCode;
			}
		}
		throw new IllegalStateException("Failed to generate unique company join code");
	}

	/**
	 * Generates one random company join code candidate.
	 *
	 * @return join code candidate
	 */
	private String generateJoinCode() {
		StringBuilder joinCode = new StringBuilder(JOIN_CODE_LENGTH);
		for (int index = 0; index < JOIN_CODE_LENGTH; index++) {
			joinCode.append(JOIN_CODE_CHARS[secureRandom.nextInt(JOIN_CODE_CHARS.length)]);
		}
		return joinCode.toString();
	}
}
