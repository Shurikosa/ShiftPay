package com.shiftpay.mvp;

import org.springframework.jdbc.core.JdbcTemplate;

public final class TestDataCleaner {

	private TestDataCleaner() {
	}

	public static void clean(JdbcTemplate jdbcTemplate) {
		jdbcTemplate.update("delete from shift_attendance");
		jdbcTemplate.update("delete from shift_sessions");
		jdbcTemplate.update("delete from companies");
		jdbcTemplate.update("delete from users");
	}
}
