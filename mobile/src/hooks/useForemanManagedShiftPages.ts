import { useCallback, useEffect, useRef, useState } from "react";
import { getErrorMessage } from "../api/errors";
import { getManagedShiftsPage } from "../api/shifts";
import { useAuth } from "../context/AuthContext";
import type { ManagedShift, ManagedShiftPageResponse } from "../types/shifts";

type ManagedShiftPagesState = {
  shifts: ManagedShift[];
  nextCursor: string | null;
  hasMore: boolean;
  initialLoading: boolean;
  refreshing: boolean;
  continuationLoading: boolean;
  initialError: string | null;
  refreshError: string | null;
  continuationError: string | null;
};

const emptyState: ManagedShiftPagesState = {
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

function normalizePage(page: ManagedShiftPageResponse): ManagedShiftPageResponse {
  const hasContinuation = page.nextCursor !== null;
  if (page.hasMore !== hasContinuation) {
    throw new Error("The managed-shift page returned inconsistent continuation state.");
  }
  return page;
}

function uniqueShifts(
  items: ManagedShift[],
  seenIds: Set<number> = new Set<number>()
): ManagedShift[] {
  const uniqueItems: ManagedShift[] = [];

  for (const item of items) {
    if (seenIds.has(item.id)) continue;
    seenIds.add(item.id);
    uniqueItems.push(item);
  }

  return uniqueItems;
}

export function useForemanManagedShiftPages(enabled: boolean) {
  const { authenticatedRequest } = useAuth();
  const [state, setState] = useState<ManagedShiftPagesState>(() => ({
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
    failedCursorRef.current = null;
    nextCursorRef.current = null;

    setState((current) => ({
      ...current,
      hasMore: false,
      nextCursor: null,
      initialLoading: current.shifts.length === 0,
      refreshing: current.shifts.length > 0,
      continuationLoading: false,
      initialError: null,
      refreshError: null,
      continuationError: null
    }));

    const request = (async () => {
      try {
        const page = normalizePage(
          await authenticatedRequest((token) => getManagedShiftsPage(token))
        );
        if (
          !mountedRef.current ||
          !enabledRef.current ||
          generationRef.current !== requestGeneration
        ) {
          return;
        }

        nextCursorRef.current = page.nextCursor;
        setState({
          shifts: uniqueShifts(page.items),
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
        await authenticatedRequest((token) => getManagedShiftsPage(token, cursor))
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
        const loadedIds = new Set(current.shifts.map((shift) => shift.id));
        const newItems = uniqueShifts(page.items, loadedIds);
        return {
          ...current,
          shifts: [...current.shifts, ...newItems],
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
