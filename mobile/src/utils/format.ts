export function formatDateTime(value: string | null): string {
  if (!value) {
    return "Not set";
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return date.toLocaleString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit"
  });
}

export function formatMoney(value: number | null): string {
  return value === null ? "Pending" : value.toFixed(2);
}

export function formatWholeMoney(value: number | null): string {
  return value === null ? "Pending" : String(value);
}

export function formatMinutes(value: number | null): string {
  if (value === null) {
    return "Pending";
  }

  const hours = Math.floor(value / 60);
  const minutes = value % 60;

  if (hours === 0) {
    return `${minutes} min`;
  }

  if (minutes === 0) {
    return `${hours} h 0 min`;
  }

  return `${hours} h ${minutes} min`;
}

export function formatRate(value: number): string {
  return value.toFixed(2);
}

export function formatOptionalLocation(value: string | null | undefined): string {
  return value && value.trim().length > 0 ? value : "No location set";
}
