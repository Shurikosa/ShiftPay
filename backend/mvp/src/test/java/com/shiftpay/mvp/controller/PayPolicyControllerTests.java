package com.shiftpay.mvp.controller;

import com.shiftpay.mvp.TestDataCleaner;
import com.shiftpay.mvp.entity.Company;
import com.shiftpay.mvp.entity.PayPolicyVersion;
import com.shiftpay.mvp.entity.Role;
import com.shiftpay.mvp.entity.ShiftSession;
import com.shiftpay.mvp.entity.User;
import com.shiftpay.mvp.repository.CompanyRepository;
import com.shiftpay.mvp.repository.PayPolicyVersionRepository;
import com.shiftpay.mvp.repository.ShiftSessionRepository;
import com.shiftpay.mvp.repository.UserRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.MvcResult;
import org.springframework.test.web.servlet.ResultActions;

import java.util.List;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

import static org.assertj.core.api.Assertions.assertThat;
import static org.hamcrest.Matchers.containsString;
import static org.hamcrest.Matchers.hasSize;
import static org.hamcrest.Matchers.not;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/**
 * Controller integration tests for current-company pay policy management.
 */
@SpringBootTest
@AutoConfigureMockMvc
class PayPolicyControllerTests {

	private static final String REGISTER_URL = "/api/v1/auth/register";
	private static final String LOGIN_URL = "/api/v1/auth/login";
	private static final String CREATE_COMPANY_URL = "/api/v1/companies";
	private static final String CREATE_SHIFT_URL = "/api/v1/shifts";
	private static final String PAY_POLICY_URL = "/api/v1/me/pay-policy";
	private static final String PAY_POLICY_VERSIONS_URL = "/api/v1/me/pay-policy/versions";
	private static final Pattern ACCESS_TOKEN_PATTERN = Pattern.compile("\"accessToken\":\"([^\"]+)\"");
	private static final Pattern SHIFT_ID_PATTERN = Pattern.compile("\"id\":(\\d+)");

	@Autowired
	private MockMvc mockMvc;

	@Autowired
	private JdbcTemplate jdbcTemplate;

	@Autowired
	private CompanyRepository companyRepository;

	@Autowired
	private PayPolicyVersionRepository payPolicyVersionRepository;

	@Autowired
	private ShiftSessionRepository shiftSessionRepository;

	@Autowired
	private UserRepository userRepository;

	@Autowired
	private PasswordEncoder passwordEncoder;

	/**
	 * Clears persisted data before each pay-policy scenario.
	 */
	@BeforeEach
	void setUp() {
		TestDataCleaner.clean(jdbcTemplate);
	}

	/**
	 * Company onboarding should default the timezone and create an empty current policy version.
	 */
	@Test
	void companyCreationCreatesDefaultTimezoneAndCurrentPolicy() throws Exception {
		String foremanToken = registerAndLoginWithoutCompany("foreman@example.com", "FOREMAN");

		createCompany(foremanToken, "Acme Construction")
				.andExpect(status().isCreated())
				.andExpect(jsonPath("$.timeZone").value("Europe/Berlin"));

		Company company = companyRepository.findAll().getFirst();
		List<PayPolicyVersion> versions = payPolicyVersionRepository
				.findByCompanyIdWithRulesOrderByVersionDesc(company.getId());
		assertThat(company.getTimeZone()).isEqualTo("Europe/Berlin");
		assertThat(versions).hasSize(1);
		assertThat(versions.getFirst().getVersion()).isEqualTo(1);
		assertThat(versions.getFirst().getWeekStartsOn()).hasToString("MONDAY");
		assertThat(versions.getFirst().getStackingStrategy()).hasToString("ADD");
		assertThat(versions.getFirst().getRules()).isEmpty();
	}

	/**
	 * FOREMAN can read their current company policy.
	 */
	@Test
	void getCurrentPolicyReturnsDefaultPolicyForForemanCompany() throws Exception {
		String foremanToken = registerAndLogin("foreman@example.com", "FOREMAN");
		Company company = companyRepository.findAll().getFirst();

		getPayPolicy(foremanToken)
				.andExpect(status().isOk())
				.andExpect(jsonPath("$.id").isNumber())
				.andExpect(jsonPath("$.companyId").value(company.getId()))
				.andExpect(jsonPath("$.version").value(1))
				.andExpect(jsonPath("$.active").value(true))
				.andExpect(jsonPath("$.timeZone").value("Europe/Berlin"))
				.andExpect(jsonPath("$.weekStartsOn").value("MONDAY"))
				.andExpect(jsonPath("$.stackingStrategy").value("ADD"))
				.andExpect(jsonPath("$.rules", hasSize(0)))
				.andExpect(jsonPath("$.createdAt").isString());
	}

