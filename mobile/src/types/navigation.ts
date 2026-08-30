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
};

export type ForemanStackParamList = {
  ForemanDashboard: undefined;
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
};
