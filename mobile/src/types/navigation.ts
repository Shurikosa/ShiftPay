import type { MobileRegistrationRole } from "./auth";
import type { WorkerShiftHistoryItem } from "./shifts";

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
  WorkerShiftDetails: {
    shift: WorkerShiftHistoryItem;
  };
};

export type ForemanStackParamList = {
  ForemanDashboard: undefined;
};