	/**
	 * PUT creates a new immutable version and leaves the old version unchanged.
	 */
	@Test
	void putCreatesNewVersionAndDoesNotMutateOldVersion() throws Exception {
		String foremanToken = registerAndLogin("foreman@example.com", "FOREMAN");
		long oldVersionId = payPolicyVersionRepository.findByCompanyIdWithRulesOrderByVersionDesc(
				companyRepository.findAll().getFirst().getId()
		).getFirst().getId();

		putPayPolicy(foremanToken, policyWithAllRuleTypes())
				.andExpect(status().isOk())
				.andExpect(jsonPath("$.id").isNumber())
				.andExpect(jsonPath("$.id").value(not((int) oldVersionId)))
				.andExpect(jsonPath("$.version").value(2))
				.andExpect(jsonPath("$.active").value(true))
				.andExpect(jsonPath("$.weekStartsOn").value("SUNDAY"))
				.andExpect(jsonPath("$.stackingStrategy").value("HIGHEST_ONLY"))
				.andExpect(jsonPath("$.rules", hasSize(5)))
				.andExpect(jsonPath("$.rules[0].name").value("Night shift"))
				.andExpect(jsonPath("$.rules[0].type").value("TIME_OF_DAY"))
				.andExpect(jsonPath("$.rules[0].premiumPercent").value(25.5000))
				.andExpect(jsonPath("$.rules[0].condition.startTime").value("22:00:00"))
				.andExpect(jsonPath("$.rules[0].condition.endTime").value("06:00:00"));

		List<PayPolicyVersion> versions = payPolicyVersionRepository.findByCompanyIdWithRulesOrderByVersionDesc(
				companyRepository.findAll().getFirst().getId()
		);
		assertThat(versions).hasSize(2);
		PayPolicyVersion newVersion = versions.get(0);
		PayPolicyVersion oldVersion = versions.get(1);
		assertThat(newVersion.getVersion()).isEqualTo(2);
		assertThat(newVersion.getRules()).hasSize(5);
		assertThat(oldVersion.getId()).isEqualTo(oldVersionId);
		assertThat(oldVersion.getVersion()).isEqualTo(1);
		assertThat(oldVersion.getRules()).isEmpty();
	}

	/**
	 * Versions are returned newest first and include old and current versions.
	 */
	@Test
	void versionsListIncludesOldAndNewVersionsNewestFirst() throws Exception {
		String foremanToken = registerAndLogin("foreman@example.com", "FOREMAN");
		putPayPolicy(foremanToken, policyWithAllRuleTypes()).andExpect(status().isOk());

		mockMvc.perform(get(PAY_POLICY_VERSIONS_URL)
						.header(HttpHeaders.AUTHORIZATION, "Bearer " + foremanToken))
				.andExpect(status().isOk())
				.andExpect(jsonPath("$", hasSize(2)))
				.andExpect(jsonPath("$[0].version").value(2))
				.andExpect(jsonPath("$[0].active").value(true))
				.andExpect(jsonPath("$[0].ruleCount").value(5))
				.andExpect(jsonPath("$[1].version").value(1))
				.andExpect(jsonPath("$[1].active").value(false))
				.andExpect(jsonPath("$[1].ruleCount").value(0));
	}

	/**
	 * WORKER and ADMIN cannot access pay policy management endpoints.
	 */
	@Test
	void workerAndAdminAreForbiddenFromPayPolicyEndpoints() throws Exception {
		String foremanToken = registerAndLogin("foreman@example.com", "FOREMAN");
		String workerToken = registerAndLogin("worker@example.com", "WORKER");
		String adminToken = createAdminAndLogin();

		getPayPolicy(workerToken).andExpect(status().isForbidden());
		getPayPolicy(adminToken).andExpect(status().isForbidden());
		putPayPolicy(workerToken, policyWithAllRuleTypes()).andExpect(status().isForbidden());
		putPayPolicy(adminToken, policyWithAllRuleTypes()).andExpect(status().isForbidden());
		mockMvc.perform(get(PAY_POLICY_VERSIONS_URL)
						.header(HttpHeaders.AUTHORIZATION, "Bearer " + workerToken))
				.andExpect(status().isForbidden());
		mockMvc.perform(get(PAY_POLICY_VERSIONS_URL)
						.header(HttpHeaders.AUTHORIZATION, "Bearer " + adminToken))
				.andExpect(status().isForbidden());

		getPayPolicy(foremanToken).andExpect(status().isOk());
	}

