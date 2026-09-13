package com.shiftpay.mvp.testsupport;

import org.hibernate.resource.jdbc.spi.StatementInspector;

import java.util.List;
import java.util.Locale;
import java.util.Queue;
import java.util.concurrent.ConcurrentLinkedQueue;

/**
 * Thread-safe test collector for SQL statements observed by Hibernate.
 */
public final class SqlStatementCollector implements StatementInspector {

	private final Queue<String> statements = new ConcurrentLinkedQueue<>();

	@Override
	public String inspect(String sql) {
		if (sql != null) {
			statements.add(sql);
		}
		return sql;
	}

	/**
	 * Removes statements captured before the next test action.
	 */
	public void clear() {
		statements.clear();
	}

	/**
	 * Returns an immutable copy of the statements captured so far.
	 *
	 * @return captured SQL statements
	 */
	public List<String> snapshot() {
		return List.copyOf(statements);
	}

	/**
	 * Counts captured statements containing a table-name fragment without regard to case.
	 *
	 * @param fragment table-name fragment to find
	 * @return number of matching statements
	 */
	public long countContainingIgnoreCase(String fragment) {
		String normalizedFragment = fragment.toLowerCase(Locale.ROOT);
		return statements.stream()
				.filter(statement -> statement.toLowerCase(Locale.ROOT).contains(normalizedFragment))
				.count();
	}
}
