import { formatAuditDecimal } from "../format";

describe("formatAuditDecimal", () => {
  it.each([
    [0, "0"],
    [0.00000001, "0.00000001"],
    [100.00400000, "100.004"],
    [37.5, "37.5"],
    [-0.00000001, "-0.00000001"],
    [1.23456789, "1.23456789"]
  ])("formats %s as %s", (value, expected) => {
    expect(formatAuditDecimal(value)).toBe(expected);
  });
});