	/**
	 * A FOREMAN without a company receives a conflict for policy management.
	 */
	@Test
	void foremanWithoutCompanyReceivesConflict() throws Exception {
		String foremanToken = registerAndLoginWithoutCompany("foreman@example.com", "FOREMAN");

		getPayPolicy(foremanToken)
				.andExpect(status().isConflict())
				.andExpect(jsonPath("$.message").value("Foreman must create a company before managing pay policy"));
	}

	/**
	 * premiumPercent must stay in the canonical range and scale.
	 */
	@Test
	void premiumPercentRangeAndScaleValidation() throws Exception {
		String foremanToken = registerAndLogin("foreman@example.com", "FOREMAN");

		putPayPolicy(foremanToken, policyWithPremium("-0.0001"))
				.andExpect(status().isBadRequest())
				.andExpect(jsonPath("$.message").value(containsString("premiumPercent")));
		putPayPolicy(foremanToken, policyWithPremium("1000.0001"))
				.andExpect(status().isBadRequest())
				.andExpect(jsonPath("$.message").value(containsString("premiumPercent")));
		putPayPolicy(foremanToken, policyWithPremium("10.12345"))
				.andExpect(status().isBadRequest())
				.andExpect(jsonPath("$.message").value(containsString("scale")));
		putPayPolicy(foremanToken, policyWithPremium("1000.0000"))
				.andExpect(status().isOk())
				.andExpect(jsonPath("$.rules[0].premiumPercent").value(1000.0000));
	}

	/**
	 * Each rule type validates required config fields and accepts valid configs.
	 */
	@Test
	void ruleTypeConfigValidation() throws Exception {
		String foremanToken = registerAndLogin("foreman@example.com", "FOREMAN");

		putPayPolicy(foremanToken, invalidTimeOfDayEqualPayload())
				.andExpect(status().isBadRequest())
				.andExpect(jsonPath("$.message").value(containsString("endTime")));
		putPayPolicy(foremanToken, invalidDailyOvertimePayload())
				.andExpect(status().isBadRequest())
				.andExpect(jsonPath("$.message").value(containsString("thresholdMinutes")));
		putPayPolicy(foremanToken, invalidWeeklyOvertimePayload())
				.andExpect(status().isBadRequest())
				.andExpect(jsonPath("$.message").value(containsString("thresholdMinutes")));
		putPayPolicy(foremanToken, invalidDayOfWeekPayload())
				.andExpect(status().isBadRequest())
				.andExpect(jsonPath("$.message").value(containsString("weekdays")));
		putPayPolicy(foremanToken, invalidHolidayPayload())
				.andExpect(status().isBadRequest())
				.andExpect(jsonPath("$.message").value(containsString("dates")));

		putPayPolicy(foremanToken, policyWithAllRuleTypes())
				.andExpect(status().isOk())
				.andExpect(jsonPath("$.rules", hasSize(5)));
	}

	/**
	 * TIME_OF_DAY may cross midnight but may not have equal start and end.
	 */
	@Test
	void timeOfDayCrossingMidnightAcceptedAndEqualRejected() throws Exception {
		String foremanToken = registerAndLogin("foreman@example.com", "FOREMAN");

		putPayPolicy(foremanToken, timeOfDayPayload("22:00:00", "06:00:00"))
				.andExpect(status().isOk())
				.andExpect(jsonPath("$.rules[0].condition.startTime").value("22:00:00"))
				.andExpect(jsonPath("$.rules[0].condition.endTime").value("06:00:00"));

		putPayPolicy(foremanToken, timeOfDayPayload("08:00:00", "08:00:00"))
				.andExpect(status().isBadRequest())
				.andExpect(jsonPath("$.message").value(containsString("endTime")));
	}

