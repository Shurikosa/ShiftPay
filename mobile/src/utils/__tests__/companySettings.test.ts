import {
  parseOptionalRate,
  trimCurrencyLabelBoundaries,
  validateCurrencyLabel
} from "../companySettings";

describe("company currency-label validation", () => {
  it("uses only the documented Unicode boundary whitespace and preserves content", () => {
    expect(trimCurrencyLabelBoundaries("\u00A0€\u3000")).toBe("€");
    expect(trimCurrencyLabelBoundaries("EUR\u2007USD")).toBe("EUR\u2007USD");
    expect(validateCurrencyLabel("\u2000\u202F")).toBe("Enter a currency label.");
  });

  it("counts Unicode code points rather than UTF-16 units", () => {
    expect(validateCurrencyLabel("😀".repeat(64))).toBeUndefined();
    expect(validateCurrencyLabel("😀".repeat(65))).toBe("Use 64 Unicode characters or fewer.");
  });

  it("accepts free-form labels and preserves numeric zero defaults", () => {
    for (const label of ["EUR", "€", "долар", "грн", "元"]) {
      expect(validateCurrencyLabel(label)).toBeUndefined();
    }
    expect(parseOptionalRate("")).toBeNull();
    expect(parseOptionalRate("0")).toBe(0);
    expect(parseOptionalRate("1.234")).toBeUndefined();
  });
});
