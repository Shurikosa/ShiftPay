import type { NavigatorScreenParams } from "@react-navigation/native";
import type { MobileRegistrationRole } from "./auth";
import type { ManagedShift, WorkerShiftHistoryItem } from "./shifts";

export type AuthStackParamList = {
  Login: undefined;
  Register: {
    initialRole?: MobileRegistrationRole;
  } | undefined;
};

export type WorkerTabParamList = {
  WorkerDashboard: undefined;
  MyShiftHistory: undefined;
  WorkerPayroll: undefined;
  More: undefined;
};

export type WorkerStackParamList = {
  WorkerTabs: NavigatorScreenParams<WorkerTabParamList> | undefined;
  JoinShift: undefined;
  WorkerShiftDetails: {
    shift: WorkerShiftHistoryItem;
  };
  OwnSettings: undefined;
};

export type ForemanTabParamList = {
  ForemanDashboard: undefined;
  ForemanShifts: undefined;
  ForemanPayrollRequests: undefined;
  More: undefined;
};

export type ForemanStackParamList = {
  ForemanTabs: NavigatorScreenParams<ForemanTabParamList> | undefined;
  ForemanCompanySettings: {
    notice?: string;
  } | undefined;
  ForemanPayRules: undefined;
  CreateShift: undefined;
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