	/**
	 * DAY_OF_WEEK accepts arbitrary weekdays.
	 */
	@Test
	void dayOfWeekSupportsArbitraryWeekdays() throws Exception {
		String foremanToken = registerAndLogin("foreman@example.com", "FOREMAN");

		putPayPolicy(foremanToken, dayOfWeekPayload())
				.andExpect(status().isOk())
				.andExpect(jsonPath("$.rules[0].condition.weekdays", hasSize(3)))
				.andExpect(jsonPath("$.rules[0].condition.weekdays[0]").value("TUESDAY"))
				.andExpect(jsonPath("$.rules[0].condition.weekdays[1]").value("THURSDAY"))
				.andExpect(jsonPath("$.rules[0].condition.weekdays[2]").value("SATURDAY"));
	}

	/**
	 * HOLIDAY accepts manual company-configured local dates with optional labels.
	 */
	@Test
	void holidayManualDatesAccepted() throws Exception {
		String foremanToken = registerAndLogin("foreman@example.com", "FOREMAN");

		putPayPolicy(foremanToken, holidayPayload())
				.andExpect(status().isOk())
				.andExpect(jsonPath("$.rules[0].condition.dates", hasSize(2)))
				.andExpect(jsonPath("$.rules[0].condition.dates[0].date").value("2026-12-24"))
				.andExpect(jsonPath("$.rules[0].condition.dates[0].label").value("Christmas Eve"))
				.andExpect(jsonPath("$.rules[0].condition.dates[1].date").value("2026-12-31"))
				.andExpect(jsonPath("$.rules[0].condition.dates[1].label").doesNotExist());
	}

	/**
	 * Shift start freezes the current policy version id on the shift.
	 */
	@Test
	void shiftStartFreezesCurrentPolicyVersion() throws Exception {
		String foremanToken = registerAndLogin("foreman@example.com", "FOREMAN");
		putPayPolicy(foremanToken, policyWithAllRuleTypes()).andExpect(status().isOk());
		long currentVersionId = payPolicyVersionRepository.findByCompanyIdWithRulesOrderByVersionDesc(
				companyRepository.findAll().getFirst().getId()
		).getFirst().getId();
		long shiftId = createShift(foremanToken);

		mockMvc.perform(post(CREATE_SHIFT_URL + "/" + shiftId + "/start")
						.header(HttpHeaders.AUTHORIZATION, "Bearer " + foremanToken))
				.andExpect(status().isOk())
				.andExpect(jsonPath("$.payPolicyVersionId").value(currentVersionId));

		ShiftSession shift = shiftSessionRepository.findById(shiftId).orElseThrow();
		assertThat(shift.getPayPolicyVersion()).isNotNull();
		assertThat(shift.getPayPolicyVersion().getId()).isEqualTo(currentVersionId);
	}

	/**
	 * Shift start fails with PAY_POLICY_REQUIRED when the current policy invariant is broken.
	 */
	@Test
	void shiftStartReturnsPayPolicyRequiredWhenInvariantBroken() throws Exception {
		String foremanToken = registerAndLogin("foreman@example.com", "FOREMAN");
		long shiftId = createShift(foremanToken);
		Long companyId = companyRepository.findAll().getFirst().getId();
		jdbcTemplate.update("update pay_policies set current_version_id = null where company_id = ?", companyId);

		mockMvc.perform(post(CREATE_SHIFT_URL + "/" + shiftId + "/start")
						.header(HttpHeaders.AUTHORIZATION, "Bearer " + foremanToken))
				.andExpect(status().isConflict())
				.andExpect(jsonPath("$.message").value("Current pay policy is required before starting a shift"))
				.andExpect(jsonPath("$.code").value("PAY_POLICY_REQUIRED"));
	}

	private ResultActions getPayPolicy(String accessToken) throws Exception {
		return mockMvc.perform(get(PAY_POLICY_URL)
				.header(HttpHeaders.AUTHORIZATION, "Bearer " + accessToken));
	}

	private ResultActions putPayPolicy(String accessToken, String payload) throws Exception {
		return mockMvc.perform(put(PAY_POLICY_URL)
				.header(HttpHeaders.AUTHORIZATION, "Bearer " + accessToken)
				.contentType(MediaType.APPLICATION_JSON)
				.content(payload));
	}

	private String registerAndLogin(String email, String role) throws Exception {
		String accessToken = registerAndLoginWithoutCompany(email, role);
		if ("FOREMAN".equals(role)) {
			createCompany(accessToken, "Acme Construction").andExpect(status().isCreated());
		}
		else if ("WORKER".equals(role)) {
			joinFirstCompany(accessToken);
		}
		return accessToken;
	}

