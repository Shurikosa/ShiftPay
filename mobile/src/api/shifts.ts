import type {
  JoinShiftRequest,
  JoinShiftResponse,
  WorkerShiftHistoryItem
} from "../types/shifts";
import { apiRequest } from "./client";

export function joinShiftByCode(
  token: string,
  payload: JoinShiftRequest
): Promise<JoinShiftResponse> {
  return apiRequest<JoinShiftResponse>("/api/v1/shifts/join", {
    method: "POST",
    token,
    body: payload
  });
}

export function getMyShiftHistory(token: string): Promise<WorkerShiftHistoryItem[]> {
  return apiRequest<WorkerShiftHistoryItem[]>("/api/v1/me/shifts", {
    token
  });
}
