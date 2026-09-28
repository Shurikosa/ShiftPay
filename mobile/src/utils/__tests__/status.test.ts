import {
  attendanceStatusPresentation,
  getAttendanceStatusTone,
  getPayCalculationStatusPresentation,
  getPaymentStatusTone,
  getPayoutRequestStatusTone,
  getShiftStatusPresentation,
  getShiftStatusTone,
  pauseStatusPresentation,
  paymentStatusPresentation,
  payoutRequestStatusPresentation,
  shiftStatusPresentation
} from "../status";

describe("status presentation", () => {
  it("maps every canonical shift status to its approved copy and semantic tone", () => {
    expect(shiftStatusPresentation).toEqual({
      OPEN: { label: "Open", tone: "info" },
      ACTIVE: { label: "Active", tone: "success" },
      CLOSED: { label: "Closed", tone: "neutral" },
      CANCELLED: { label: "Cancelled", tone: "danger" },
      DISCARDED: { label: "Discarded", tone: "warning" }
    });
  });

  it("does not assign the defensive CREATED value canonical product copy", () => {
    expect(getShiftStatusPresentation("CREATED")).toBeUndefined();
    expect(getShiftStatusTone("CREATED")).toBe("neutral");
    expect(Object.hasOwn(shiftStatusPresentation, "CREATED")).toBe(false);
  });

  it("maps attendance, payment, payout request, and calculation dimensions independently", () => {
    expect(attendanceStatusPresentation).toEqual({
      JOINED: { label: "Waiting for approval", tone: "info" },
      APPROVED: { label: "Attendance approved", tone: "success" },
      REJECTED: { label: "Attendance rejected", tone: "danger" },
      CANCELLED: { label: "Attendance cancelled", tone: "neutral" }
    });
    expect(paymentStatusPresentation).toEqual({
      UNPAID: { label: "Unpaid", tone: "warning" },
      PAYMENT_REQUESTED: { label: "Payment requested", tone: "info" },
      PAID: { label: "Paid", tone: "success" }
    });
    expect(payoutRequestStatusPresentation).toEqual({
      PENDING: { label: "Pending approval", tone: "warning" },
      APPROVED: { label: "Approved", tone: "success" }
    });
    expect(getPayCalculationStatusPresentation("COMPLETE")).toEqual({
      label: "Breakdown available",
      tone: "neutral"
    });
    expect(getPayCalculationStatusPresentation("UNAVAILABLE")).toEqual({
      label: "Breakdown unavailable",
      tone: "warning"
    });
    expect(attendanceStatusPresentation.APPROVED.label).not.toBe(
      payoutRequestStatusPresentation.APPROVED.label
    );
  });

  it("keeps personal and crew pause copy separate", () => {
    expect(pauseStatusPresentation.personalActive).toEqual({
      label: "Personal pause active",
      tone: "warning"
    });
    expect(pauseStatusPresentation.crewActive).toEqual({
      label: "Crew pause active",
      tone: "warning"
    });
  });

  it("adapts canonical semantic tones for the current StatusBadge compatibility API", () => {
    expect(getShiftStatusTone("OPEN")).toBe("primary");
    expect(getShiftStatusTone("CANCELLED")).toBe("error");
    expect(getAttendanceStatusTone("JOINED")).toBe("primary");
    expect(getPaymentStatusTone("PAYMENT_REQUESTED")).toBe("primary");
    expect(getPayoutRequestStatusTone("PENDING")).toBe("warning");
  });
});
