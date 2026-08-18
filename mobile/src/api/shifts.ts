import type {
  ApproveAttendanceRequest,
  ApproveAttendanceResponse,
  CreateShiftRequest,
  CreateShiftResponse,
  JoinShiftRequest,
  JoinShiftResponse,
  ManagedShift,
  ShiftAttendance,
  ShiftCloseResponse,
  ShiftStartResponse,
  ShiftSummary,
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

export function getManagedShifts(token: string): Promise<ManagedShift[]> {
  return apiRequest<ManagedShift[]>("/api/v1/me/managed-shifts", {
    token
  });
}

export function createShift(
  token: string,
  payload: CreateShiftRequest
): Promise<CreateShiftResponse> {
  return apiRequest<CreateShiftResponse>("/api/v1/shifts", {
    method: "POST",
    token,
    body: payload
  });
}

export function getShiftById(token: string, shiftId: number): Promise<ManagedShift> {
  return apiRequest<ManagedShift>(`/api/v1/shifts/${shiftId}`, {
    token
  });
}

export function getShiftAttendance(
  token: string,
  shiftId: number
): Promise<ShiftAttendance[]> {
  return apiRequest<ShiftAttendance[]>(`/api/v1/shifts/${shiftId}/attendance`, {
    token
  });
}

export function approveAttendance(
  token: string,
  shiftId: number,
  attendanceId: number,
  payload: ApproveAttendanceRequest = {}
): Promise<ApproveAttendanceResponse> {
  return apiRequest<ApproveAttendanceResponse>(
    `/api/v1/shifts/${shiftId}/attendance/${attendanceId}/approve`,
    {
      method: "POST",
      token,
      body: payload
    }
  );
}

export function startShift(token: string, shiftId: number): Promise<ShiftStartResponse> {
  return apiRequest<ShiftStartResponse>(`/api/v1/shifts/${shiftId}/start`, {
    method: "POST",
    token
  });
}

export function closeShift(token: string, shiftId: number): Promise<ShiftCloseResponse> {
  return apiRequest<ShiftCloseResponse>(`/api/v1/shifts/${shiftId}/close`, {
    method: "POST",
    token
  });
}

export function getShiftSummary(token: string, shiftId: number): Promise<ShiftSummary> {
  return apiRequest<ShiftSummary>(`/api/v1/shifts/${shiftId}/summary`, {
    token
  });
}
