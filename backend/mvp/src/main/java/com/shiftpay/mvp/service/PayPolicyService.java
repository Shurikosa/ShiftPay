package com.shiftpay.mvp.service;

import com.shiftpay.mvp.dto.HolidayDateCondition;
import com.shiftpay.mvp.dto.PayPolicyResponse;
import com.shiftpay.mvp.dto.PayPolicyRuleCondition;
import com.shiftpay.mvp.dto.PayPolicyRuleRequest;
import com.shiftpay.mvp.dto.PayPolicyRuleResponse;
import com.shiftpay.mvp.dto.PayPolicyUpdateRequest;
import com.shiftpay.mvp.dto.PayPolicyVersionSummaryResponse;
import com.shiftpay.mvp.entity.Company;
import com.shiftpay.mvp.entity.PayPolicy;
import com.shiftpay.mvp.entity.PayPolicyRule;
import com.shiftpay.mvp.entity.PayPolicyRuleType;
import com.shiftpay.mvp.entity.PayPolicyStackingStrategy;
import com.shiftpay.mvp.entity.PayPolicyVersion;
import com.shiftpay.mvp.entity.Role;
import com.shiftpay.mvp.entity.User;
import com.shiftpay.mvp.exception.BadRequestException;
import com.shiftpay.mvp.exception.CompanyConflictException;
import com.shiftpay.mvp.exception.PayPolicyRequiredException;
import com.shiftpay.mvp.exception.PayPolicyConflictException;
import com.shiftpay.mvp.repository.CompanyRepository;
import com.shiftpay.mvp.repository.PayPolicyRepository;
import com.shiftpay.mvp.repository.PayPolicyVersionRepository;
import com.shiftpay.mvp.repository.UserRepository;
import com.shiftpay.mvp.security.AuthenticatedUserPrincipal;
import com.shiftpay.mvp.security.JwtAuthenticationException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.time.DayOfWeek;
import java.time.LocalDate;
import java.time.LocalTime;
import java.util.ArrayList;
import java.util.EnumSet;
import java.util.HashSet;
import java.util.List;
import java.util.Objects;
import java.util.Set;

/**
 * Business service for company-owned immutable PayPolicy versions.
 */
@Service
public class PayPolicyService {

	private static final BigDecimal MAX_PREMIUM_PERCENT = new BigDecimal("1000.0000");
	private static final DayOfWeek DEFAULT_WEEK_STARTS_ON = DayOfWeek.MONDAY;
	private static final PayPolicyStackingStrategy DEFAULT_STACKING_STRATEGY = PayPolicyStackingStrategy.ADD;

	private final CompanyRepository companyRepository;
	private final PayPolicyRepository payPolicyRepository;
	private final PayPolicyVersionRepository payPolicyVersionRepository;
	private final UserRepository userRepository;

	/**
	 * Creates the service with persistence dependencies.
	 *
	 * @param companyRepository company repository
	 * @param payPolicyRepository policy root repository
	 * @param payPolicyVersionRepository policy version repository
	 * @param userRepository user repository
	 */
	public PayPolicyService(
			CompanyRepository companyRepository,
			PayPolicyRepository payPolicyRepository,
			PayPolicyVersionRepository payPolicyVersionRepository,
			UserRepository userRepository
	) {
		this.companyRepository = companyRepository;
		this.payPolicyRepository = payPolicyRepository;
		this.payPolicyVersionRepository = payPolicyVersionRepository;
		this.userRepository = userRepository;
	}

	/**
	 * Creates the default empty policy version for a newly onboarded company.
	 *
	 * @param company company to initialize
	 * @param createdBy foreman creating the company
	 * @return initialized current policy version
	 */
	@Transactional
	public PayPolicyVersion initializeDefaultPolicy(Company company, User createdBy) {
		PayPolicy policy = new PayPolicy();
		policy.setCompany(company);
		PayPolicy savedPolicy = payPolicyRepository.saveAndFlush(policy);

		PayPolicyVersion defaultVersion = buildVersion(
				savedPolicy,
				company,
				1,
				DEFAULT_WEEK_STARTS_ON,
				DEFAULT_STACKING_STRATEGY,
				createdBy
		);
		PayPolicyVersion savedVersion = payPolicyVersionRepository.saveAndFlush(defaultVersion);
		savedPolicy.setCurrentVersion(savedVersion);
		payPolicyRepository.save(savedPolicy);
		return savedVersion;
	}

