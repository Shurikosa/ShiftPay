import type { MobileRegistrationRole } from "../types/auth";

export function isBlank(value: string): boolean {
  return value.trim().length === 0;
}

export function isValidEmail(value: string): boolean {
  return /^\S+@\S+\.\S+$/.test(value.trim());
}

export function isMobileRegistrationRole(value: string): value is MobileRegistrationRole {
  return value === "WORKER" || value === "FOREMAN";
}
