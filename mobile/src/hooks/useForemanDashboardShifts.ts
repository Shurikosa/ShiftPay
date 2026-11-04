import { useCallback, useEffect, useRef, useState } from "react";
import { getErrorMessage } from "../api/errors";
import { getManagedDashboardShifts } from "../api/shifts";
import { useAuth } from "../context/AuthContext";
import type { ManagedShift } from "../types/shifts";

type ForemanDashboardShiftsState = {
  shifts: ManagedShift[];
  initialLoading: boolean;
  refreshing: boolean;
  initialError: string | null;
  refreshError: string | null;
};

const MAX_DASHBOARD_SHIFTS = 5;

const emptyState: ForemanDashboardShiftsState = {
  shifts: [],
  initialLoading: false,
  refreshing: false,
  initialError: null,
  refreshError: null
};

function uniqueShifts(items: ManagedShift[]): ManagedShift[] {
  const seenIds = new Set<number>();
  const uniqueItems: ManagedShift[] = [];

  for (const item of items) {
    if (seenIds.has(item.id)) continue;
    seenIds.add(item.id);
    uniqueItems.push(item);
  }

  return uniqueItems;
}

export function useForemanDashboardShifts(enabled: boolean) {
  const { authenticatedRequest } = useAuth();
  const [state, setState] = useState<ForemanDashboardShiftsState>(() => ({
    ...emptyState,
    initialLoading: enabled
  }));
  const mountedRef = useRef(false);
  const enabledRef = useRef(enabled);
  const generationRef = useRef(0);
  const requestRef = useRef<Promise<void> | null>(null);

  const refresh = useCallback((): Promise<void> => {
    if (!mountedRef.current || !enabledRef.current) {
      return Promise.resolve();
    }
    if (requestRef.current) {
      return requestRef.current;
    }

    const requestGeneration = ++generationRef.current;
    setState((current) => ({
      ...current,
      initialLoading: current.shifts.length === 0,
      refreshing: current.shifts.length > 0,
      initialError: null,
      refreshError: null
    }));

    const request = (async () => {
      try {
        const page = await authenticatedRequest((token) =>
          getManagedDashboardShifts(token)
        );
        if (
          !mountedRef.current ||
          !enabledRef.current ||
          generationRef.current !== requestGeneration
        ) {
          return;
        }

        setState({
          shifts: uniqueShifts(page.items).slice(0, MAX_DASHBOARD_SHIFTS),
          initialLoading: false,
          refreshing: false,
          initialError: null,
          refreshError: null
        });
      } catch (error) {
        if (
          !mountedRef.current ||
          !enabledRef.current ||
          generationRef.current !== requestGeneration
        ) {
          return;
        }

        const message = getErrorMessage(error);
        setState((current) => ({
          ...current,
          initialLoading: false,
          refreshing: false,
          initialError: current.shifts.length === 0 ? message : null,
          refreshError: current.shifts.length > 0 ? message : null
        }));
        throw error;
      } finally {
        if (generationRef.current === requestGeneration) {
          requestRef.current = null;
        }
      }
    })();

    requestRef.current = request;
    return request;
  }, [authenticatedRequest]);

  useEffect(() => {
    mountedRef.current = true;
    enabledRef.current = enabled;
    if (enabled) {
      void refresh().catch(() => undefined);
    } else {
      generationRef.current += 1;
      requestRef.current = null;
      // Clear records from a previously authorized role/company context.
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setState(emptyState);
    }

    return () => {
      mountedRef.current = false;
      enabledRef.current = false;
      generationRef.current += 1;
      requestRef.current = null;
    };
  }, [enabled, refresh]);

  return {
    ...(enabled ? state : emptyState),
    refresh
  };
}