	/**
	 * Resolves and freezes the current policy version for shift start.
	 *
	 * @param company company that owns the shift
	 * @return current policy version
	 */
	@Transactional
	public PayPolicyVersion resolveCurrentPolicyForShiftStart(Company company) {
		List<PayPolicyVersion> currentVersions = payPolicyVersionRepository.findCurrentByCompanyIdForUpdate(
				company.getId()
		);
		if (currentVersions.size() != 1) {
			throw new PayPolicyRequiredException();
		}
		return currentVersions.getFirst();
	}

	/**
	 * Returns the current company pay policy for a FOREMAN.
	 *
	 * @param principal authenticated foreman principal
	 * @return current pay policy response
	 */
	@Transactional(readOnly = true)
	public PayPolicyResponse getMyPayPolicy(AuthenticatedUserPrincipal principal) {
		User foreman = loadForemanWithCompany(principal);
		Company company = requireCompany(foreman);
		PayPolicyVersion currentVersion = payPolicyVersionRepository
				.findCurrentByCompanyIdWithRules(company.getId())
				.orElseThrow(() -> new PayPolicyConflictException("Current pay policy is required"));
		return toResponse(currentVersion);
	}

	/**
	 * Creates a new immutable current policy version for the current foreman's company.
	 *
	 * @param request policy replacement request
	 * @param principal authenticated foreman principal
	 * @return newly current policy version
	 */
	@Transactional
	public PayPolicyResponse updateMyPayPolicy(
			PayPolicyUpdateRequest request,
			AuthenticatedUserPrincipal principal
	) {
		User foreman = loadForemanWithCompany(principal);
		Company company = requireCompany(foreman);
		List<ValidatedRule> validatedRules = validateRequest(request);

		PayPolicy policy = payPolicyRepository.findByCompanyIdForUpdate(company.getId())
				.orElseGet(() -> initializeMissingPolicyRoot(company));
		Integer maxVersion = payPolicyVersionRepository.findMaxVersionByPayPolicyId(policy.getId());
		int nextVersionNumber = maxVersion == null ? 1 : maxVersion + 1;

		PayPolicyVersion newVersion = buildVersion(
				policy,
				company,
				nextVersionNumber,
				request.weekStartsOn(),
				request.stackingStrategy(),
				foreman
		);
		for (int index = 0; index < validatedRules.size(); index++) {
			newVersion.addRule(toEntity(validatedRules.get(index), index));
		}

		PayPolicyVersion savedVersion = payPolicyVersionRepository.saveAndFlush(newVersion);
		policy.setCurrentVersion(savedVersion);
		payPolicyRepository.save(policy);
		return toResponse(savedVersion);
	}

	/**
	 * Lists all policy versions for the current foreman's company, newest first.
	 *
	 * @param principal authenticated foreman principal
	 * @return policy version summaries
	 */
	@Transactional(readOnly = true)
	public List<PayPolicyVersionSummaryResponse> getMyPayPolicyVersions(AuthenticatedUserPrincipal principal) {
		User foreman = loadForemanWithCompany(principal);
		Company company = requireCompany(foreman);
		PayPolicy policy = payPolicyRepository.findByCompanyIdWithCurrentVersion(company.getId())
				.orElseThrow(() -> new PayPolicyConflictException("Current pay policy is required"));
		Long currentVersionId = policy.getCurrentVersion() == null ? null : policy.getCurrentVersion().getId();
		return payPolicyVersionRepository.findByCompanyIdWithRulesOrderByVersionDesc(company.getId())
				.stream()
				.map((version) -> PayPolicyVersionSummaryResponse.from(
						version,
						Objects.equals(version.getId(), currentVersionId)
				))
				.toList();
	}

	private PayPolicy initializeMissingPolicyRoot(Company company) {
		Company lockedCompany = companyRepository.findByIdForUpdate(company.getId())
				.orElseThrow(() -> new CompanyConflictException("Foreman must create a company before managing pay policy"));
		PayPolicy policy = new PayPolicy();
		policy.setCompany(lockedCompany);
		return payPolicyRepository.saveAndFlush(policy);
	}

