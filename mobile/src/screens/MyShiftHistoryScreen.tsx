import type { BottomTabScreenProps } from "@react-navigation/bottom-tabs";
import type { CompositeScreenProps } from "@react-navigation/native";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import { RefreshControl, StyleSheet, Text, View } from "react-native";
import { Button } from "../components/Button";
import { Screen } from "../components/Screen";
import { StateMessage } from "../components/StateMessage";
import { WorkerShiftHistoryCard } from "../components/WorkerShiftHistoryCard";
import { useAuth } from "../context/AuthContext";
import { useWorkerShiftHistoryPages } from "../hooks/useWorkerShiftHistoryPages";
import type { WorkerStackParamList, WorkerTabParamList } from "../types/navigation";
import { theme } from "../utils/theme";

type MyShiftHistoryScreenProps = CompositeScreenProps<
  BottomTabScreenProps<WorkerTabParamList, "MyShiftHistory">,
  NativeStackScreenProps<WorkerStackParamList>
>;

export function MyShiftHistoryScreen({ navigation }: MyShiftHistoryScreenProps) {
  const { user } = useAuth();
  const canAccess = user?.role === "WORKER" && user.company !== null;
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
  } = useWorkerShiftHistoryPages(canAccess);

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
        testID: "worker-shifts-scroll"
      }}
    >
      <View style={styles.container}>
        <View style={styles.header}>
          <Text style={styles.kicker}>Worker</Text>
          <Text style={styles.title}>My shift history</Text>
          <Text style={styles.subtitle}>
            Your joined shifts and returned attendance results, in backend order.
          </Text>
        </View>

        {!canAccess ? (
          <StateMessage
            message="Personal shift history is available only to a worker with a company."
            title="Worker company required"
            tone="error"
          />
        ) : initialLoading ? (
          <StateMessage
            loading
            message="Fetching your joined shifts."
            title="Loading history"
          />
        ) : initialError ? (
          <View style={styles.stateBlock}>
            <StateMessage
              message={initialError}
              title="Could not load history"
              tone="error"
            />
            <Button label="Retry" onPress={requestRefresh} variant="secondary" />
          </View>
        ) : shifts.length === 0 ? (
          <View style={styles.stateBlock}>
            <StateMessage
              message="Join your first shift with the code from your foreman."
              title="No shifts joined"
            />
            <Button
              label="Join shift"
              onPress={() => {
                navigation.navigate("JoinShift");
              }}
              variant="secondary"
            />
            <Button label="Refresh" onPress={requestRefresh} variant="ghost" />
          </View>
        ) : (
          <>
            <View style={styles.list}>
              {refreshError ? (
                <View style={styles.stateBlock}>
                  <StateMessage
                    message={refreshError}
                    title="Could not refresh history"
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
                <WorkerShiftHistoryCard
                  key={shift.attendanceId}
                  onFullView={() => {
                    navigation.navigate("WorkerShiftDetails", { shift });
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
                  disabled={refreshing}
                  label="Retry load more"
                  onPress={retryNextPage}
                  variant="secondary"
                />
              </View>
            ) : hasMore ? (
              <Button
                disabled={refreshing}
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
            navigation.navigate("WorkerDashboard");
          }}
          testID="worker-shifts-back-dashboard"
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
