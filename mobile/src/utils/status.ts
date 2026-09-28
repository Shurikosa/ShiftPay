import type { SnapshotStatus } from "../types/payCalculation";
import type { PaymentStatus, PayoutRequestStatus } from "../types/payroll";
import type { AttendanceStatus, ShiftStatus } from "../types/shifts";

// `primary` and `error` remain for the current StatusBadge compatibility.
// New presentation code should use the semantic tones from StatusPresentation.
export type StatusTone = "neutral" | "primary" | "success" | "warning" | "error";
export type SemanticStatusTone = "neutral" | "info" | "success" | "warning" | "danger";

export interface StatusPresentation {
  label: string;
  tone: SemanticStatusTone;
}

type CanonicalShiftStatus = Exclude<ShiftStatus, "CREATED">;

export const shiftStatusPresentation: Readonly<
  Record<CanonicalShiftStatus, StatusPresentation>
> = {
  OPEN: { label: "Open", tone: "info" },
  ACTIVE: { label: "Active", tone: "success" },
  CLOSED: { label: "Closed", tone: "neutral" },
  CANCELLED: { label: "Cancelled", tone: "danger" },
  DISCARDED: { label: "Discarded", tone: "warning" }
};

export const attendanceStatusPresentation: Readonly<
  Record<AttendanceStatus, StatusPresentation>
> = {
  JOINED: { label: "Waiting for approval", tone: "info" },
  APPROVED: { label: "Attendance approved", tone: "success" },
  REJECTED: { label: "Attendance rejected", tone: "danger" },
  CANCELLED: { label: "Attendance cancelled", tone: "neutral" }
};

export const paymentStatusPresentation: Readonly<
  Record<PaymentStatus, StatusPresentation>
> = {
  UNPAID: { label: "Unpaid", tone: "warning" },
  PAYMENT_REQUESTED: { label: "Payment requested", tone: "info" },
  PAID: { label: "Paid", tone: "success" }
};

export const payoutRequestStatusPresentation: Readonly<
  Record<PayoutRequestStatus, StatusPresentation>
> = {
  PENDING: { label: "Pending approval", tone: "warning" },
  APPROVED: { label: "Approved", tone: "success" }
};

export const payCalculationStatusPresentation: Readonly<
  Record<SnapshotStatus, StatusPresentation>
> = {
  COMPLETE: { label: "Breakdown available", tone: "neutral" },
  UNAVAILABLE: { label: "Breakdown unavailable", tone: "warning" }
};

export const pauseStatusPresentation = {
  personalActive: { label: "Personal pause active", tone: "warning" },
  crewActive: { label: "Crew pause active", tone: "warning" }
} as const satisfies Readonly<Record<string, StatusPresentation>>;

const legacyToneBySemanticTone: Readonly<Record<SemanticStatusTone, StatusTone>> = {
  neutral: "neutral",
  info: "primary",
  success: "success",
  warning: "warning",
  danger: "error"
};

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
  const presentation = getShiftStatusPresentation(status);
  return presentation ? legacyToneBySemanticTone[presentation.tone] : "neutral";
}

export function getAttendanceStatusTone(status: AttendanceStatus): StatusTone {
  return legacyToneBySemanticTone[getAttendanceStatusPresentation(status).tone];
}

export function getPaymentStatusTone(status: PaymentStatus): StatusTone {
  return legacyToneBySemanticTone[getPaymentStatusPresentation(status).tone];
}

export function getPayoutRequestStatusTone(status: PayoutRequestStatus): StatusTone {
  return legacyToneBySemanticTone[getPayoutRequestStatusPresentation(status).tone];
}

// Existing consumers still supply their own labels. This generic fallback is
// intentionally not a product-status dictionary because values can belong to
// different dimensions with different approved copy.
export function formatStatusLabel(status: string): string {
  return status.replace(/_/g, " ");
}
