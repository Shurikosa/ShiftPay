import type { SnapshotStatus } from "../types/payCalculation";
import type { PaymentStatus, PayoutRequestStatus } from "../types/payroll";
import type { AttendanceStatus, ShiftStatus } from "../types/shifts";

export type StatusTone = "neutral" | "info" | "success" | "warning" | "danger";

export interface StatusPresentation {
  readonly label: string;
  readonly tone: StatusTone;
}

type CanonicalShiftStatus = Exclude<ShiftStatus, "CREATED">;

export const shiftStatusPresentation = {
  OPEN: { label: "Open", tone: "info" },
  ACTIVE: { label: "Active", tone: "success" },
  CLOSED: { label: "Closed", tone: "neutral" },
  CANCELLED: { label: "Cancelled", tone: "danger" },
  DISCARDED: { label: "Discarded", tone: "warning" }
} as const satisfies Record<CanonicalShiftStatus, StatusPresentation>;

export const attendanceStatusPresentation = {
  JOINED: { label: "Waiting for approval", tone: "info" },
  APPROVED: { label: "Attendance approved", tone: "success" },
  REJECTED: { label: "Attendance rejected", tone: "danger" },
  CANCELLED: { label: "Attendance cancelled", tone: "neutral" }
} as const satisfies Record<AttendanceStatus, StatusPresentation>;

export const paymentStatusPresentation = {
  UNPAID: { label: "Unpaid", tone: "warning" },
  PAYMENT_REQUESTED: { label: "Payment requested", tone: "info" },
  PAID: { label: "Paid", tone: "success" }
} as const satisfies Record<PaymentStatus, StatusPresentation>;

export const payoutRequestStatusPresentation = {
  PENDING: { label: "Pending approval", tone: "warning" },
  APPROVED: { label: "Approved", tone: "success" }
} as const satisfies Record<PayoutRequestStatus, StatusPresentation>;

export const payCalculationStatusPresentation = {
  COMPLETE: { label: "Breakdown available", tone: "neutral" },
  UNAVAILABLE: { label: "Breakdown unavailable", tone: "warning" }
} as const satisfies Record<SnapshotStatus, StatusPresentation>;

export const pauseStatusPresentation = {
  personalActive: { label: "Personal pause active", tone: "warning" },
  crewActive: { label: "Crew pause active", tone: "warning" }
} as const satisfies Record<"personalActive" | "crewActive", StatusPresentation>;

export function getShiftStatusPresentation(status: ShiftStatus): StatusPresentation | undefined {
  // CREATED is only a defensive mobile type member, not a canonical product status.
  return status === "CREATED" ? undefined : shiftStatusPresentation[status];
}

export function getAttendanceStatusPresentation(status: AttendanceStatus): StatusPresentation {
  return attendanceStatusPresentation[status];
}

export function getPaymentStatusPresentation(status: PaymentStatus): StatusPresentation {
  return paymentStatusPresentation[status];
}

export function getPayoutRequestStatusPresentation(
  status: PayoutRequestStatus
): StatusPresentation {
  return payoutRequestStatusPresentation[status];
}

export function getPayCalculationStatusPresentation(status: SnapshotStatus): StatusPresentation {
  return payCalculationStatusPresentation[status];
}

export function getShiftStatusTone(status: ShiftStatus): StatusTone {
  if (status === "CREATED") {
    return "neutral";
  }

  return shiftStatusPresentation[status].tone;
}

export function getAttendanceStatusTone(status: AttendanceStatus): StatusTone {
  return attendanceStatusPresentation[status].tone;
}

export function getPaymentStatusTone(status: PaymentStatus): StatusTone {
  return paymentStatusPresentation[status].tone;
}

export function getPayoutRequestStatusTone(status: PayoutRequestStatus): StatusTone {
  return payoutRequestStatusPresentation[status].tone;
}

export function getPayCalculationStatusTone(status: SnapshotStatus): StatusTone {
  return payCalculationStatusPresentation[status].tone;
}

// Existing consumers still supply their own labels. This generic fallback is
// intentionally not a product-status dictionary because values can belong to
// different dimensions with different approved copy.
export function formatStatusLabel(status: string): string {
  return status.replace(/_/g, " ");
}
