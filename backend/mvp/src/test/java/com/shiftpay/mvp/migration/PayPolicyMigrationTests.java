package com.shiftpay.mvp.migration;

import org.flywaydb.core.Flyway;
import org.junit.jupiter.api.Test;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.datasource.DriverManagerDataSource;
import org.springframework.jdbc.datasource.SingleConnectionDataSource;

import java.math.BigDecimal;
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

	/**
	 * V13 must preserve the settlement snapshots already stored by the payroll-request schema. These records predate
	 * PayCalculation, so their audit components are a historical salary fallback rather than a recalculation.
	 */
	@Test
	void v13BackfillsLegacyPayoutAuditComponentsFromStoredSettlementAmounts() {
		String databaseName = "payout_audit_migration_" + UUID.randomUUID().toString().replace("-", "");
		String jdbcUrl = "jdbc:h2:mem:" + databaseName
				+ ";MODE=PostgreSQL;DATABASE_TO_LOWER=TRUE;DB_CLOSE_DELAY=-1;DB_CLOSE_ON_EXIT=FALSE";
		SingleConnectionDataSource dataSource = new SingleConnectionDataSource(jdbcUrl, "sa", "", true);
		JdbcTemplate jdbcTemplate = new JdbcTemplate(dataSource);

		Flyway.configure()
				.dataSource(dataSource)
				.locations("classpath:db/migration")
				.placeholders(Map.of("default_timezone", "Europe/Berlin"))
				.target("12")
				.load()
				.migrate();

		jdbcTemplate.update(
				"insert into companies (name, join_code, time_zone) values (?, ?, ?)",
				"Legacy payroll company", "PAYOLD", "Europe/Berlin"
		);
		Long companyId = jdbcTemplate.queryForObject(
				"select id from companies where join_code = ?", Long.class, "PAYOLD"
		);
		jdbcTemplate.update(
				"insert into users (email, password_hash, first_name, last_name, role, company_id) values (?, ?, ?, ?, 'FOREMAN', ?)",
				"legacy.foreman@example.com", "hash", "Legacy", "Foreman", companyId
		);
		jdbcTemplate.update(
				"insert into users (email, password_hash, first_name, last_name, role, company_id) values (?, ?, ?, ?, 'WORKER', ?)",
				"legacy.worker@example.com", "hash", "Legacy", "Worker", companyId
		);
		Long foremanId = jdbcTemplate.queryForObject(
				"select id from users where email = ?", Long.class, "legacy.foreman@example.com"
		);
		Long workerId = jdbcTemplate.queryForObject(
				"select id from users where email = ?", Long.class, "legacy.worker@example.com"
		);
		jdbcTemplate.update("""
				insert into shift_sessions (
					company_id, title, join_code, status, actual_start_time, actual_end_time,
					default_break_minutes, default_hourly_rate, foreman_hourly_rate, created_by
				) values (?, ?, ?, 'CLOSED', current_timestamp, current_timestamp, 0, 15, 25, ?)
				""", companyId, "Legacy payout shift", "PAYOLD1", foremanId);
		Long shiftId = jdbcTemplate.queryForObject(
				"select id from shift_sessions where join_code = ?", Long.class, "PAYOLD1"
		);
		jdbcTemplate.update("""
				insert into shift_attendance (
					shift_session_id, worker_id, status, hourly_rate, break_minutes, worked_minutes,
					calculated_salary, payment_status, paid_at, approved_at
				) values (?, ?, 'APPROVED', 15, 0, 49, 12.34, 'PAID', current_timestamp, current_timestamp)
				""", shiftId, workerId);
		Long attendanceId = jdbcTemplate.queryForObject(
				"select id from shift_attendance where shift_session_id = ?", Long.class, shiftId
		);
		jdbcTemplate.update("""
				insert into payout_requests (
					company_id, worker_id, manager_foreman_id, status, raw_payable_minutes_total,
					payout_rounded_minutes_total, exact_calculated_amount_total, payout_amount, requested_at,
					approved_by, approved_at, paid_at
				) values (?, ?, ?, 'APPROVED', 49, 50, 12.34, 13, current_timestamp,
					?, current_timestamp, current_timestamp)
				""", companyId, workerId, foremanId, foremanId);
		Long requestId = jdbcTemplate.queryForObject("select max(id) from payout_requests", Long.class);
		jdbcTemplate.update("""
				insert into payout_request_items (
					payout_request_id, attendance_id, shift_session_id, shift_title, shift_actual_start_time,
					shift_actual_end_time, raw_payable_minutes, payout_rounded_minutes, hourly_rate,
					calculated_salary, rounded_item_amount_exact, payout_amount, paid_at
				) values (?, ?, ?, ?, current_timestamp, current_timestamp, 49, 50, 15, 12.34, 12.34, 13,
					current_timestamp)
				""", requestId, attendanceId, shiftId, "Legacy payout shift");
		Map<String, Object> before = jdbcTemplate.queryForMap(
				"select status, payout_amount, requested_at, approved_at, paid_at from payout_requests where id = ?", requestId
		);

		Flyway.configure()
				.dataSource(dataSource)
				.locations("classpath:db/migration")
				.placeholders(Map.of("default_timezone", "Europe/Berlin"))
				.load()
				.migrate();

		BigDecimal requestBase = jdbcTemplate.queryForObject(
				"select total_base_amount from payout_requests where id = ?", BigDecimal.class, requestId
		);
		BigDecimal requestPremium = jdbcTemplate.queryForObject(
				"select total_premium_amount from payout_requests where id = ?", BigDecimal.class, requestId
		);
		BigDecimal itemBase = jdbcTemplate.queryForObject(
				"select total_base_amount from payout_request_items where attendance_id = ?", BigDecimal.class, attendanceId
		);
		BigDecimal itemPremium = jdbcTemplate.queryForObject(
				"select total_premium_amount from payout_request_items where attendance_id = ?", BigDecimal.class, attendanceId
		);
		Map<String, Object> after = jdbcTemplate.queryForMap(
				"select status, payout_amount, requested_at, approved_at, paid_at from payout_requests where id = ?", requestId
		);

		assertThat(requestBase).isEqualByComparingTo("12.34000000");
		assertThat(requestPremium).isEqualByComparingTo("0.00000000");
		assertThat(itemBase).isEqualByComparingTo("12.34000000");
		assertThat(itemPremium).isEqualByComparingTo("0.00000000");
		assertThat(requestBase.scale()).isEqualTo(8);
		assertThat(requestPremium.scale()).isEqualTo(8);
		assertThat(itemBase.scale()).isEqualTo(8);
		assertThat(itemPremium.scale()).isEqualTo(8);
		assertThat(after).isEqualTo(before);
		assertThat(jdbcTemplate.queryForObject("select count(*) from pay_calculations", Integer.class)).isZero();
		dataSource.destroy();
	}
}
