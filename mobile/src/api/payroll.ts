import type {
  PayableAttendance,
  PayoutRequest,
  PayoutRequestPayload,
  PayoutRequestPreview,
  PayoutRequestStatus
} from "../types/payroll";
import { apiRequest } from "./client";

function buildStatusQuery(status?: PayoutRequestStatus): string {
  return status ? `?status=${encodeURIComponent(status)}` : "";
}

export function getPayableAttendances(token: string): Promise<PayableAttendance[]> {
  return apiRequest<PayableAttendance[]>("/api/v1/me/payable-attendances", {
    token
  });
}

export function previewPayoutRequest(
  token: string,
  payload: PayoutRequestPayload
): Promise<PayoutRequestPreview> {
  return apiRequest<PayoutRequestPreview>("/api/v1/me/payout-requests/preview", {
    method: "POST",
    token,
    body: payload
  });
}

export function createPayoutRequest(
  token: string,
  payload: PayoutRequestPayload
): Promise<PayoutRequest> {
  return apiRequest<PayoutRequest>("/api/v1/me/payout-requests", {
    method: "POST",
    token,
    body: payload
  });
}

export function getMyPayoutRequests(
  token: string,
  status?: PayoutRequestStatus
): Promise<PayoutRequest[]> {
  return apiRequest<PayoutRequest[]>(
    `/api/v1/me/payout-requests${buildStatusQuery(status)}`,
    {
      token
    }
  );
}

export function getManagedPayoutRequests(
  token: string,
  status?: PayoutRequestStatus
): Promise<PayoutRequest[]> {
  return apiRequest<PayoutRequest[]>(
    `/api/v1/me/managed-payout-requests${buildStatusQuery(status)}`,
    {
      token
    }
  );
}

export function approveManagedPayoutRequest(
  token: string,
  requestId: number
): Promise<PayoutRequest> {
  return apiRequest<PayoutRequest>(
    `/api/v1/me/managed-payout-requests/${requestId}/approve`,
    {
      method: "POST",
      token
    }
  );
}
