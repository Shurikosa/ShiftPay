import type { ApiErrorResponse } from "../types/auth";

export class ApiError extends Error {
  public readonly status: number;
  public readonly details?: ApiErrorResponse;
  public readonly retryAfterSeconds?: number;

  public constructor(
    message: string,
    status: number,
    details?: ApiErrorResponse,
    retryAfterSeconds?: number
  ) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.details = details;
    this.retryAfterSeconds = retryAfterSeconds;
  }
}

export function getErrorMessage(error: unknown): string {
  if (error instanceof ApiError) {
    return error.message;
  }

  if (error instanceof Error) {
    return error.message;
  }

  return "Something went wrong. Please try again.";
}
