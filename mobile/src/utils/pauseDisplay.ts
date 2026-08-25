import { ApiError, getErrorMessage } from "../api/errors";
import type { PauseState } from "../types/shifts";
import { formatMinutes } from "./format";

export const missingPauseStateMessage =
  "Refresh shift details before pausing or resuming.";

export const allPauseActiveMessage =
  "Your foreman paused the shift for everyone. Personal pause controls will be available after everyone resumes.";

export function getPauseActionErrorMessage(error: unknown): string {
  if (error instanceof ApiError) {
    if (error.status === 409) {
      return "Pause is only available during an active shift, or the pause state already changed. Refresh and try again.";
    }

    if (error.status === 403) {
      return "You are not authorized to pause this shift.";
    }
  }

  return getErrorMessage(error);
}

export function isPaused(value: PauseState | undefined): boolean {
  return Boolean(value?.allPaused || value?.personallyPaused);
}

export function getWorkerPauseBadgeLabel(value: PauseState | undefined): string | null {
  if (value?.allPaused) {
    return "PAUSED BY FOREMAN";
  }

  if (value?.personallyPaused) {
    return "PAUSED";
  }

  return null;
}

export function formatPauseMinutes(value: number | null | undefined): string {
  return value === undefined ? "Not available" : formatMinutes(value);
}
