import type { MobileRegistrationRole } from "./auth";
import type { ManagedShift, WorkerShiftHistoryItem } from "./shifts";

export type AuthStackParamList = {
  Login: undefined;
  Register: {
    initialRole?: MobileRegistrationRole;
  } | undefined;
};

export type WorkerStackParamList = {
  WorkerDashboard: undefined;
  JoinShift: undefined;
  MyShiftHistory: undefined;
  WorkerPayroll: undefined;
  WorkerShiftDetails: {
    shift: WorkerShiftHistoryItem;
  };
  OwnSettings: undefined;
};

export type ForemanStackParamList = {
  ForemanDashboard: undefined;
  ForemanShifts: undefined;
  ForemanCompanySettings: {
    notice?: string;
  } | undefined;
  ForemanPayRules: undefined;
  CreateShift: undefined;
  ForemanPayrollRequests: undefined;
  ForemanShiftDetails: {
    shiftId: number;
    initialShift?: ManagedShift;
  };
  ShiftSummary: {
    shiftId: number;
    shiftTitle?: string;
  };
  OwnSettings: undefined;
};

export type WorkerGateStackParamList = {
  JoinCompany: undefined;
  OwnSettings: undefined;
};

export type ForemanGateStackParamList = {
  CreateCompany: undefined;
  OwnSettings: undefined;
};