	private String registerAndLoginWithoutCompany(String email, String role) throws Exception {
		mockMvc.perform(post(REGISTER_URL)
						.contentType(MediaType.APPLICATION_JSON)
						.content("""
								{
								  "email": "%s",
								  "password": "password123",
								  "firstName": "Test",
								  "lastName": "User",
								  "role": "%s"
								}
								""".formatted(email, role)))
				.andExpect(status().isCreated());
		return login(email);
	}

	private String createAdminAndLogin() throws Exception {
		User admin = new User();
		admin.setEmail("admin@example.com");
		admin.setPasswordHash(passwordEncoder.encode("password123"));
		admin.setFirstName("System");
		admin.setLastName("Admin");
		admin.setRole(Role.ADMIN);
		userRepository.saveAndFlush(admin);
		return login(admin.getEmail());
	}

	private ResultActions createCompany(String accessToken, String companyName) throws Exception {
		return mockMvc.perform(post(CREATE_COMPANY_URL)
				.header(HttpHeaders.AUTHORIZATION, "Bearer " + accessToken)
				.contentType(MediaType.APPLICATION_JSON)
				.content("""
						{
						  "name": "%s",
						  "currencyLabel": "EUR"
						}
						""".formatted(companyName)));
	}

	private long createShift(String accessToken) throws Exception {
		MvcResult result = mockMvc.perform(post(CREATE_SHIFT_URL)
						.header(HttpHeaders.AUTHORIZATION, "Bearer " + accessToken)
						.contentType(MediaType.APPLICATION_JSON)
						.content("""
								{
								  "location": "Cologne",
								  "defaultBreakMinutes": 0,
								  "defaultHourlyRate": 15.00,
								  "foremanHourlyRate": 25.00
								}
								"""))
				.andExpect(status().isCreated())
				.andReturn();
		return extractLong(result.getResponse().getContentAsString(), SHIFT_ID_PATTERN);
	}

	private void joinFirstCompany(String accessToken) throws Exception {
		Company company = companyRepository.findAll().stream()
				.findFirst()
				.orElse(null);
		if (company == null) {
			return;
		}
		mockMvc.perform(post("/api/v1/companies/join")
						.header(HttpHeaders.AUTHORIZATION, "Bearer " + accessToken)
						.contentType(MediaType.APPLICATION_JSON)
						.content("""
								{
								  "joinCode": "%s"
								}
								""".formatted(company.getJoinCode())))
				.andExpect(status().isOk());
	}

	private String login(String email) throws Exception {
		MvcResult result = mockMvc.perform(post(LOGIN_URL)
						.contentType(MediaType.APPLICATION_JSON)
						.content("""
								{
								  "email": "%s",
								  "password": "password123"
								}
								""".formatted(email)))
				.andExpect(status().isOk())
				.andReturn();
		return extractString(result.getResponse().getContentAsString(), ACCESS_TOKEN_PATTERN);
	}

	private String policyWithAllRuleTypes() {
		return """
				{
				  "weekStartsOn": "SUNDAY",
				  "stackingStrategy": "HIGHEST_ONLY",
				  "rules": [
				    {
				      "name": "Night shift",
				      "type": "TIME_OF_DAY",
				      "enabled": true,
				      "premiumPercent": 25.5000,
				      "condition": {
				        "startTime": "22:00:00",
				        "endTime": "06:00:00"
				      }
				    },
				    {
				      "name": "Daily overtime",
				      "type": "DAILY_OVERTIME",
				      "enabled": true,
				      "premiumPercent": 50.0000,
				      "condition": {
				        "thresholdMinutes": 480
				      }
				    },
				    {
				      "name": "Weekly overtime",
				      "type": "WEEKLY_OVERTIME",
				      "enabled": false,
				      "premiumPercent": 75.2500,
				      "condition": {
				        "thresholdMinutes": 2400
				      }
				    },
				    {
				      "name": "Weekend",
				      "type": "DAY_OF_WEEK",
				      "enabled": true,
				      "premiumPercent": 20.0000,
				      "condition": {
				        "weekdays": ["SATURDAY", "SUNDAY"]
				      }
				    },
				    {
				      "name": "Manual holidays",
				      "type": "HOLIDAY",
				      "enabled": true,
				      "premiumPercent": 100.0000,
				      "condition": {
				        "dates": [
				          {
				            "date": "2026-12-24",
				            "label": "Christmas Eve"
				          },
				          {
				            "date": "2026-12-31"
				          }
				        ]
				      }
				    }
				  ]
				}
				""";
	}