	private PayPolicyVersion buildVersion(
			PayPolicy policy,
			Company company,
			int versionNumber,
			DayOfWeek weekStartsOn,
			PayPolicyStackingStrategy stackingStrategy,
			User createdBy
	) {
		PayPolicyVersion version = new PayPolicyVersion();
		version.setPayPolicy(policy);
		version.setCompany(company);
		version.setVersion(versionNumber);
		version.setWeekStartsOn(weekStartsOn);
		version.setStackingStrategy(stackingStrategy);
		version.setCreatedBy(createdBy);
		return version;
	}

	private PayPolicyRule toEntity(ValidatedRule validatedRule, int sortOrder) {
		PayPolicyRule rule = new PayPolicyRule();
		rule.setName(validatedRule.name());
		rule.setType(validatedRule.type());
		rule.setEnabled(validatedRule.enabled());
		rule.setPremiumPercent(validatedRule.premiumPercent());
		rule.setConditionConfig(PayPolicyConditionJson.write(validatedRule.condition()));
		rule.setSortOrder(sortOrder);
		return rule;
	}

	private List<ValidatedRule> validateRequest(PayPolicyUpdateRequest request) {
		if (request.rules() == null) {
			throw new BadRequestException("rules: must not be null");
		}
		List<ValidatedRule> validatedRules = new ArrayList<>();
		for (int index = 0; index < request.rules().size(); index++) {
			validatedRules.add(validateRule(request.rules().get(index), "rules[" + index + "]"));
		}
		return validatedRules;
	}

	private ValidatedRule validateRule(PayPolicyRuleRequest rule, String fieldPath) {
		if (rule == null) {
			throw new BadRequestException(fieldPath + ": must not be null");
		}
		if (rule.name() == null || rule.name().isBlank()) {
			throw new BadRequestException(fieldPath + ".name: must not be blank");
		}
		if (rule.type() == null) {
			throw new BadRequestException(fieldPath + ".type: must not be null");
		}
		if (rule.enabled() == null) {
			throw new BadRequestException(fieldPath + ".enabled: must not be null");
		}
		validatePremiumPercent(rule.premiumPercent(), fieldPath + ".premiumPercent");
		if (rule.condition() == null) {
			throw new BadRequestException(fieldPath + ".condition: must not be null");
		}

		PayPolicyRuleCondition condition = validateCondition(rule.type(), rule.condition(), fieldPath + ".condition");
		return new ValidatedRule(
				rule.name().trim(),
				rule.type(),
				rule.enabled(),
				rule.premiumPercent(),
				condition
		);
	}

	private void validatePremiumPercent(BigDecimal premiumPercent, String fieldPath) {
		if (premiumPercent == null) {
			throw new BadRequestException(fieldPath + ": must not be null");
		}
		if (premiumPercent.signum() < 0 || premiumPercent.compareTo(MAX_PREMIUM_PERCENT) > 0) {
			throw new BadRequestException(fieldPath + ": must be between 0.0000 and 1000.0000");
		}
		if (premiumPercent.scale() > 4) {
			throw new BadRequestException(fieldPath + ": scale must be less than or equal to 4");
		}
	}

	private PayPolicyRuleCondition validateCondition(
			PayPolicyRuleType type,
			PayPolicyRuleCondition condition,
			String fieldPath
	) {
		return switch (type) {
			case TIME_OF_DAY -> validateTimeOfDay(condition, fieldPath);
			case DAILY_OVERTIME, WEEKLY_OVERTIME -> validateOvertime(condition, fieldPath);
			case DAY_OF_WEEK -> validateDayOfWeek(condition, fieldPath);
			case HOLIDAY -> validateHoliday(condition, fieldPath);
		};
	}

	private PayPolicyRuleCondition validateTimeOfDay(PayPolicyRuleCondition condition, String fieldPath) {
		LocalTime startTime = condition.startTime();
		LocalTime endTime = condition.endTime();
		if (startTime == null) {
			throw new BadRequestException(fieldPath + ".startTime: must not be null");
		}
		if (endTime == null) {
			throw new BadRequestException(fieldPath + ".endTime: must not be null");
		}
		if (startTime.equals(endTime)) {
			throw new BadRequestException(fieldPath + ".endTime: must be different from startTime");
		}
		return PayPolicyConditionJson.timeOfDay(startTime, endTime);
	}

