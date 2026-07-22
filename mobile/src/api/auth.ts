import type { LoginRequest, LoginResponse, RegisterRequest, User } from "../types/auth";
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
