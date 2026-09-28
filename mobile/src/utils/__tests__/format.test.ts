import {
  formatAuditDecimal,
  formatDateTime,
  formatMinutes,
  formatMoney,
  formatMoneyWithCurrencyLabel,
  formatRate,
  formatWholeMoney,
  formatWholeMoneyWithCurrencyLabel
} from "../format";

describe("formatAuditDecimal", () => {
  it.each([
    [0, "0"],
    [0.00000001, "0.00000001"],
    [100.00400000, "100.004"],
    [37.5, "37.5"],
    [-0.00000001, "-0.00000001"],
    [1.23456789, "1.23456789"]
  ])("formats %s as %s with an explicit device locale", (value, expected) => {
    expect(formatAuditDecimal(value, "en-US")).toBe(expected);
  });
});

describe("money presentation", () => {
  it.each(["EUR", "€", "грн", "долар", "元"])(
    "preserves the opaque persisted %s label as an amount suffix",
    (currencyLabel) => {
      expect(formatMoneyWithCurrencyLabel(12.5, currencyLabel, "en-US")).toBe(
        `12.50 ${currencyLabel}`
      );
    }
  );

  it("does not rewrite labels or infer currency formatting from them", () => {
    expect(formatMoneyWithCurrencyLabel(1234.5, "€", "de-DE")).toBe(
      `${new Intl.NumberFormat("de-DE", {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2
      }).format(1234.5)} €`
    );
  });

  it("keeps a returned zero distinct from a pending amount", () => {
    expect(formatMoneyWithCurrencyLabel(0, "EUR", "en-US")).toBe("0.00 EUR");
    expect(formatMoneyWithCurrencyLabel(null, "EUR", "en-US")).toBe("Pending");
  });

  it("marks a present amount with a missing historical label as unavailable currency", () => {
    expect(formatMoneyWithCurrencyLabel(12.5, null, "en-US")).toBe(
      "12.50 (currency unavailable)"
    );
    expect(formatWholeMoneyWithCurrencyLabel(20, null, "en-US")).toBe(
      "20 (currency unavailable)"
    );
  });

  it("uses explicit scale-specific precision without currency semantics", () => {
    expect(formatMoney(1234.5, "en-US")).toBe("1,234.50");
    expect(formatRate(20, "en-US")).toBe("20.00");
    expect(formatWholeMoney(1234, "en-US")).toBe("1,234");
    expect(formatWholeMoneyWithCurrencyLabel(1234, "EUR", "en-US")).toBe("1,234 EUR");
    expect(formatAuditDecimal(12.34567891, "en-US")).toBe("12.34567891");
  });
});

describe("date and timestamp presentation", () => {
  const value = "2026-09-27T12:34:56Z";
  const dateTimeOptions: Intl.DateTimeFormatOptions = {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit"
  };

  it("uses an applicable IANA timezone when it is provided", () => {
    expect(formatDateTime(value, "Europe/Berlin", "en-US")).toBe(
      new Intl.DateTimeFormat("en-US", {
        ...dateTimeOptions,
        timeZone: "Europe/Berlin"
      }).format(new Date(value))
    );
  });

  it.each([undefined, null])(
    "falls back to the device timezone only when timezone is %s",
    (timeZone) => {
      expect(formatDateTime(value, timeZone, "en-US")).toBe(
        new Intl.DateTimeFormat("en-US", dateTimeOptions).format(new Date(value))
      );
    }
  );

  it.each(["Europe/Berln", "", "   "])(
    "returns an explicit unavailable state for invalid timezone %j",
    (timeZone) => {
      expect(formatDateTime(value, timeZone, "en-US")).toBe("Timezone unavailable");
    }
  );

  it("rejects malformed and calendar-invalid timestamp text rather than normalizing it", () => {
    expect(formatDateTime(null, "Europe/Berlin", "en-US")).toBe("Timestamp unavailable");
    expect(formatDateTime("2026-02-31T12:00:00Z", "Europe/Berlin", "en-US")).toBe(
      "Invalid timestamp"
    );
    expect(formatDateTime("2026-02-29T12:00:00Z", "Europe/Berlin", "en-US")).toBe(
      "Invalid timestamp"
    );
    expect(formatDateTime("not-a-timestamp", "Europe/Berlin", "en-US")).toBe(
      "Invalid timestamp"
    );
  });

  it("formats a valid leap-day backend instant", () => {
    expect(formatDateTime("2024-02-29T12:00:00Z", "Europe/Berlin", "en-US")).toBe(
      new Intl.DateTimeFormat("en-US", {
        ...dateTimeOptions,
        timeZone: "Europe/Berlin"
      }).format(new Date("2024-02-29T12:00:00Z"))
    );
  });

  it.each([
    [".1Z", ".100Z"],
    [".12Z", ".120Z"],
    [".123Z", ".123Z"],
    [".123456Z", ".123Z"],
    [".123456789Z", ".123Z"],
    [".123456+02:00", ".123+02:00"]
  ])("normalizes fractional seconds %s to %s before Date parsing", (fraction, normalizedFraction) => {
    const timestamp = `2026-09-27T12:34:56${fraction}`;
    const normalizedTimestamp = `2026-09-27T12:34:56${normalizedFraction}`;
    expect(formatDateTime(timestamp, "Europe/Berlin", "en-US")).toBe(
      new Intl.DateTimeFormat("en-US", {
        ...dateTimeOptions,
        timeZone: "Europe/Berlin"
      }).format(new Date(normalizedTimestamp))
    );
  });

  it("truncates fractional seconds beyond milliseconds without rounding", () => {
    const normalizedTimestamp = "2026-09-27T12:34:59.999Z";
    expect(formatDateTime("2026-09-27T12:34:59.9999Z", "UTC", "en-US")).toBe(
      new Intl.DateTimeFormat("en-US", {
        ...dateTimeOptions,
        timeZone: "UTC"
      }).format(new Date(normalizedTimestamp))
    );
  });

  it("accepts strict RFC3339 offsets while rejecting invalid clock and offset components", () => {
    expect(formatDateTime("2026-09-27T12:34:56+02:00", "Europe/Berlin", "en-US")).toBe(
      new Intl.DateTimeFormat("en-US", {
        ...dateTimeOptions,
        timeZone: "Europe/Berlin"
      }).format(new Date("2026-09-27T12:34:56+02:00"))
    );
    expect(formatDateTime("2026-09-27T24:00:00Z", "Europe/Berlin", "en-US")).toBe(
      "Invalid timestamp"
    );
    expect(formatDateTime("2026-09-27T12:00:00+24:00", "Europe/Berlin", "en-US")).toBe(
      "Invalid timestamp"
    );
  });
});

describe("duration presentation", () => {
  it("formats zero and whole duration values through the supplied device locale", () => {
    expect(formatMinutes(0, "en-US")).toBe("0 min");
    expect(formatMinutes(45, "en-US")).toBe("45 min");
    expect(formatMinutes(120, "en-US")).toBe("2 h 0 min");
    expect(formatMinutes(125, "en-US")).toBe("2 h 5 min");
  });

  it("uses locale-aware digits without changing backend minute values", () => {
    const formatter = new Intl.NumberFormat("ar-EG", {
      minimumFractionDigits: 0,
      maximumFractionDigits: 0
    });
    expect(formatMinutes(125, "ar-EG")).toBe(
      `${formatter.format(2)} h ${formatter.format(5)} min`
    );
  });

  it("keeps absent durations pending", () => {
    expect(formatMinutes(null, "en-US")).toBe("Pending");
    expect(formatMinutes(undefined, "en-US")).toBe("Pending");
  });
});
