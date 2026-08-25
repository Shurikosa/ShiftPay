import { useFocusEffect } from "@react-navigation/native";
import { useCallback } from "react";
import { useForemanManagedShiftsContext } from "../context/ForemanManagedShiftsContext";

type UseForemanManagedShiftsOptions = {
  loadOnFocus?: boolean;
};

export function useForemanManagedShifts({
  loadOnFocus = true
}: UseForemanManagedShiftsOptions = {}) {
  const managedShifts = useForemanManagedShiftsContext();
  const { refresh } = managedShifts;

  useFocusEffect(
    useCallback(() => {
      if (loadOnFocus) {
        void refresh().catch(() => undefined);
      }

      return undefined;
    }, [loadOnFocus, refresh])
  );

  return managedShifts;
}
