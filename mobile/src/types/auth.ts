export type UserRole = "WORKER" | "FOREMAN" | "ADMIN";

export type MobileRegistrationRole = Extract<UserRole, "WORKER" | "FOREMAN">;

export interface User {
  id: number;
  email: string;
  firstName: string;
  lastName: string;
  role: UserRole;
}

export interface RegisterRequest {
  email: string;
  password: string;
  firstName: string;
  lastName: string;
  role: MobileRegistrationRole;
}

export interface LoginRequest {
  email: string;
  password: string;
}

export interface LoginResponse {
  accessToken: string;
  tokenType: "Bearer";
  user: User;
}

export interface ApiErrorResponse {
  timestamp?: string;
  status: number;
  error: string;
  message: string;
  path?: string;
}

export interface Session {
  accessToken: string;
  tokenType: "Bearer";
  user: User;
}
