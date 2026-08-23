import type {
  CreateCompanyRequest,
  CreateCompanyResponse,
  JoinCompanyRequest,
  JoinCompanyResponse
} from "../types/company";
import { apiRequest } from "./client";

export function createCompany(
  token: string,
  payload: CreateCompanyRequest
): Promise<CreateCompanyResponse> {
  return apiRequest<CreateCompanyResponse>("/api/v1/companies", {
    method: "POST",
    token,
    body: payload
  });
}

export function joinCompany(
  token: string,
  payload: JoinCompanyRequest
): Promise<JoinCompanyResponse> {
  return apiRequest<JoinCompanyResponse>("/api/v1/companies/join", {
    method: "POST",
    token,
    body: payload
  });
}
