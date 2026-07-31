import { useFocusEffect } from "@react-navigation/native";
import { useCallback } from "react";
import { useWorkerShiftHistoryContext } from "../context/WorkerShiftHistoryContext";

type UseWorkerShiftHistoryOptions = {
  loadOnFocus?: boolean;
};

export function useWorkerShiftHistory({
  loadOnFocus = true
}: UseWorkerShiftHistoryOptions = {}) {
  const history = useWorkerShiftHistoryContext();
  const { refresh } = history;

  useFocusEffect(
    useCallback(() => {
      if (loadOnFocus) {
        void refresh().catch(() => undefined);
      }

      return undefined;
    }, [loadOnFocus, refresh])
  );

  return history;
}