	private String policyWithPremium(String premiumPercent) {
		return """
				{
				  "weekStartsOn": "MONDAY",
				  "stackingStrategy": "ADD",
				  "rules": [
				    {
				      "name": "Daily overtime",
				      "type": "DAILY_OVERTIME",
				      "enabled": true,
				      "premiumPercent": %s,
				      "condition": {
				        "thresholdMinutes": 480
				      }
				    }
				  ]
				}
				""".formatted(premiumPercent);
	}

	private String timeOfDayPayload(String startTime, String endTime) {
		return """
				{
				  "weekStartsOn": "MONDAY",
				  "stackingStrategy": "ADD",
				  "rules": [
				    {
				      "name": "Night",
				      "type": "TIME_OF_DAY",
				      "enabled": true,
				      "premiumPercent": 10,
				      "condition": {
				        "startTime": "%s",
				        "endTime": "%s"
				      }
				    }
				  ]
				}
				""".formatted(startTime, endTime);
	}

	private String dayOfWeekPayload() {
		return """
				{
				  "weekStartsOn": "MONDAY",
				  "stackingStrategy": "ADD",
				  "rules": [
				    {
				      "name": "Custom weekdays",
				      "type": "DAY_OF_WEEK",
				      "enabled": true,
				      "premiumPercent": 12.5,
				      "condition": {
				        "weekdays": ["TUESDAY", "THURSDAY", "SATURDAY"]
				      }
				    }
				  ]
				}
				""";
	}

	private String holidayPayload() {
		return """
				{
				  "weekStartsOn": "MONDAY",
				  "stackingStrategy": "ADD",
				  "rules": [
				    {
				      "name": "Manual holidays",
				      "type": "HOLIDAY",
				      "enabled": true,
				      "premiumPercent": 100,
				      "condition": {
				        "dates": [
				          {
				            "date": "2026-12-24",
				            "label": "Christmas Eve"
				          },
				          {
				            "date": "2026-12-31"
				          }
				        ]
				      }
				    }
				  ]
				}
				""";
	}

	private String invalidTimeOfDayEqualPayload() {
		return timeOfDayPayload("08:00:00", "08:00:00");
	}

	private String invalidDailyOvertimePayload() {
		return """
				{
				  "weekStartsOn": "MONDAY",
				  "stackingStrategy": "ADD",
				  "rules": [
				    {
				      "name": "Daily overtime",
				      "type": "DAILY_OVERTIME",
				      "enabled": true,
				      "premiumPercent": 50,
				      "condition": {
				        "thresholdMinutes": 0
				      }
				    }
				  ]
				}
				""";
	}

	private String invalidWeeklyOvertimePayload() {
		return """
				{
				  "weekStartsOn": "MONDAY",
				  "stackingStrategy": "ADD",
				  "rules": [
				    {
				      "name": "Weekly overtime",
				      "type": "WEEKLY_OVERTIME",
				      "enabled": true,
				      "premiumPercent": 50,
				      "condition": {
				        "thresholdMinutes": -1
				      }
				    }
				  ]
				}
				""";
	}

	private String invalidDayOfWeekPayload() {
		return """
				{
				  "weekStartsOn": "MONDAY",
				  "stackingStrategy": "ADD",
				  "rules": [
				    {
				      "name": "Weekday",
				      "type": "DAY_OF_WEEK",
				      "enabled": true,
				      "premiumPercent": 10,
				      "condition": {
				        "weekdays": []
				      }
				    }
				  ]
				}
				""";
	}

	private String invalidHolidayPayload() {
		return """
				{
				  "weekStartsOn": "MONDAY",
				  "stackingStrategy": "ADD",
				  "rules": [
				    {
				      "name": "Holiday",
				      "type": "HOLIDAY",
				      "enabled": true,
				      "premiumPercent": 10,
				      "condition": {
				        "dates": []
				      }
				    }
				  ]
				}
				""";
	}

	private long extractLong(String response, Pattern pattern) {
		return Long.parseLong(extractString(response, pattern));
	}

	private String extractString(String response, Pattern pattern) {
		Matcher matcher = pattern.matcher(response);
		assertThat(matcher.find()).isTrue();
		return matcher.group(1);
	}
}
