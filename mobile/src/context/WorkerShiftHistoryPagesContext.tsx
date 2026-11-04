import { createContext, type ReactNode, useContext } from "react";
import { useWorkerShiftHistoryPages } from "../hooks/useWorkerShiftHistoryPages";
import { useAuth } from "./AuthContext";

type WorkerShiftHistoryPagesContextValue = ReturnType<
  typeof useWorkerShiftHistoryPages
>;

const WorkerShiftHistoryPagesContext = createContext<
  WorkerShiftHistoryPagesContextValue | undefined
>(undefined);

export function WorkerShiftHistoryPagesProvider({
  children
}: {
  children: ReactNode;
}) {
  const { user } = useAuth();
  const canAccess = user?.role === "WORKER" && user.company !== null;
  const history = useWorkerShiftHistoryPages(canAccess, { loadOnMount: false });

  return (
    <WorkerShiftHistoryPagesContext.Provider value={history}>
      {children}
    </WorkerShiftHistoryPagesContext.Provider>
  );
}

export function useWorkerShiftHistoryPagesContext() {
  const value = useContext(WorkerShiftHistoryPagesContext);

  if (!value) {
    throw new Error(
      "useWorkerShiftHistoryPagesContext must be used within WorkerShiftHistoryPagesProvider"
    );
  }

  return value;
}
