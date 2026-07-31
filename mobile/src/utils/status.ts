import type { AttendanceStatus, ShiftStatus } from "../types/shifts";

export type StatusTone = "neutral" | "primary" | "success" | "warning" | "error";

export function getShiftStatusTone(status: ShiftStatus): StatusTone {
  switch (status) {
    case "OPEN":
      return "primary";
    case "ACTIVE":
      return "warning";
    case "CLOSED":
      return "success";
  }
}

export function getAttendanceStatusTone(status: AttendanceStatus): StatusTone {
  switch (status) {
    case "JOINED":
      return "primary";
    case "APPROVED":
      return "success";
    case "REJECTED":
      return "error";
    case "CANCELLED":
      return "neutral";
  }
}
