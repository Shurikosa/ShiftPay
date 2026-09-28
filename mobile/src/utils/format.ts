type DeviceLocale = string | undefined;

const pendingAmount = "Pending";
const invalidTimestamp = "Invalid timestamp";
const unavailableTimeZone = "Timezone unavailable";
const rfc3339Instant = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})(?:\.(\d+))?(Z|[+-]\d{2}:\d{2})$/;

function isLeapYear(year: number): boolean {
  return year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0);
}

function daysInMonth(year: number, month: number): number {
  return [31, isLeapYear(year) ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31][
    month - 1
  ]!;
}

function parseRfc3339Instant(value: string): Date | null {
  const match = rfc3339Instant.exec(value);
  if (!match) {
    return null;
  }

  const [
    ,
    yearText,
    monthText,
    dayText,
    hourText,
    minuteText,
    secondText,
    fractionalSecondText,
    offset
  ] = match;
  if (!yearText || !monthText || !dayText || !hourText || !minuteText || !secondText || !offset) {
    return null;
  }
  const year = Number(yearText);
  const month = Number(monthText);
  const day = Number(dayText);
  const hour = Number(hourText);
  const minute = Number(minuteText);
  const second = Number(secondText);

  if (
    month < 1 ||
    month > 12 ||
    day < 1 ||
    day > daysInMonth(year, month) ||
    hour > 23 ||
    minute > 59 ||
    second > 59
  ) {
    return null;
  }

  if (offset !== "Z") {
    const offsetHour = Number(offset.slice(1, 3));
    const offsetMinute = Number(offset.slice(4, 6));
    if (offsetHour > 23 || offsetMinute > 59) {
      return null;
    }
  }

  const normalizedFraction = fractionalSecondText
    ? `.${`${fractionalSecondText}000`.slice(0, 3)}`
    : "";
  const normalizedTimestamp = `${yearText}-${monthText}-${dayText}T${hourText}:${minuteText}:${secondText}${normalizedFraction}${offset}`;
  const date = new Date(normalizedTimestamp);
  return Number.isNaN(date.getTime()) ? null : date;
}

function hasValidTimeZone(timeZone: string): boolean {
  if (timeZone.trim().length === 0) {
    return false;
  }

  try {
    new Intl.DateTimeFormat("en-US", { timeZone });
    return true;
  } catch (error) {
    if (error instanceof RangeError) {
      return false;
    }
    throw error;
  }
}

function formatNumber(
  value: number,
  locale: DeviceLocale,
  options: Intl.NumberFormatOptions
): string {
  return new Intl.NumberFormat(locale, options).format(value);
}

function formatAmountWithCurrencyLabel(
  formattedAmount: string,
  currencyLabel: string | null
): string {
  return currencyLabel === null
    ? `${formattedAmount} (currency unavailable)`
    : `${formattedAmount} ${currencyLabel}`;
}

export function formatDateTime(
  value: string | null | undefined,
  timeZone?: string | null,
  locale?: DeviceLocale
): string {
  if (!value) {
    return "Timestamp unavailable";
  }

  const date = parseRfc3339Instant(value);
  if (!date) {
    return invalidTimestamp;
  }

  if (timeZone !== null && timeZone !== undefined && !hasValidTimeZone(timeZone)) {
    return unavailableTimeZone;
  }

  const options: Intl.DateTimeFormatOptions = {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    ...(timeZone !== null && timeZone !== undefined ? { timeZone } : {})
  };

  return new Intl.DateTimeFormat(locale, options).format(date);
}

export function formatMoney(value: number | null | undefined, locale?: DeviceLocale): string {
  return value == null
    ? pendingAmount
    : formatNumber(value, locale, {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2
      });
}

export function formatMoneyWithCurrencyLabel(
  value: number | null | undefined,
  currencyLabel: string | null,
  locale?: DeviceLocale
): string {
  if (value == null) {
    return formatMoney(value, locale);
  }

  return formatAmountWithCurrencyLabel(formatMoney(value, locale), currencyLabel);
}

export function formatWholeMoney(value: number | null | undefined, locale?: DeviceLocale): string {
  return value == null
    ? pendingAmount
    : formatNumber(value, locale, {
        minimumFractionDigits: 0,
        maximumFractionDigits: 0
      });
}

export function formatWholeMoneyWithCurrencyLabel(
  value: number | null | undefined,
  currencyLabel: string | null,
  locale?: DeviceLocale
): string {
  if (value == null) {
    return formatWholeMoney(value, locale);
  }

  return formatAmountWithCurrencyLabel(formatWholeMoney(value, locale), currencyLabel);
}

export function formatMinutes(value: number | null | undefined, locale?: DeviceLocale): string {
  if (value == null) {
    return "Pending";
  }

  const hours = Math.floor(value / 60);
  const minutes = value % 60;
  const formatUnitValue = (unitValue: number) =>
    formatNumber(unitValue, locale, {
      minimumFractionDigits: 0,
      maximumFractionDigits: 0
    });

  if (hours === 0) {
    return `${formatUnitValue(minutes)} min`;
  }

  if (minutes === 0) {
    return `${formatUnitValue(hours)} h ${formatUnitValue(0)} min`;
  }

  return `${formatUnitValue(hours)} h ${formatUnitValue(minutes)} min`;
}

export function formatRate(value: number | null | undefined, locale?: DeviceLocale): string {
  return value == null ? "Rate unavailable" : formatMoney(value, locale);
}

export function formatAuditDecimal(
  value: number | null | undefined,
  locale?: DeviceLocale
): string {
  return value == null
    ? pendingAmount
    : formatNumber(value, locale, {
        minimumFractionDigits: 0,
        maximumFractionDigits: 8
      });
}

export function formatOptionalLocation(value: string | null | undefined): string {
  return value && value.trim().length > 0 ? value : "No location set";
}
