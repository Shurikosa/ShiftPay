export type PaymentStatus = "UNPAID" | "PAYMENT_REQUESTED" | "PAID";

export type PayoutRequestStatus = "PENDING" | "APPROVED";

export interface PayoutRequestPayload {
  attendanceIds: number[];
}

export interface PayableAttendance {
  attendanceId: number;
  shiftId: number;
  companyId: number;
  companyName: string;
  title: string;
  location: string | null;
  actualStartTime: string | null;
  actualEndTime: string | null;
  paymentStatus: PaymentStatus;
  rawPayableMinutes: number;
  payoutRoundedMinutes: number;
  hourlyRate: number;
  calculatedSalary: number;
  totalBaseAmount: number;
  totalPremiumAmount: number;
  payoutAmount: number;
}

export interface PayoutRequestItem {
  attendanceId: number;
  shiftId: number;
  title: string;
  location?: string | null;
  actualStartTime: string | null;
  actualEndTime: string | null;
  paymentStatus: PaymentStatus;
  rawPayableMinutes: number;
  payoutRoundedMinutes: number;
  hourlyRate: number;
  calculatedSalary: number;
  roundedItemAmountExact?: number;
  totalBaseAmount: number;
  totalPremiumAmount: number;
  payoutAmount: number;
  paidAt?: string | null;
}

export interface PayoutRequestTotals {
  rawPayableMinutes: number;
  payoutRoundedMinutes: number;
  exactCalculatedAmount: number;
  totalBaseAmount: number;
  totalPremiumAmount: number;
  payoutAmount: number;
}

export interface PayoutRequestPreview extends PayoutRequestTotals {
  items: PayoutRequestItem[];
}

export interface PayoutRequest extends PayoutRequestTotals {
  id: number;
  companyId: number;
  companyName: string;
  workerId: number;
  workerFirstName: string;
  workerLastName: string;
  status: PayoutRequestStatus;
  requestedAt: string;
  approvedAt: string | null;
  paidAt: string | null;
  items: PayoutRequestItem[];
}
