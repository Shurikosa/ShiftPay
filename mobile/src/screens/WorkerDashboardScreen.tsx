import type { BottomTabScreenProps } from "@react-navigation/bottom-tabs";
import type { CompositeScreenProps } from "@react-navigation/native";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import { useEffect } from "react";
import { RefreshControl, StyleSheet, Text, View } from "react-native";
import { ActionTile } from "../components/ActionTile";
import type { AppIconProps } from "../components/AppIcon";
import { Button } from "../components/Button";
import { Card } from "../components/Card";
import { EmptyState } from "../components/EmptyState";
import { Feedback } from "../components/Feedback";
import { Screen } from "../components/Screen";
import { WorkerShiftHistoryCard } from "../components/WorkerShiftHistoryCard";
import { useAuth } from "../context/AuthContext";
import { useLogoutAction } from "../hooks/useLogoutAction";
import { useWorkerDashboardShifts } from "../hooks/useWorkerDashboardShifts";
import type { WorkerStackParamList, WorkerTabParamList } from "../types/navigation";
import { theme } from "../utils/theme";

type WorkerDashboardScreenProps = CompositeScreenProps<
  BottomTabScreenProps<WorkerTabParamList, "WorkerDashboard">,
  NativeStackScreenProps<WorkerStackParamList>
>;

const MAX_DASHBOARD_SHIFTS = 5;

function SemanticIcon(props: AppIconProps) {
  // Keep native icon loading on the rendered dashboard path, not module import.
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { AppIcon } = require("../components/AppIcon") as typeof import("../components/AppIcon");
  return <AppIcon {...props} />;
}

function getWorkerName(user: ReturnType<typeof useAuth>["user"]): string {
  const name = [user?.firstName, user?.lastName]
    .filter((part): part is string => typeof part === "string" && part.trim().length > 0)
    .map((part) => part.trim())
    .join(" ");

  return name || "Worker";
}