	private PayPolicyRuleCondition validateOvertime(PayPolicyRuleCondition condition, String fieldPath) {
		Integer thresholdMinutes = condition.thresholdMinutes();
		if (thresholdMinutes == null) {
			throw new BadRequestException(fieldPath + ".thresholdMinutes: must not be null");
		}
		if (thresholdMinutes <= 0) {
			throw new BadRequestException(fieldPath + ".thresholdMinutes: must be greater than 0");
		}
		return PayPolicyConditionJson.overtime(thresholdMinutes);
	}

	private PayPolicyRuleCondition validateDayOfWeek(PayPolicyRuleCondition condition, String fieldPath) {
		List<DayOfWeek> weekdays = condition.weekdays();
		if (weekdays == null || weekdays.isEmpty()) {
			throw new BadRequestException(fieldPath + ".weekdays: must not be empty");
		}
		Set<DayOfWeek> uniqueWeekdays = EnumSet.noneOf(DayOfWeek.class);
		for (DayOfWeek weekday : weekdays) {
			if (weekday == null) {
				throw new BadRequestException(fieldPath + ".weekdays: must not contain null values");
			}
			if (!uniqueWeekdays.add(weekday)) {
				throw new BadRequestException(fieldPath + ".weekdays: must not contain duplicates");
			}
		}
		return PayPolicyConditionJson.dayOfWeek(List.copyOf(uniqueWeekdays));
	}

	private PayPolicyRuleCondition validateHoliday(PayPolicyRuleCondition condition, String fieldPath) {
		List<HolidayDateCondition> dates = condition.dates();
		if (dates == null || dates.isEmpty()) {
			throw new BadRequestException(fieldPath + ".dates: must not be empty");
		}
		Set<LocalDate> uniqueDates = new HashSet<>();
		List<HolidayDateCondition> normalizedDates = new ArrayList<>();
		for (int index = 0; index < dates.size(); index++) {
			HolidayDateCondition date = dates.get(index);
			if (date == null) {
				throw new BadRequestException(fieldPath + ".dates[" + index + "]: must not be null");
			}
			if (date.date() == null) {
				throw new BadRequestException(fieldPath + ".dates[" + index + "].date: must not be null");
			}
			if (!uniqueDates.add(date.date())) {
				throw new BadRequestException(fieldPath + ".dates: must not contain duplicate dates");
			}
			normalizedDates.add(new HolidayDateCondition(date.date(), trimToNull(date.label())));
		}
		return PayPolicyConditionJson.holiday(normalizedDates);
	}

	private PayPolicyResponse toResponse(PayPolicyVersion policyVersion) {
		List<PayPolicyRuleResponse> rules = policyVersion.sortedRules()
				.stream()
				.map((rule) -> PayPolicyRuleResponse.from(
						rule,
						PayPolicyConditionJson.read(rule.getConditionConfig())
				))
				.toList();
		return PayPolicyResponse.from(policyVersion, true, rules);
	}

	private User loadForemanWithCompany(AuthenticatedUserPrincipal principal) {
		User foreman = userRepository.findWithCompanyById(principal.id())
				.orElseThrow(() -> new JwtAuthenticationException("Authenticated user not found"));
		if (foreman.getRole() != Role.FOREMAN || principal.role() != Role.FOREMAN) {
			throw new JwtAuthenticationException("Authenticated user role changed");
		}
		return foreman;
	}

	private Company requireCompany(User foreman) {
		if (foreman.getCompany() == null) {
			throw new CompanyConflictException("Foreman must create a company before managing pay policy");
		}
		return foreman.getCompany();
	}

	private String trimToNull(String value) {
		if (value == null || value.isBlank()) {
			return null;
		}
		return value.trim();
	}

	private record ValidatedRule(
			String name,
			PayPolicyRuleType type,
			boolean enabled,
			BigDecimal premiumPercent,
			PayPolicyRuleCondition condition
	) {
	}
}
