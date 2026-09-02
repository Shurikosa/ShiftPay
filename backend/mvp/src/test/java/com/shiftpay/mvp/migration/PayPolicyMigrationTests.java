package com.shiftpay.mvp.migration;

import org.flywaydb.core.Flyway;
import org.junit.jupiter.api.Test;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.datasource.DriverManagerDataSource;

import java.util.Map;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * Focused migration tests for pay-policy backfill behavior on pre-policy data.
 */
class PayPolicyMigrationTests {

	/**
	 * Runs migrations through V11, creates an existing company, then runs V12 and verifies default policy backfill.
	 */
	@Test
	void v12BackfillsExistingCompaniesWithTimezoneAndDefaultPolicy() {
		String databaseName = "pay_policy_migration_" + UUID.randomUUID().toString().replace("-", "");
		String jdbcUrl = "jdbc:h2:mem:" + databaseName
				+ ";MODE=PostgreSQL;DATABASE_TO_LOWER=TRUE;DB_CLOSE_DELAY=-1;DB_CLOSE_ON_EXIT=FALSE";
		DriverManagerDataSource dataSource = new DriverManagerDataSource(jdbcUrl, "sa", "");
		JdbcTemplate jdbcTemplate = new JdbcTemplate(dataSource);

		Flyway.configure()
				.dataSource(dataSource)
				.locations("classpath:db/migration")
				.placeholders(Map.of("default_timezone", "Europe/Berlin"))
				.target("11")
				.load()
				.migrate();

		jdbcTemplate.update("insert into companies (name, join_code) values (?, ?)", "Legacy Company", "LEGACY");

		Flyway.configure()
				.dataSource(dataSource)
				.locations("classpath:db/migration")
				.placeholders(Map.of("default_timezone", "Europe/Berlin"))
				.load()
				.migrate();

		Long companyId = jdbcTemplate.queryForObject(
				"select id from companies where join_code = ?",
				Long.class,
				"LEGACY"
		);
		String timeZone = jdbcTemplate.queryForObject(
				"select time_zone from companies where id = ?",
				String.class,
				companyId
		);
		Integer policyCount = jdbcTemplate.queryForObject(
				"select count(*) from pay_policies where company_id = ?",
				Integer.class,
				companyId
		);
		Integer versionCount = jdbcTemplate.queryForObject(
				"""
				select count(*)
				from pay_policy_versions versions
				join pay_policies policies on policies.current_version_id = versions.id
				where versions.company_id = ?
				""",
				Integer.class,
				companyId
		);
		Integer ruleCount = jdbcTemplate.queryForObject(
				"""
				select count(*)
				from pay_policy_rules rules
				join pay_policy_versions versions on versions.id = rules.pay_policy_version_id
				where versions.company_id = ?
				""",
				Integer.class,
				companyId
		);

		assertThat(timeZone).isEqualTo("Europe/Berlin");
		assertThat(policyCount).isEqualTo(1);
		assertThat(versionCount).isEqualTo(1);
		assertThat(ruleCount).isZero();
	}
}
