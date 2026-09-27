import type {
  PayPolicy,
  PayPolicyVersionSummary,
  UpdatePayPolicyRequest
} from "../types/payPolicy";
import { apiRequest } from "./client";

export function getMyPayPolicy(token: string): Promise<PayPolicy> {
  return apiRequest<PayPolicy>("/api/v1/me/pay-policy", {
    token
  });
}

export function updateMyPayPolicy(
  token: string,
  payload: UpdatePayPolicyRequest
): Promise<PayPolicy> {
  return apiRequest<PayPolicy>("/api/v1/me/pay-policy", {
    method: "PUT",
    token,
    body: payload
  });
}

export function getMyPayPolicyVersions(
  token: string
): Promise<PayPolicyVersionSummary[]> {
  return apiRequest<PayPolicyVersionSummary[]>("/api/v1/me/pay-policy/versions", {
    token
  });
}
