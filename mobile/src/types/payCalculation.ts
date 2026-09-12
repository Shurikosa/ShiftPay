import type {
  PayPolicyRuleType,
  PayPolicyStackingStrategy
} from "./payPolicy";

export type SnapshotStatus = "COMPLETE" | "UNAVAILABLE";

export interface AppliedPremiumRule {
  id: number;
  name: string;
  type: PayPolicyRuleType;
  premiumPercent: number;
}

interface PaySegmentBase {
  start: string;
  end: string;
  payableSeconds: number;
  payableMinutesExact: number;
  payableMinutes: number;
  baseHourlyRate: number;
  stackingStrategy: PayPolicyStackingStrategy;
  effectivePremiumPercent: number;
  effectiveHourlyRate: number;
  baseAmount: number;
  premiumAmount: number;
  totalAmount: number;
}

export interface CompletePaySegment extends PaySegmentBase {
  snapshotStatus: "COMPLETE";
  appliedRules: AppliedPremiumRule[];
}

export interface UnavailablePaySegment extends PaySegmentBase {
  snapshotStatus: "UNAVAILABLE";
  appliedRules: null;
}

export type PaySegment = CompletePaySegment | UnavailablePaySegment;

export interface PayCalculation {
  snapshotStatus: SnapshotStatus;
  totalRawSeconds: number;
  totalRawMinutesExact: number;
  totalBaseAmount: number;
  totalPremiumAmount: number;
  totalAmount: number;
  segments: PaySegment[];
}
