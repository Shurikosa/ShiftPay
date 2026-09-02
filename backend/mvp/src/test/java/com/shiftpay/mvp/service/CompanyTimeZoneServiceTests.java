package com.shiftpay.mvp.service;

import com.shiftpay.mvp.exception.BadRequestException;
import org.junit.jupiter.api.Test;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

/**
 * Unit tests for company timezone validation.
 */
class CompanyTimeZoneServiceTests {

	/**
	 * Accepts canonical IANA timezone ids.
	 */
	@Test
	void acceptsValidIanaTimezone() {
		CompanyTimeZoneService service = new CompanyTimeZoneService("Europe/Berlin");

		assertThat(service.resolveForCreate("America/New_York")).isEqualTo("America/New_York");
		assertThat(service.resolveForCreate("UTC")).isEqualTo("UTC");
	}

	/**
	 * Rejects fixed offset ids even though {@code ZoneId.of} can parse them.
	 */
	@Test
	void rejectsFixedOffsetTimezone() {
		CompanyTimeZoneService service = new CompanyTimeZoneService("Europe/Berlin");

		assertThatThrownBy(() -> service.resolveForCreate("+02:00"))
				.isInstanceOf(BadRequestException.class)
				.hasMessage("timeZone: must be a valid IANA timezone id");
	}

	/**
	 * Rejects {@code Z} because it is an offset designator, not an available IANA zone id.
	 */
	@Test
	void rejectsZTimezone() {
		CompanyTimeZoneService service = new CompanyTimeZoneService("Europe/Berlin");

		assertThatThrownBy(() -> service.resolveForCreate("Z"))
				.isInstanceOf(BadRequestException.class)
				.hasMessage("timeZone: must be a valid IANA timezone id");
	}

	/**
	 * Rejects GMT fixed-offset style ids that are not in {@code ZoneId.getAvailableZoneIds()}.
	 */
	@Test
	void rejectsGmtOffsetTimezone() {
		CompanyTimeZoneService service = new CompanyTimeZoneService("Europe/Berlin");

		assertThatThrownBy(() -> service.resolveForCreate("GMT+02:00"))
				.isInstanceOf(BadRequestException.class)
				.hasMessage("timeZone: must be a valid IANA timezone id");
	}

	/**
	 * Fails fast when the configured backend default timezone is not an IANA zone id.
	 */
	@Test
	void invalidDefaultTimezoneFailsFast() {
		assertThatThrownBy(() -> new CompanyTimeZoneService("+02:00"))
				.isInstanceOf(BadRequestException.class)
				.hasMessage("shiftpay.default-time-zone: must be a valid IANA timezone id");
	}
}
