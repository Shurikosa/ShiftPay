import type { BottomTabScreenProps } from "@react-navigation/bottom-tabs";
import type { CompositeScreenProps } from "@react-navigation/native";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import { RefreshControl, StyleSheet, Text, View } from "react-native";
import { Button } from "../components/Button";
import { ManagedShiftHistoryCard } from "../components/ManagedShiftHistoryCard";
import { Screen } from "../components/Screen";
import { StateMessage } from "../components/StateMessage";
import { useAuth } from "../context/AuthContext";
import { useForemanManagedShiftPages } from "../hooks/useForemanManagedShiftPages";
import type { ForemanStackParamList, ForemanTabParamList } from "../types/navigation";
import { theme } from "../utils/theme";

type ForemanShiftsScreenProps = CompositeScreenProps<
  BottomTabScreenProps<ForemanTabParamList, "ForemanShifts">,
  NativeStackScreenProps<ForemanStackParamList>
>;

export function ForemanShiftsScreen({ navigation }: ForemanShiftsScreenProps) {
  const { user } = useAuth();
  const canAccess = user?.role === "FOREMAN" && user.company !== null;
  const {
    shifts,
    hasMore,
    initialLoading,
    refreshing,
    continuationLoading,
    initialError,
    refreshError,
    continuationError,
    refresh,
    loadMore,
    retryContinuation
  } = useForemanManagedShiftPages(canAccess);

  const requestRefresh = () => {
    void refresh().catch(() => undefined);
  };

  const requestNextPage = () => {
    void loadMore().catch(() => undefined);
  };

  const retryNextPage = () => {
    void retryContinuation().catch(() => undefined);
  };

  return (
    <Screen
      scrollProps={{
        refreshControl: canAccess ? (
          <RefreshControl onRefresh={requestRefresh} refreshing={refreshing} />
        ) : undefined,
        testID: "foreman-shifts-scroll"
      }}
    >
      <View style={styles.container}>
        <View style={styles.header}>
          <Text style={styles.kicker}>Foreman</Text>
          <Text style={styles.title}>My shift history</Text>
          <Text style={styles.subtitle}>
            Shifts you created and manage, in backend order.
          </Text>
        </View>

        {!canAccess ? (
          <StateMessage
            message="Managed shift history is available only to a foreman with a company."
            title="Foreman company required"
            tone="error"
          />
        ) : initialLoading ? (
          <StateMessage
            loading
            message="Fetching your managed shifts."
            title="Loading shifts"
          />
        ) : initialError ? (
          <View style={styles.stateBlock}>
            <StateMessage
              message={initialError}
              title="Could not load shifts"
              tone="error"
            />
            <Button label="Retry" onPress={requestRefresh} variant="secondary" />
          </View>
        ) : shifts.length === 0 ? (
          <View style={styles.stateBlock}>
            <StateMessage
              message="Create a shift to see it in your managed history."
              title="No managed shifts"
            />
            <Button label="Refresh" onPress={requestRefresh} variant="secondary" />
          </View>
        ) : (
          <>
            <View style={styles.list}>
              {refreshError ? (
                <View style={styles.stateBlock}>
                  <StateMessage
                    message={refreshError}
                    title="Could not refresh shifts"
                    tone="error"
                  />
                  <Button
                    label="Retry refresh"
                    onPress={requestRefresh}
                    variant="secondary"
                  />
                </View>
              ) : null}

              <Button
                label="Refresh"
                loading={refreshing}
                onPress={requestRefresh}
                variant="ghost"
              />

              {shifts.map((shift) => (
                <ManagedShiftHistoryCard
                  key={shift.id}
                  onFullView={() => {
                    navigation.navigate("ForemanShiftDetails", {
                      shiftId: shift.id,
                      initialShift: shift
                    });
                  }}
                  shift={shift}
                />
              ))}
            </View>

            {continuationError ? (
              <View style={styles.stateBlock}>
                <StateMessage
                  message={continuationError}
                  title="Could not load more shifts"
                  tone="error"
                />
                <Button
                  label="Retry load more"
                  onPress={retryNextPage}
                  variant="secondary"
                />
              </View>
            ) : hasMore ? (
              <Button
                label="Load more"
                loading={continuationLoading}
                onPress={requestNextPage}
                variant="secondary"
              />
            ) : null}
          </>
        )}

        <Button
          label="Back to dashboard"
          onPress={() => {
            navigation.navigate("ForemanDashboard");
          }}
          testID="foreman-shifts-back-dashboard"
          variant="ghost"
        />
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    gap: theme.gap.section
  },
  header: {
    gap: theme.space[2]
  },
  kicker: {
    ...theme.typography.label,
    color: theme.colors.brand.primary
  },
  title: {
    ...theme.typography.screenTitle,
    color: theme.colors.ink.primary
  },
  subtitle: {
    ...theme.typography.body,
    color: theme.colors.ink.secondary
  },
  stateBlock: {
    gap: theme.space[3]
  },
  list: {
    gap: theme.space[3]
  }
});
