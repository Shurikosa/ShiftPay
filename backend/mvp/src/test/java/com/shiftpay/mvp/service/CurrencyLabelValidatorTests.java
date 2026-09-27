package com.shiftpay.mvp.service;

import com.shiftpay.mvp.exception.BadRequestException;
import org.junit.jupiter.api.Test;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

/**
 * Unit tests for the canonical currency-label boundary whitespace algorithm.
 */
class CurrencyLabelValidatorTests {

	private final CurrencyLabelValidator validator = new CurrencyLabelValidator();

	/**
	 * The exact Unicode White_Space boundary set is removed without altering the label itself.
	 */
	@Test
	void removesEveryDocumentedBoundaryWhitespaceCodePointAndPreservesInteriorContent() {
		int[] boundaryWhitespace = {
				0x0009, 0x000A, 0x000B, 0x000C, 0x000D, 0x0020, 0x0085, 0x00A0, 0x1680,
				0x2000, 0x2001, 0x2002, 0x2003, 0x2004, 0x2005, 0x2006, 0x2007, 0x2008,
				0x2009, 0x200A, 0x2028, 0x2029, 0x202F, 0x205F, 0x3000
		};

		for (int codePoint : boundaryWhitespace) {
			String whitespace = new String(Character.toChars(codePoint));
			assertThat(validator.normalizeRequired(whitespace + "грн" + whitespace))
					.as("U+%04X", codePoint)
					.isEqualTo("грн");
		}

		String noBreakSpace = new String(Character.toChars(0x00A0));
		assertThat(validator.normalizeRequired("EU" + noBreakSpace + "R")).isEqualTo("EU" + noBreakSpace + "R");
		assertThat(validator.normalizeRequired("\u200BEUR\u200B")).isEqualTo("\u200BEUR\u200B");
	}

	/**
	 * Limits labels by Unicode code points rather than UTF-16 code units.
	 */
	@Test
	void enforcesThePostTrimLimitByUnicodeCodePoint() {
		String emoji = "\uD83D\uDE00";
		String exactlySixtyFourCodePoints = emoji.repeat(64);
		String sixtyFiveCodePoints = emoji.repeat(65);

		assertThat(validator.normalizeRequired(exactlySixtyFourCodePoints)).isEqualTo(exactlySixtyFourCodePoints);
		assertThatThrownBy(() -> validator.normalizeRequired(sixtyFiveCodePoints))
				.isInstanceOf(BadRequestException.class)
				.hasMessage("currencyLabel: size must be between 1 and 64");
	}

	/**
	 * Null and values empty after the exact boundary trim are invalid.
	 */
	@Test
	void rejectsNullAndBoundaryWhitespaceOnlyLabels() {
		assertThatThrownBy(() -> validator.normalizeRequired(null))
				.isInstanceOf(BadRequestException.class)
				.hasMessage("currencyLabel: must not be blank");
		assertThatThrownBy(() -> validator.normalizeRequired("\u00A0\u2009\u3000"))
				.isInstanceOf(BadRequestException.class)
				.hasMessage("currencyLabel: must not be blank");
	}
}
