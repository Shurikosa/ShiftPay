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
import { ManagedShiftHistoryCard } from "../components/ManagedShiftHistoryCard";
import { Screen } from "../components/Screen";
import { useAuth } from "../context/AuthContext";
import { useForemanDashboardShifts } from "../hooks/useForemanDashboardShifts";
import { useLogoutAction } from "../hooks/useLogoutAction";
import type { ForemanStackParamList, ForemanTabParamList } from "../types/navigation";
import { theme } from "../utils/theme";

type ForemanDashboardScreenProps = CompositeScreenProps<
  BottomTabScreenProps<ForemanTabParamList, "ForemanDashboard">,
  NativeStackScreenProps<ForemanStackParamList>
>;

const MAX_DASHBOARD_SHIFTS = 5;

function SemanticIcon(props: AppIconProps) {
  // Keep native icon loading on the rendered dashboard path, not module import.
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { AppIcon } = require("../components/AppIcon") as typeof import("../components/AppIcon");
  return <AppIcon {...props} />;
}

function getForemanName(user: ReturnType<typeof useAuth>["user"]): string {
  const name = [user?.firstName, user?.lastName]
    .filter((part): part is string =>
      typeof part === "string" && part.trim().length > 0
    )
    .map((part) => part.trim())
    .join(" ");

  return name || "Foreman";
}

export function ForemanDashboardScreen({ navigation }: ForemanDashboardScreenProps) {
  const { user } = useAuth();
  const { loggingOut, logoutError, requestLogout } = useLogoutAction();
  const isForeman = user?.role === "FOREMAN";
  const company = isForeman ? user.company : null;
  const canAccess = isForeman && company !== null;
  const {
    shifts,
    initialLoading,
    refreshing,
    initialError,
    refreshError,
    refresh
  } = useForemanDashboardShifts(canAccess);
  const recentShifts = shifts.slice(0, MAX_DASHBOARD_SHIFTS);

  const requestRefresh = () => {
    void refresh().catch(() => undefined);
  };

  useEffect(
    () =>
      navigation.addListener("focus", () => {
        void refresh().catch(() => undefined);
      }),
    [navigation, refresh]
  );

  const openCreateShift = () => {
    if (canAccess) {
      navigation.navigate("CreateShift");
    }
  };

  return (
    <Screen
      scroll
      scrollProps={{
        refreshControl: canAccess ? (
          <RefreshControl onRefresh={requestRefresh} refreshing={refreshing} />
        ) : undefined,
        testID: "foreman-dashboard-scroll"
      }}
    >
      <View style={styles.page} testID="foreman-dashboard-content">
        <View style={styles.header} testID="foreman-dashboard-header">
          <Text allowFontScaling style={styles.brand}>
            ShiftPay
          </Text>
          <Text allowFontScaling style={styles.role}>
            Foreman
          </Text>
          <Text accessibilityRole="header" allowFontScaling style={styles.title}>
            {getForemanName(user)}
          </Text>
          <Text allowFontScaling style={styles.supporting}>
            Create shifts and manage your crew.
          </Text>
          <Button
            accessibilityHint="Opens your personal profile and credential settings."
            label="Settings"
            leadingIcon="settings"
            onPress={() => navigation.navigate("OwnSettings")}
            testID="foreman-settings"
            variant="secondary"
          />
        </View>

        {company ? (
          <Card testID="foreman-company-card">
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
                {company.joinCode ? (
                  <View style={styles.joinCodeBlock}>
                    <Text allowFontScaling style={styles.joinCodeLabel}>
                      Worker join code
                    </Text>
                    <Text allowFontScaling style={styles.joinCodeValue}>
                      {company.joinCode}
                    </Text>
                  </View>
                ) : null}
              </View>
            </View>
          </Card>
        ) : (
          <Feedback
            message="Create your company before managing shifts."
            mode="screen"
            testID="foreman-company-required"
            title="Company required"
            tone="error"
          />
        )}

        <View style={styles.tiles} testID="foreman-dashboard-actions">
          <ActionTile
            accessibilityHint="Opens the form for creating a new shift."
            disabled={!canAccess}
            icon="add"
            label="Create shift"
            onPress={openCreateShift}
            testID="foreman-create-shift"
            tone="primary"
          />
          <ActionTile
            accessibilityHint="Opens all shifts created and managed by this foreman."
            disabled={!canAccess}
            icon="calendar"
            label="My shift history"
            onPress={() => navigation.navigate("ForemanShifts")}
            testID="foreman-history-tile"
          />
          <ActionTile
            accessibilityHint="Opens payroll requests for managed workers."
            disabled={!canAccess}
            icon="payroll"
            label="Payroll"
            onPress={() => navigation.navigate("ForemanPayrollRequests")}
            testID="foreman-payroll-tile"
          />
        </View>

        <View style={styles.section} testID="foreman-recent-section">
          <View style={styles.sectionHeader}>
            <Text accessibilityRole="header" allowFontScaling style={styles.sectionTitle}>
              Current and recent shifts
            </Text>
            {canAccess ? (
              <Button
                accessibilityHint="Opens the complete managed shift history."
                label="View all"
                onPress={() => navigation.navigate("ForemanShifts")}
                testID="foreman-view-all"
                variant="ghost"
              />
            ) : null}
          </View>

          {initialLoading ? (
            <Feedback
              loading
              message="Fetching your managed shifts."
              mode="screen"
              testID="foreman-shifts-loading"
              title="Loading shifts"
            />
          ) : initialError ? (
            <Feedback
              action={{
                accessibilityHint: "Reloads your current and recent managed shifts.",
                label: "Retry",
                onPress: requestRefresh,
                testID: "foreman-shifts-retry"
              }}
              message={initialError}
              mode="screen"
              testID="foreman-shifts-error"
              title="Could not load shifts"
              tone="error"
            />
          ) : shifts.length === 0 ? (
            <EmptyState
              action={{
                accessibilityHint: "Opens the form for creating a new shift.",
                disabled: !canAccess,
                label: "Create shift",
                onPress: openCreateShift,
                testID: "foreman-empty-create-shift"
              }}
              message="Create a shift to receive a worker join code."
              testID="foreman-shifts-empty"
              title="No managed shifts"
            />
          ) : (
            <View style={styles.list}>
              {refreshError ? (
                <Feedback
                  action={{
                    accessibilityHint: "Retries the latest foreman dashboard refresh.",
                    label: "Retry refresh",
                    onPress: requestRefresh,
                    testID: "foreman-shifts-refresh-retry"
                  }}
                  message={refreshError}
                  testID="foreman-shifts-refresh-error"
                  title="Could not refresh shifts"
                  tone="error"
                />
              ) : null}
              {recentShifts.map((shift) => (
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
          )}
        </View>

        <View style={styles.logout}>
          {logoutError ? (
            <Feedback
              message={logoutError}
              testID="foreman-logout-error"
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
            testID="foreman-logout"
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
    alignItems: "flex-start",
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
    gap: theme.space[2],
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
  joinCodeBlock: {
    alignSelf: "flex-start",
    backgroundColor: theme.colors.surface.subtle,
    borderColor: theme.colors.border,
    borderRadius: theme.radius.sm,
    borderWidth: theme.border.default,
    gap: theme.space[1],
    maxWidth: "100%",
    paddingHorizontal: theme.space[3],
    paddingVertical: theme.space[2]
  },
  joinCodeLabel: {
    ...theme.typography.caption,
    color: theme.colors.ink.muted,
    flexShrink: 1
  },
  joinCodeValue: {
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
