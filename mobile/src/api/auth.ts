import type {
  ConfirmMyEmailChangeRequest,
  LoginRequest,
  LoginResponse,
  PendingEmailChange,
  RegisterRequest,
  StartMyEmailChangeRequest,
  UpdateMyNameRequest,
  UpdateMyPasswordRequest,
  User
} from "../types/auth";
import { apiRequest } from "./client";

export function registerUser(payload: RegisterRequest): Promise<User> {
  return apiRequest<User>("/api/v1/auth/register", {
    method: "POST",
    body: payload
  });
}

export function loginUser(payload: LoginRequest): Promise<LoginResponse> {
  return apiRequest<LoginResponse>("/api/v1/auth/login", {
    method: "POST",
    body: payload
  });
}

export function getCurrentUser(token: string): Promise<User> {
  return apiRequest<User>("/api/v1/users/me", {
    token
  });
}

export function updateMyName(
  token: string,
  payload: UpdateMyNameRequest
): Promise<User> {
  return apiRequest<User>("/api/v1/users/me", {
    method: "PUT",
    body: payload,
    token
  });
}

export function getPendingEmailChange(
  token: string
): Promise<PendingEmailChange | undefined> {
  return apiRequest<PendingEmailChange | undefined>(
    "/api/v1/users/me/email-change",
    { token }
  );
}

export function startEmailChange(
  token: string,
  payload: StartMyEmailChangeRequest
): Promise<PendingEmailChange> {
  return apiRequest<PendingEmailChange>("/api/v1/users/me/email-change", {
    method: "POST",
    body: payload,
    token
  });
}

export function confirmEmailChange(
  token: string,
  payload: ConfirmMyEmailChangeRequest
): Promise<LoginResponse> {
  return apiRequest<LoginResponse>("/api/v1/users/me/email-change/confirm", {
    method: "POST",
    body: payload,
    token
  });
}

export function resendEmailChange(token: string): Promise<PendingEmailChange> {
  return apiRequest<PendingEmailChange>(
    "/api/v1/users/me/email-change/resend",
    { method: "POST", token }
  );
}

export function cancelEmailChange(token: string): Promise<void> {
  return apiRequest<void>("/api/v1/users/me/email-change", {
    method: "DELETE",
    token
  });
}

export function updateMyPassword(
  token: string,
  payload: UpdateMyPasswordRequest
): Promise<LoginResponse> {
  return apiRequest<LoginResponse>("/api/v1/users/me/password", {
    method: "PUT",
    body: payload,
    token
  });
}
