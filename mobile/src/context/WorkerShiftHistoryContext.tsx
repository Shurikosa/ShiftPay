import {
  createContext,
  type ReactNode,
  useCallback,
  useContext,
  useMemo,
  useState
} from "react";
import { getErrorMessage } from "../api/errors";
import { getMyShiftHistory } from "../api/shifts";
import type { WorkerShiftHistoryItem } from "../types/shifts";
import { useAuth } from "./AuthContext";

type WorkerShiftHistoryContextValue = {
  shifts: WorkerShiftHistoryItem[];
  loading: boolean;
  error: string | null;
  refresh: () => Promise<WorkerShiftHistoryItem[]>;
};

const WorkerShiftHistoryContext = createContext<
  WorkerShiftHistoryContextValue | undefined
>(undefined);

export function WorkerShiftHistoryProvider({ children }: { children: ReactNode }) {
  const { authenticatedRequest } = useAuth();
  const [shifts, setShifts] = useState<WorkerShiftHistoryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async (): Promise<WorkerShiftHistoryItem[]> => {
    setLoading(true);
    setError(null);

    try {
      const nextShifts = await authenticatedRequest(getMyShiftHistory);
      setShifts(nextShifts);
      return nextShifts;
    } catch (caughtError) {
      const message = getErrorMessage(caughtError);
      setError(message);
      throw caughtError;
    } finally {
      setLoading(false);
    }
  }, [authenticatedRequest]);

  const value = useMemo(
    () => ({
      shifts,
      loading,
      error,
      refresh
    }),
    [error, loading, refresh, shifts]
  );

  return (
    <WorkerShiftHistoryContext.Provider value={value}>
      {children}
    </WorkerShiftHistoryContext.Provider>
  );
}

export function useWorkerShiftHistoryContext() {
  const value = useContext(WorkerShiftHistoryContext);

  if (!value) {
    throw new Error(
      "useWorkerShiftHistoryContext must be used within WorkerShiftHistoryProvider"
    );
  }

  return value;
}