export function WorkerDashboardScreen({ navigation }: WorkerDashboardScreenProps) {
  const { user } = useAuth();
  const { loggingOut, logoutError, requestLogout } = useLogoutAction();
  const isWorker = user?.role === "WORKER";
  const company = isWorker ? user.company : null;
  const canAccess = isWorker && company !== null;
  const {
    shifts,
    initialLoading,
    refreshing,
    initialError,
    refreshError,
    refresh
  } = useWorkerDashboardShifts(canAccess);
  const recentShifts = shifts.slice(0, MAX_DASHBOARD_SHIFTS);

  const handleRetry = () => {
    void refresh().catch(() => undefined);
  };

  useEffect(
    () =>
      navigation.addListener("focus", () => {
        void refresh().catch(() => undefined);
      }),
    [navigation, refresh]
  );

  const openJoinShift = () => {
    if (canAccess) {
      navigation.navigate("JoinShift");
    }
  };

  return (
    <Screen
      scroll
      scrollProps={{
        refreshControl: canAccess ? (
          <RefreshControl onRefresh={handleRetry} refreshing={refreshing} />
        ) : undefined,
        testID: "worker-dashboard-scroll"
      }}
    >
      <View style={styles.page} testID="worker-dashboard-content">
        <View style={styles.header} testID="worker-dashboard-header">
          <Text allowFontScaling style={styles.brand}>
            ShiftPay
          </Text>
          <Text allowFontScaling style={styles.role}>
            Worker
          </Text>
          <Text accessibilityRole="header" allowFontScaling style={styles.title}>
            {getWorkerName(user)}
          </Text>
          <Text allowFontScaling style={styles.supporting}>
            Join shifts and review your attendance history.
          </Text>
          <Button
            accessibilityHint="Opens your personal profile and credential settings."
            label="Settings"
            leadingIcon="settings"
            onPress={() => navigation.navigate("OwnSettings")}
            testID="worker-settings"
            variant="secondary"
          />
        </View>

        {company ? (
          <Card testID="worker-company-card">
            <View style={styles.companyContent}>
              <View style={styles.companyIcon}>
                <SemanticIcon name="company" size="tile" tone="brand" />
              </View>
              <View style={styles.companyCopy}>
                <Text allowFontScaling style={styles.companyLabel}>
                  Company
                </Text>
                <Text allowFontScaling style={styles.companyName}>
                  {company.name}
                </Text>
              </View>
            </View>
          </Card>
        ) : (
          <Feedback
            message="Join your company before joining shifts."
            mode="screen"
            testID="worker-company-required"
            title="Company required"
            tone="error"
          />
        )}

        <View style={styles.tiles} testID="worker-dashboard-actions">
          <ActionTile
            accessibilityHint="Opens the form for joining a shift by code."
            disabled={!canAccess}
            icon="join"
            label="Join shift"
            onPress={openJoinShift}
            testID="worker-join-shift"
            tone="primary"
          />
          <ActionTile
            accessibilityHint="Opens all shifts joined by this worker."
            disabled={!canAccess}
            icon="calendar"
            label="My shift history"
            onPress={() => {
              navigation.navigate("MyShiftHistory");
            }}
            testID="worker-history-tile"
          />
          <ActionTile
            accessibilityHint="Opens this worker's payroll requests."
            disabled={!canAccess}
            icon="payroll"
            label="Payroll"
            onPress={() => {
              navigation.navigate("WorkerPayroll");
            }}
            testID="worker-payroll-tile"
          />
        </View>

        <View style={styles.section} testID="worker-recent-section">
          <View style={styles.sectionHeader}>
            <Text accessibilityRole="header" allowFontScaling style={styles.sectionTitle}>
              Current and recent shifts
            </Text>
            {canAccess ? (
              <Button
                accessibilityHint="Opens the complete worker shift history."
                label="View all"
                onPress={() => {
                  navigation.navigate("MyShiftHistory");
                }}
                testID="worker-view-all"
                variant="ghost"
              />
            ) : null}
          </View>

          {initialLoading ? (
            <Feedback
              loading
              message="Fetching your worker history."
              mode="screen"
              testID="worker-shifts-loading"
              title="Loading shifts"
            />
          ) : initialError ? (
            <Feedback
              action={{
                accessibilityHint: "Reloads your current and recent shifts.",
                label: "Retry",
                onPress: handleRetry,
                testID: "worker-shifts-retry"
              }}
              message={initialError}
              mode="screen"
              testID="worker-shifts-error"
              title="Could not load shifts"
              tone="error"
            />
          ) : shifts.length === 0 ? (
            <EmptyState
              action={{
                accessibilityHint: "Opens the form for joining a shift by code.",
                disabled: !canAccess,
                label: "Join shift",
                onPress: openJoinShift,
                testID: "worker-empty-join-shift"
              }}
              message="Join a shift with the code from your foreman."
              testID="worker-shifts-empty"
              title="No shifts joined"
            />
          ) : (
            <View style={styles.list}>
              {refreshError ? (
                <Feedback
                  action={{
                    accessibilityHint: "Retries the latest worker dashboard refresh.",
                    label: "Retry refresh",
                    onPress: handleRetry,
                    testID: "worker-shifts-refresh-retry"
                  }}
                  message={refreshError}
                  testID="worker-shifts-refresh-error"
                  title="Could not refresh shifts"
                  tone="error"
                />
              ) : null}
              {recentShifts.map((shift) => (
                <WorkerShiftHistoryCard
                  key={shift.attendanceId}
                  shift={shift}
                  onFullView={() => {
                    navigation.navigate("WorkerShiftDetails", { shift });
                  }}
                />
              ))}
            </View>
          )}
        </View>

        <View style={styles.logout}>
          {logoutError ? (
            <Feedback
              message={logoutError}
              testID="worker-logout-error"
              title="Could not log out"
              tone="error"
            />
          ) : null}
          <Button
            accessibilityHint="Signs out of this account and returns to the sign-in flow."
            label="Log out"
            leadingIcon="logout"
            loading={loggingOut}
            onPress={requestLogout}
            testID="worker-logout"
            variant="ghost"
          />
        </View>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  page: {
    flexGrow: 1,
    flexShrink: 1,
    gap: theme.gap.section,
    maxWidth: "100%",
    width: "100%"
  },
  header: {
    flexShrink: 1,
    gap: theme.space[2],
    maxWidth: "100%"
  },
  brand: {
    ...theme.typography.screenTitle,
    color: theme.colors.brand.primary,
    flexShrink: 1
  },
  role: {
    ...theme.typography.label,
    color: theme.colors.brand.primary,
    flexShrink: 1
  },
  title: {
    ...theme.typography.display,
    color: theme.colors.ink.primary,
    flexShrink: 1
  },
  supporting: {
    ...theme.typography.body,
    color: theme.colors.ink.secondary,
    flexShrink: 1
  },
  companyContent: {
    alignItems: "center",
    flexDirection: "row",
    flexShrink: 1,
    gap: theme.space[3],
    maxWidth: "100%"
  },
  companyIcon: {
    alignItems: "center",
    alignSelf: "flex-start",
    backgroundColor: theme.colors.brand.tint,
    borderRadius: theme.radius.md,
    justifyContent: "center",
    padding: theme.space[2]
  },
  companyCopy: {
    flex: 1,
    flexShrink: 1,
    gap: theme.space[1],
    minWidth: 0
  },
  companyLabel: {
    ...theme.typography.caption,
    color: theme.colors.ink.muted,
    flexShrink: 1
  },
  companyName: {
    ...theme.typography.cardTitle,
    color: theme.colors.ink.primary,
    flexShrink: 1
  },
  tiles: {
    alignItems: "stretch",
    flexDirection: "row",
    flexShrink: 1,
    gap: theme.space[2],
    maxWidth: "100%"
  },
  section: {
    flexShrink: 1,
    gap: theme.space[4],
    maxWidth: "100%"
  },
  sectionHeader: {
    alignItems: "center",
    flexDirection: "row",
    flexShrink: 1,
    flexWrap: "wrap",
    gap: theme.space[3],
    justifyContent: "space-between",
    maxWidth: "100%"
  },
  sectionTitle: {
    ...theme.typography.sectionTitle,
    color: theme.colors.ink.primary,
    flex: 1,
    flexShrink: 1,
    minWidth: 0
  },
  list: {
    flexShrink: 1,
    gap: theme.space[3],
    maxWidth: "100%"
  },
  logout: {
    flexShrink: 1,
    maxWidth: "100%"
  }
});
