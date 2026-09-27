package com.shiftpay.mvp.service;

import com.shiftpay.mvp.exception.BadRequestException;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

import java.time.ZoneId;
import java.util.Set;

/**
 * Resolves and validates company IANA timezone ids.
 */
@Service
public class CompanyTimeZoneService {

	private static final Set<String> AVAILABLE_ZONE_IDS = Set.copyOf(ZoneId.getAvailableZoneIds());

	private final String defaultTimeZone;

	/**
	 * Creates the service with the backend default timezone.
	 *
	 * @param defaultTimeZone configured backend default timezone id
	 */
	public CompanyTimeZoneService(@Value("${shiftpay.default-time-zone:Europe/Berlin}") String defaultTimeZone) {
		this.defaultTimeZone = validateTimeZone(defaultTimeZone, "shiftpay.default-time-zone");
	}

	/**
	 * Resolves an optional request timezone, falling back to the backend default when omitted.
	 *
	 * @param requestedTimeZone optional request timezone
	 * @return valid IANA timezone id
	 */
	public String resolveForCreate(String requestedTimeZone) {
		if (requestedTimeZone == null || requestedTimeZone.isBlank()) {
			return defaultTimeZone;
		}
		return validateTimeZone(requestedTimeZone.trim(), "timeZone");
	}

	/**
	 * Validates a timezone id.
	 *
	 * @param timeZone timezone id
	 * @param fieldName field label used in errors
	 * @return normalized timezone id
	 */
	public String validateTimeZone(String timeZone, String fieldName) {
		if (timeZone == null || timeZone.isBlank()) {
			throw new BadRequestException(fieldName + ": must not be blank");
		}
		String normalizedTimeZone = timeZone.trim();
		if (!AVAILABLE_ZONE_IDS.contains(normalizedTimeZone)) {
			throw new BadRequestException(fieldName + ": must be a valid IANA timezone id");
		}
		return normalizedTimeZone;
	}

	/**
	 * Returns the configured backend default timezone id.
	 *
	 * @return default timezone
	 */
	public String defaultTimeZone() {
		return defaultTimeZone;
	}
}
