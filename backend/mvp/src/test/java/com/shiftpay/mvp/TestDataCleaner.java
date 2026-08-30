package com.shiftpay.mvp;

import org.springframework.jdbc.core.JdbcTemplate;

/**
 * Shared test utility that removes persisted MVP data between integration tests.
 *
 * <p>Tables are cleared from children to parents: attendance references shifts and users, shifts reference
 * companies and users, and users reference companies. This keeps tests isolated while avoiding foreign-key
 * violations.</p>
 */
public final class TestDataCleaner {

	/**
	 * Prevents instantiation of the static cleanup utility.
	 */
	private TestDataCleaner() {
	}

	/**
	 * Deletes mutable test data so each integration test starts from an empty application dataset.
	 *
	 * @param jdbcTemplate JDBC helper connected to the test database
	 */
	public static void clean(JdbcTemplate jdbcTemplate) {
		jdbcTemplate.update("delete from payout_request_items");
		jdbcTemplate.update("delete from payout_requests");
		jdbcTemplate.update("delete from shift_pause_intervals");
		jdbcTemplate.update("delete from shift_attendance");
		jdbcTemplate.update("delete from shift_sessions");
		jdbcTemplate.update("delete from users");
		jdbcTemplate.update("delete from companies");
	}
}
