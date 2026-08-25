import {
  createContext,
  type ReactNode,
  useCallback,
  useContext,
  useMemo,
  useState
} from "react";
import { getErrorMessage } from "../api/errors";
import { getManagedShifts } from "../api/shifts";
import type { ManagedShift } from "../types/shifts";
import { useAuth } from "./AuthContext";

type ForemanManagedShiftsContextValue = {
  shifts: ManagedShift[];
  loading: boolean;
  error: string | null;
  refresh: () => Promise<ManagedShift[]>;
};

const ForemanManagedShiftsContext = createContext<
  ForemanManagedShiftsContextValue | undefined
>(undefined);

export function ForemanManagedShiftsProvider({ children }: { children: ReactNode }) {
  const { authenticatedRequest } = useAuth();
  const [shifts, setShifts] = useState<ManagedShift[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async (): Promise<ManagedShift[]> => {
    setLoading(true);
    setError(null);

    try {
      const nextShifts = await authenticatedRequest(getManagedShifts);
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
    <ForemanManagedShiftsContext.Provider value={value}>
      {children}
    </ForemanManagedShiftsContext.Provider>
  );
}

export function useForemanManagedShiftsContext() {
  const value = useContext(ForemanManagedShiftsContext);

  if (!value) {
    throw new Error(
      "useForemanManagedShiftsContext must be used within ForemanManagedShiftsProvider"
    );
  }

  return value;
}
