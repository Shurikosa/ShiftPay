const boundaryWhiteSpace = "\\u0009-\\u000D\\u0020\\u0085\\u00A0\\u1680\\u2000-\\u200A\\u2028\\u2029\\u202F\\u205F\\u3000";
const boundaryWhiteSpaceExpression = new RegExp(
  `^[${boundaryWhiteSpace}]+|[${boundaryWhiteSpace}]+$`,
  "g"
);

export function trimCurrencyLabelBoundaries(value: string): string {
  return value.replace(boundaryWhiteSpaceExpression, "");
}

export function validateCurrencyLabel(value: string): string | undefined {
  const trimmed = trimCurrencyLabelBoundaries(value);

  if (trimmed.length === 0) {
    return "Enter a currency label.";
  }

  if (Array.from(trimmed).length > 64) {
    return "Use 64 Unicode characters or fewer.";
  }

  return undefined;
}

export function parseOptionalRate(value: string): number | null | undefined {
  const normalized = value.trim().replace(",", ".");

  if (normalized.length === 0) {
    return null;
  }

  if (!/^\d+(?:\.\d{1,2})?$/.test(normalized)) {
    return undefined;
  }

  const parsed = Number(normalized);
  if (!Number.isFinite(parsed) || parsed < 0 || /^\d{11,}/.test(normalized)) {
    return undefined;
  }

  return parsed;
}

export function getCompanySettingsFieldError(message: string): {
  field?: "name" | "currencyLabel" | "defaultWorkerHourlyRate" | "defaultForemanHourlyRate";
  message: string;
} {
  const match = /^(name|currencyLabel|defaultWorkerHourlyRate|defaultForemanHourlyRate):\s*(.+)$/.exec(
    message
  );

  return match
    ? {
        field: match[1] as
          | "name"
          | "currencyLabel"
          | "defaultWorkerHourlyRate"
          | "defaultForemanHourlyRate",
        message: match[2] ?? message
      }
    : { message };
}
