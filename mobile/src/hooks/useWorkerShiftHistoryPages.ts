import { useCallback, useEffect, useRef, useState } from "react";
import { getErrorMessage } from "../api/errors";
import { getMyShiftHistoryPage } from "../api/shifts";
import { useAuth } from "../context/AuthContext";
import type {
  WorkerShiftHistoryItem,
  WorkerShiftHistoryPageResponse
} from "../types/shifts";

type WorkerShiftHistoryPagesState = {
  shifts: WorkerShiftHistoryItem[];
  nextCursor: string | null;
  hasMore: boolean;
  initialLoading: boolean;
  refreshing: boolean;
  continuationLoading: boolean;
  initialError: string | null;
  refreshError: string | null;
  continuationError: string | null;
};

const emptyState: WorkerShiftHistoryPagesState = {
  shifts: [],
  nextCursor: null,
  hasMore: false,
  initialLoading: false,
  refreshing: false,
  continuationLoading: false,
  initialError: null,
  refreshError: null,
  continuationError: null
};

function normalizePage(
  page: WorkerShiftHistoryPageResponse
): WorkerShiftHistoryPageResponse {
  if (page.hasMore !== (page.nextCursor !== null)) {
    throw new Error("The worker shift page returned inconsistent continuation state.");
  }
  return page;
}

function uniqueAttendances(
  items: WorkerShiftHistoryItem[],
  seenIds: Set<number> = new Set<number>()
): WorkerShiftHistoryItem[] {
  const uniqueItems: WorkerShiftHistoryItem[] = [];

  for (const item of items) {
    if (seenIds.has(item.attendanceId)) continue;
    seenIds.add(item.attendanceId);
    uniqueItems.push(item);
  }

  return uniqueItems;
}

export function useWorkerShiftHistoryPages(enabled: boolean) {
  const { authenticatedRequest } = useAuth();
  const [state, setState] = useState<WorkerShiftHistoryPagesState>(() => ({
    ...emptyState,
    initialLoading: enabled
  }));
  const mountedRef = useRef(false);
  const enabledRef = useRef(enabled);
  const generationRef = useRef(0);
  const refreshPromiseRef = useRef<Promise<void> | null>(null);
  const continuationInFlightRef = useRef(false);
  const nextCursorRef = useRef<string | null>(null);
  const failedCursorRef = useRef<string | null>(null);

  enabledRef.current = enabled;

  const refresh = useCallback((): Promise<void> => {
    if (!mountedRef.current || !enabledRef.current) {
      return Promise.resolve();
    }
    if (refreshPromiseRef.current) {
      return refreshPromiseRef.current;
    }

    const requestGeneration = ++generationRef.current;
    continuationInFlightRef.current = false;

    setState((current) => ({
      ...current,
      initialLoading: current.shifts.length === 0,
      refreshing: current.shifts.length > 0,
      continuationLoading: false,
      initialError: null,
      refreshError: null
    }));

    const request = (async () => {
      try {
        const page = normalizePage(
          await authenticatedRequest((token) => getMyShiftHistoryPage(token))
        );
        if (
          !mountedRef.current ||
          !enabledRef.current ||
          generationRef.current !== requestGeneration
        ) {
          return;
        }

        failedCursorRef.current = null;
        nextCursorRef.current = page.nextCursor;
        setState({
          shifts: uniqueAttendances(page.items),
          nextCursor: page.nextCursor,
          hasMore: page.hasMore,
          initialLoading: false,
          refreshing: false,
          continuationLoading: false,
          initialError: null,
          refreshError: null,
          continuationError: null
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
          refreshPromiseRef.current = null;
        }
      }
    })();

    refreshPromiseRef.current = request;
    return request;
  }, [authenticatedRequest]);

  const loadMore = useCallback(async (): Promise<void> => {
    if (
      !mountedRef.current ||
      !enabledRef.current ||
      refreshPromiseRef.current ||
      continuationInFlightRef.current
    ) {
      return;
    }

    const cursor = failedCursorRef.current ?? nextCursorRef.current;
    if (!cursor) return;

    const requestGeneration = generationRef.current;
    continuationInFlightRef.current = true;
    setState((current) => ({
      ...current,
      continuationLoading: true,
      continuationError: null
    }));

    try {
      const page = normalizePage(
        await authenticatedRequest((token) => getMyShiftHistoryPage(token, cursor))
      );
      if (
        !mountedRef.current ||
        !enabledRef.current ||
        generationRef.current !== requestGeneration
      ) {
        return;
      }

      failedCursorRef.current = null;
      nextCursorRef.current = page.nextCursor;
      setState((current) => {
        const seenIds = new Set(
          current.shifts.map((shift) => shift.attendanceId)
        );
        return {
          ...current,
          shifts: [
            ...current.shifts,
            ...uniqueAttendances(page.items, seenIds)
          ],
          nextCursor: page.nextCursor,
          hasMore: page.hasMore,
          continuationLoading: false,
          continuationError: null
        };
      });
    } catch (error) {
      if (
        !mountedRef.current ||
        !enabledRef.current ||
        generationRef.current !== requestGeneration
      ) {
        return;
      }
      failedCursorRef.current = cursor;
      setState((current) => ({
        ...current,
        continuationLoading: false,
        continuationError: getErrorMessage(error)
      }));
      throw error;
    } finally {
      if (generationRef.current === requestGeneration) {
        continuationInFlightRef.current = false;
      }
    }
  }, [authenticatedRequest]);

  useEffect(() => {
    mountedRef.current = true;
    if (enabled) {
      void refresh().catch(() => undefined);
    } else {
      generationRef.current += 1;
      nextCursorRef.current = null;
      failedCursorRef.current = null;
      setState(emptyState);
    }

    return () => {
      mountedRef.current = false;
      generationRef.current += 1;
      refreshPromiseRef.current = null;
      continuationInFlightRef.current = false;
    };
  }, [enabled, refresh]);

  return {
    ...state,
    refresh,
    loadMore,
    retryContinuation: loadMore
  };
}
