import { useCallback, useEffect, useRef, useState } from "react";
import { getErrorMessage } from "../api/errors";
import { getMyDashboardShifts } from "../api/shifts";
import { useAuth } from "../context/AuthContext";
import type { WorkerShiftHistoryItem } from "../types/shifts";

type WorkerDashboardShiftsState = {
  shifts: WorkerShiftHistoryItem[];
  initialLoading: boolean;
  refreshing: boolean;
  initialError: string | null;
  refreshError: string | null;
};

const MAX_DASHBOARD_SHIFTS = 5;

const emptyState: WorkerDashboardShiftsState = {
  shifts: [],
  initialLoading: false,
  refreshing: false,
  initialError: null,
  refreshError: null
};

function uniqueAttendances(
  items: WorkerShiftHistoryItem[]
): WorkerShiftHistoryItem[] {
  const seenIds = new Set<number>();
  const uniqueItems: WorkerShiftHistoryItem[] = [];

  for (const item of items) {
    if (seenIds.has(item.attendanceId)) continue;
    seenIds.add(item.attendanceId);
    uniqueItems.push(item);
  }

  return uniqueItems;
}

export function useWorkerDashboardShifts(enabled: boolean) {
  const { authenticatedRequest } = useAuth();
  const [state, setState] = useState<WorkerDashboardShiftsState>(() => ({
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
          getMyDashboardShifts(token)
        );
        if (
          !mountedRef.current ||
          !enabledRef.current ||
          generationRef.current !== requestGeneration
        ) {
          return;
        }

        setState({
          shifts: uniqueAttendances(page.items).slice(0, MAX_DASHBOARD_SHIFTS),
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
