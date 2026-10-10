import type { SnapshotStatus } from "../../types/payCalculation";
import type { PaymentStatus, PayoutRequestStatus } from "../../types/payroll";
import type { AttendanceStatus, ShiftStatus } from "../../types/shifts";
import {
  attendanceStatusPresentation,
  formatStatusLabel,
  getAttendanceStatusPresentation,
  getAttendanceStatusTone,
  getPayCalculationStatusPresentation,
  getPayCalculationStatusTone,
  getPaymentStatusPresentation,
  getPaymentStatusTone,
  getPayoutRequestStatusPresentation,
  getPayoutRequestStatusTone,
  getShiftStatusPresentation,
  getShiftStatusTone,
  pauseStatusPresentation,
  payCalculationStatusPresentation,
  paymentStatusPresentation,
  payoutRequestStatusPresentation,
  shiftStatusPresentation,
  type StatusPresentation,
  type StatusTone
} from "../status";

describe("status presentation", () => {
  it("maps every canonical shift lifecycle value to exact approved presentation", () => {
    expect(shiftStatusPresentation).toEqual({
      OPEN: { label: "Open", tone: "info" },
      ACTIVE: { label: "Active", tone: "success" },
      CLOSED: { label: "Closed", tone: "neutral" },
      CANCELLED: { label: "Cancelled", tone: "danger" },
      DISCARDED: { label: "Discarded", tone: "warning" }
    });

    expect(getShiftStatusPresentation("OPEN")).toEqual({
      label: "Open",
      tone: "info"
    });
    expect(getShiftStatusTone("OPEN")).toBe("info");
    expect(getShiftStatusTone("CANCELLED")).toBe("danger");
  });

  it("keeps defensive CREATED outside canonical product presentation", () => {
    expect(getShiftStatusPresentation("CREATED")).toBeUndefined();
    expect(getShiftStatusTone("CREATED")).toBe("neutral");
    expect(Object.hasOwn(shiftStatusPresentation, "CREATED")).toBe(false);
  });

  it("maps every attendance value independently", () => {
    expect(attendanceStatusPresentation).toEqual({
      JOINED: { label: "Waiting for approval", tone: "info" },
      APPROVED: { label: "Attendance approved", tone: "success" },
      REJECTED: { label: "Attendance rejected", tone: "danger" },
      CANCELLED: { label: "Attendance cancelled", tone: "neutral" }
    });
    expect(getAttendanceStatusPresentation("JOINED")).toEqual({
      label: "Waiting for approval",
      tone: "info"
    });
    expect(getAttendanceStatusTone("REJECTED")).toBe("danger");
  });

  it("maps every attendance-payment value independently", () => {
    expect(paymentStatusPresentation).toEqual({
      UNPAID: { label: "Unpaid", tone: "warning" },
      PAYMENT_REQUESTED: { label: "Payment requested", tone: "info" },
      PAID: { label: "Paid", tone: "success" }
    });
    expect(getPaymentStatusPresentation("PAYMENT_REQUESTED")).toEqual({
      label: "Payment requested",
      tone: "info"
    });
    expect(getPaymentStatusTone("PAID")).toBe("success");
  });

  it("maps every payout-request value independently", () => {
    expect(payoutRequestStatusPresentation).toEqual({
      PENDING: { label: "Pending approval", tone: "warning" },
      APPROVED: { label: "Approved", tone: "success" }
    });
    expect(getPayoutRequestStatusPresentation("PENDING")).toEqual({
      label: "Pending approval",
      tone: "warning"
    });
    expect(getPayoutRequestStatusTone("APPROVED")).toBe("success");
  });

  it("maps every calculation snapshot/freshness value independently", () => {
    expect(payCalculationStatusPresentation).toEqual({
      COMPLETE: { label: "Breakdown available", tone: "neutral" },
      UNAVAILABLE: { label: "Breakdown unavailable", tone: "warning" }
    });
    expect(getPayCalculationStatusPresentation("COMPLETE")).toEqual({
      label: "Breakdown available",
      tone: "neutral"
    });
    expect(getPayCalculationStatusTone("UNAVAILABLE")).toBe("warning");
  });

  it("keeps personal and crew pause presentation separate", () => {
    expect(pauseStatusPresentation).toEqual({
      personalActive: { label: "Personal pause active", tone: "warning" },
      crewActive: { label: "Crew pause active", tone: "warning" }
    });
  });

  it("keeps all dictionaries exhaustive against their actual enum dimensions", () => {
    const shifts: Readonly<
      Record<Exclude<ShiftStatus, "CREATED">, StatusPresentation>
    > = shiftStatusPresentation;
    const attendance: Readonly<Record<AttendanceStatus, StatusPresentation>> =
      attendanceStatusPresentation;
    const payment: Readonly<Record<PaymentStatus, StatusPresentation>> =
      paymentStatusPresentation;
    const payout: Readonly<Record<PayoutRequestStatus, StatusPresentation>> =
      payoutRequestStatusPresentation;
    const calculation: Readonly<Record<SnapshotStatus, StatusPresentation>> =
      payCalculationStatusPresentation;

    expect(Object.keys(shifts)).toHaveLength(5);
    expect(Object.keys(attendance)).toHaveLength(4);
    expect(Object.keys(payment)).toHaveLength(3);
    expect(Object.keys(payout)).toHaveLength(2);
    expect(Object.keys(calculation)).toHaveLength(2);
  });

  it("never emits legacy tones or raw enum copy from canonical dictionaries", () => {
    const presentations = [
      ...Object.values(shiftStatusPresentation),
      ...Object.values(attendanceStatusPresentation),
      ...Object.values(paymentStatusPresentation),
      ...Object.values(payoutRequestStatusPresentation),
      ...Object.values(payCalculationStatusPresentation),
      ...Object.values(pauseStatusPresentation)
    ];
    const tones = presentations.map((presentation) => presentation.tone);
    const labels = presentations.map((presentation) => presentation.label);

    expect(tones).not.toContain("primary");
    expect(tones).not.toContain("error");
    expect(labels).toEqual(
      expect.arrayContaining([
        "Waiting for approval",
        "Attendance approved",
        "Payment requested",
        "Pending approval",
        "Breakdown unavailable"
      ])
    );
    expect(labels).not.toContain("PAYMENT_REQUESTED");
    expect(labels).not.toContain("PENDING");
  });

  it("does not silently invent presentation for unknown runtime enum values", () => {
    const unknownShift = "UNKNOWN" as ShiftStatus;
    const unknownAttendance = "UNKNOWN" as AttendanceStatus;
    const unknownPayment = "UNKNOWN" as PaymentStatus;
    const unknownPayout = "UNKNOWN" as PayoutRequestStatus;
    const unknownCalculation = "UNKNOWN" as SnapshotStatus;

    expect(getShiftStatusPresentation(unknownShift)).toBeUndefined();
    expect(getAttendanceStatusPresentation(unknownAttendance)).toBeUndefined();
    expect(getPaymentStatusPresentation(unknownPayment)).toBeUndefined();
    expect(getPayoutRequestStatusPresentation(unknownPayout)).toBeUndefined();
    expect(getPayCalculationStatusPresentation(unknownCalculation)).toBeUndefined();
    expect(() => getShiftStatusTone(unknownShift)).toThrow();
    expect(() => getAttendanceStatusTone(unknownAttendance)).toThrow();
    expect(() => getPaymentStatusTone(unknownPayment)).toThrow();
    expect(() => getPayoutRequestStatusTone(unknownPayout)).toThrow();
    expect(() => getPayCalculationStatusTone(unknownCalculation)).toThrow();
  });

  it("does not invent presentation for null runtime enum values", () => {
    const nullShift = null as unknown as ShiftStatus;
    const nullAttendance = null as unknown as AttendanceStatus;
    const nullPayment = null as unknown as PaymentStatus;
    const nullPayout = null as unknown as PayoutRequestStatus;
    const nullCalculation = null as unknown as SnapshotStatus;

    expect(getShiftStatusPresentation(nullShift)).toBeUndefined();
    expect(getAttendanceStatusPresentation(nullAttendance)).toBeUndefined();
    expect(getPaymentStatusPresentation(nullPayment)).toBeUndefined();
    expect(getPayoutRequestStatusPresentation(nullPayout)).toBeUndefined();
    expect(getPayCalculationStatusPresentation(nullCalculation)).toBeUndefined();
    expect(() => getShiftStatusTone(nullShift)).toThrow();
    expect(() => getAttendanceStatusTone(nullAttendance)).toThrow();
    expect(() => getPaymentStatusTone(nullPayment)).toThrow();
    expect(() => getPayoutRequestStatusTone(nullPayout)).toThrow();
    expect(() => getPayCalculationStatusTone(nullCalculation)).toThrow();
  });

  it("keeps the generic formatter behavior for deferred noncanonical consumers", () => {
    expect(formatStatusLabel("PAYMENT_REQUESTED")).toBe("PAYMENT REQUESTED");
    expect(formatStatusLabel("TIME_OF_DAY")).toBe("TIME OF DAY");
  });

  it("exposes only canonical tone names in the status mapping type", () => {
    const canonicalTones: readonly StatusTone[] = [
      "neutral",
      "info",
      "success",
      "warning",
      "danger"
    ];

    // @ts-expect-error `primary` is a removed legacy alias.
    const primary: StatusTone = "primary";
    // @ts-expect-error `error` is replaced by `danger`.
    const error: StatusTone = "error";

    expect({ canonicalTones, error, primary }).toBeTruthy();
  });
});
