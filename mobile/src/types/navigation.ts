import type { MobileRegistrationRole } from "./auth";

export type AuthStackParamList = {
  Login: undefined;
  Register: {
    initialRole?: MobileRegistrationRole;
  } | undefined;
};

export type WorkerStackParamList = {
  WorkerDashboard: undefined;
};

export type ForemanStackParamList = {
  ForemanDashboard: undefined;
};
