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

@SpringBootTest
@AutoConfigureMockMvc
class MvpApplicationTests {

	@Autowired
	private MockMvc mockMvc;

	@Autowired
	private JdbcTemplate jdbcTemplate;

	@Test
	void contextLoads() {
	}

	@Test
	void healthEndpointReturnsUp() throws Exception {
		mockMvc.perform(get("/api/v1/health"))
				.andExpect(status().isOk())
				.andExpect(content().contentTypeCompatibleWith(MediaType.APPLICATION_JSON))
				.andExpect(jsonPath("$.status").value("UP"));
	}

	@Test
	void flywayMigrationsCreateMvpTables() {
		assertThat(countRows("users")).isNotNegative();
		assertThat(countRows("companies")).isNotNegative();
		assertThat(countRows("shift_sessions")).isNotNegative();
		assertThat(countRows("shift_attendance")).isNotNegative();
		assertThat(countColumn("shift_sessions", "default_hourly_rate")).isEqualTo(1);
		assertThat(latestFlywayVersion()).isEqualTo("5");
	}

	private Long countRows(String tableName) {
		return jdbcTemplate.queryForObject("select count(*) from " + tableName, Long.class);
	}

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
