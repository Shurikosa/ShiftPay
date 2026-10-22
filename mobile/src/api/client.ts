import { config } from "../config/env";
import type { ApiErrorResponse } from "../types/auth";
import { ApiError } from "./errors";

type RequestOptions = {
  method?: "GET" | "POST" | "PUT" | "PATCH" | "DELETE";
  body?: unknown;
  token?: string | null;
};

function buildUrl(path: string): string {
  const baseUrl = config.apiBaseUrl.replace(/\/$/, "");
  const normalizedPath = path.startsWith("/") ? path : `/${path}`;

  return `${baseUrl}${normalizedPath}`;
}

function isApiErrorResponse(value: unknown): value is ApiErrorResponse {
  if (!value || typeof value !== "object") {
    return false;
  }

  const candidate = value as Partial<ApiErrorResponse>;
  return typeof candidate.status === "number" && typeof candidate.message === "string";
}

function getRetryAfterSeconds(response: Response): number | undefined {
  const value = response.headers.get("Retry-After");
  if (!value || !/^\d+$/.test(value)) {
    return undefined;
  }

  const seconds = Number(value);
  return Number.isSafeInteger(seconds) ? seconds : undefined;
}

export async function apiRequest<TResponse>(
  path: string,
  options: RequestOptions = {}
): Promise<TResponse> {
  const headers: Record<string, string> = {
    Accept: "application/json"
  };

  if (options.body !== undefined) {
    headers["Content-Type"] = "application/json";
  }

  if (options.token) {
    headers.Authorization = `Bearer ${options.token}`;
  }

  let response: Response;

  try {
    response = await fetch(buildUrl(path), {
      method: options.method ?? "GET",
      headers,
      body: options.body === undefined ? undefined : JSON.stringify(options.body)
    });
  } catch {
    throw new ApiError("Network error. Check your connection and backend URL.", 0);
  }

  const text = await response.text();
  let data: unknown;

  try {
    data = text.length > 0 ? (JSON.parse(text) as unknown) : undefined;
  } catch {
    data = undefined;
  }

  if (!response.ok) {
    const retryAfterSeconds = getRetryAfterSeconds(response);
    if (isApiErrorResponse(data)) {
      throw new ApiError(data.message, response.status, data, retryAfterSeconds);
    }

    throw new ApiError(
      `Request failed with status ${response.status}`,
      response.status,
      undefined,
      retryAfterSeconds
    );
  }

  return data as TResponse;
}
