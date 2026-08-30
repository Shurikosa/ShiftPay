package com.shiftpay.mvp;

import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.http.MediaType;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.test.web.servlet.MockMvc;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.content;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/**
 * Context and smoke tests for the complete Spring Boot backend application.
 *
 * <p>The class verifies that the application context starts, the public health endpoint responds, and Flyway creates
 * the MVP schema expected by authentication, shift, attendance, and salary tests.</p>
 */
@SpringBootTest
@AutoConfigureMockMvc
class MvpApplicationTests {

	@Autowired
	private MockMvc mockMvc;

	@Autowired
	private JdbcTemplate jdbcTemplate;

	/**
	 * Starts the full Spring context to catch configuration, bean wiring, and migration startup failures.
	 */
	@Test
	void contextLoads() {
	}

	/**
	 * Checks the unauthenticated health endpoint used by clients and deployment probes.
	 */
	@Test
	void healthEndpointReturnsUp() throws Exception {
		mockMvc.perform(get("/api/v1/health"))
				.andExpect(status().isOk())
				.andExpect(content().contentTypeCompatibleWith(MediaType.APPLICATION_JSON))
				.andExpect(jsonPath("$.status").value("UP"));
	}

	/**
	 * Confirms Flyway has created the backend MVP tables and applied the latest expected migration.
	 */
	@Test
	void flywayMigrationsCreateMvpTables() {
		assertThat(countRows("users")).isNotNegative();
		assertThat(countRows("companies")).isNotNegative();
		assertThat(countRows("shift_sessions")).isNotNegative();
		assertThat(countRows("shift_attendance")).isNotNegative();
		assertThat(countRows("shift_pause_intervals")).isNotNegative();
		assertThat(countRows("payout_requests")).isNotNegative();
		assertThat(countRows("payout_request_items")).isNotNegative();
		assertThat(countColumn("companies", "join_code")).isEqualTo(1);
		assertThat(countColumn("users", "company_id")).isEqualTo(1);
		assertThat(countColumn("shift_sessions", "default_hourly_rate")).isEqualTo(1);
		assertThat(countColumn("shift_sessions", "foreman_hourly_rate")).isEqualTo(1);
		assertThat(countColumn("shift_sessions", "foreman_worked_minutes")).isEqualTo(1);
		assertThat(countColumn("shift_sessions", "foreman_pause_minutes")).isEqualTo(1);
		assertThat(countColumn("shift_sessions", "foreman_calculated_salary")).isEqualTo(1);
		assertThat(countColumn("shift_attendance", "pause_minutes")).isEqualTo(1);
		assertThat(countColumn("shift_attendance", "payable_start_time")).isEqualTo(1);
		assertThat(countColumn("shift_attendance", "payment_status")).isEqualTo(1);
		assertThat(countColumn("shift_attendance", "paid_at")).isEqualTo(1);
		assertThat(countColumn("payout_requests", "manager_foreman_id")).isEqualTo(1);
		assertThat(countColumn("payout_request_items", "rounded_item_amount_exact")).isEqualTo(1);
		assertThat(latestFlywayVersion()).isEqualTo("10");
	}

	/**
	 * Counts rows in a migrated table to prove that the table exists and can be queried.
	 *
	 * @param tableName database table name
	 * @return number of rows currently in the table
	 */
	private Long countRows(String tableName) {
		return jdbcTemplate.queryForObject("select count(*) from " + tableName, Long.class);
	}

	/**
	 * Checks whether a specific column exists in the H2 information schema.
	 *
	 * @param tableName database table name
	 * @param columnName column expected on the table
	 * @return number of matching columns
	 */
	private Long countColumn(String tableName, String columnName) {
		return jdbcTemplate.queryForObject(
				"""
						select count(*)
						from information_schema.columns
						where table_name = ? and column_name = ?
						""",
				Long.class,
				tableName,
				columnName
		);
	}

	/**
	 * Reads the newest successful Flyway migration version recorded in schema history.
	 *
	 * @return latest applied migration version
	 */
	private String latestFlywayVersion() {
		return jdbcTemplate.queryForObject(
				"""
						select version
						from flyway_schema_history
						where success = true
						order by installed_rank desc
						limit 1
						""",
				String.class
		);
	}

}
