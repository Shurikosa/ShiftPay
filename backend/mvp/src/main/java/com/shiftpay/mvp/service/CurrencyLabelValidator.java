package com.shiftpay.mvp.service;

import com.shiftpay.mvp.exception.BadRequestException;
import org.springframework.stereotype.Component;

/** Validates and preserves opaque company currency labels using the API boundary whitespace definition. */
@Component
public class CurrencyLabelValidator {

	private static final int MAX_CODE_POINTS = 64;

	public String normalizeRequired(String value) {
		if (value == null) {
			throw new BadRequestException("currencyLabel: must not be blank");
		}
		int start = 0;
		int end = value.length();
		while (start < end) {
			int codePoint = value.codePointAt(start);
			if (!isBoundaryWhitespace(codePoint)) {
				break;
			}
			start += Character.charCount(codePoint);
		}
		while (start < end) {
			int codePoint = value.codePointBefore(end);
			if (!isBoundaryWhitespace(codePoint)) {
				break;
			}
			end -= Character.charCount(codePoint);
		}
		String normalized = value.substring(start, end);
		if (normalized.isEmpty()) {
			throw new BadRequestException("currencyLabel: must not be blank");
		}
		if (normalized.codePointCount(0, normalized.length()) > MAX_CODE_POINTS) {
			throw new BadRequestException("currencyLabel: size must be between 1 and 64");
		}
		return normalized;
	}

	private boolean isBoundaryWhitespace(int codePoint) {
		return (codePoint >= 0x0009 && codePoint <= 0x000D)
				|| codePoint == 0x0020 || codePoint == 0x0085 || codePoint == 0x00A0 || codePoint == 0x1680
				|| (codePoint >= 0x2000 && codePoint <= 0x200A)
				|| codePoint == 0x2028 || codePoint == 0x2029 || codePoint == 0x202F || codePoint == 0x205F
				|| codePoint == 0x3000;
	}
}
