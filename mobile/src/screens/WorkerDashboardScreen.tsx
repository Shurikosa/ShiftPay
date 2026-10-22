import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import { StyleSheet, Text, View } from "react-native";
import { ActionTile } from "../components/ActionTile";
import type { AppIconProps } from "../components/AppIcon";
import { Button } from "../components/Button";
import { Card } from "../components/Card";
import { EmptyState } from "../components/EmptyState";
import { Feedback } from "../components/Feedback";
import { Screen } from "../components/Screen";
import { WorkerShiftCard } from "../components/WorkerShiftCard";
import { useAuth } from "../context/AuthContext";
import { useLogoutAction } from "../hooks/useLogoutAction";
import { useWorkerShiftHistory } from "../hooks/useWorkerShiftHistory";
import type { WorkerStackParamList } from "../types/navigation";
import { theme } from "../utils/theme";

type WorkerDashboardScreenProps = NativeStackScreenProps<
  WorkerStackParamList,
  "WorkerDashboard"
>;

const RECENT_SHIFT_LIMIT = 3;

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
  const { shifts, loading, error, refresh } = useWorkerShiftHistory();
  const company = user?.company ?? null;
  const recentShifts = shifts.slice(0, RECENT_SHIFT_LIMIT);

  const handleRetry = () => {
    void refresh().catch(() => undefined);
  };

  const openJoinShift = () => {
    if (company) {
      navigation.navigate("JoinShift");
    }
  };

  return (
    <Screen scroll>
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

        <View style={styles.primaryAction}>
          <Button
            accessibilityHint="Opens the form for joining a shift by code."
            disabled={!company}
            label="Join shift"
            leadingIcon="join"
            onPress={openJoinShift}
            testID="worker-join-shift"
          />
        </View>

        <View style={styles.tiles} testID="worker-dashboard-actions">
          <ActionTile
            accessibilityHint="Opens all shifts joined by this worker."
            icon="calendar"
            label="My shift history"
            onPress={() => {
              navigation.navigate("MyShiftHistory");
            }}
            supportingText="Review joined shifts and attendance."
            testID="worker-history-tile"
          />
          <ActionTile
            accessibilityHint="Opens this worker's payroll requests."
            disabled={!company}
            icon="payroll"
            label="Payroll"
            onPress={() => {
              navigation.navigate("WorkerPayroll");
            }}
            supportingText="Review payable work and payout requests."
            testID="worker-payroll-tile"
          />
        </View>

        <View style={styles.section} testID="worker-recent-section">
          <View style={styles.sectionHeader}>
            <Text accessibilityRole="header" allowFontScaling style={styles.sectionTitle}>
              Current and recent shifts
            </Text>
            {shifts.length > RECENT_SHIFT_LIMIT ? (
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

          {loading ? (
            <Feedback
              loading
              message="Fetching your worker history."
              mode="screen"
              testID="worker-shifts-loading"
              title="Loading shifts"
            />
          ) : error ? (
            <Feedback
              action={{
                accessibilityHint: "Reloads your current and recent shifts.",
                label: "Retry",
                onPress: handleRetry,
                testID: "worker-shifts-retry"
              }}
              message={error}
              mode="screen"
              testID="worker-shifts-error"
              title="Could not load shifts"
              tone="error"
            />
          ) : recentShifts.length === 0 ? (
            <EmptyState
              action={{
                accessibilityHint: "Opens the form for joining a shift by code.",
                disabled: !company,
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
              {recentShifts.map((shift) => (
                <WorkerShiftCard
                  key={shift.attendanceId}
                  shift={shift}
                  onPress={() => {
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
  primaryAction: {
    flexShrink: 1,
    maxWidth: "100%"
  },
  tiles: {
    flexShrink: 1,
    gap: theme.space[3],
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
