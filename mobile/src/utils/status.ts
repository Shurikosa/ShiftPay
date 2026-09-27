import type { PaymentStatus, PayoutRequestStatus } from "../types/payroll";
import type { AttendanceStatus, ShiftStatus } from "../types/shifts";

export type StatusTone = "neutral" | "primary" | "success" | "warning" | "error";

export function getShiftStatusTone(status: ShiftStatus): StatusTone {
  switch (status) {
    case "CREATED":
      return "neutral";
    case "OPEN":
      return "primary";
    case "ACTIVE":
      return "warning";
    case "CLOSED":
      return "success";
    case "CANCELLED":
      return "error";
    case "DISCARDED":
      return "warning";
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

export function getPaymentStatusTone(status: PaymentStatus): StatusTone {
  switch (status) {
    case "UNPAID":
      return "warning";
    case "PAYMENT_REQUESTED":
      return "primary";
    case "PAID":
      return "success";
  }
}

export function getPayoutRequestStatusTone(status: PayoutRequestStatus): StatusTone {
  switch (status) {
    case "PENDING":
      return "warning";
    case "APPROVED":
      return "success";
  }
}

export function formatStatusLabel(status: string): string {
  return status.replace(/_/g, " ");
}
