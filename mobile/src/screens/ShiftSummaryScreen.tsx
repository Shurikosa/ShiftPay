import { useFocusEffect } from "@react-navigation/native";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import { useCallback, useEffect, useRef, useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import { ApiError, getErrorMessage } from "../api/errors";
import { getShiftSummary } from "../api/shifts";
import { Card } from "../components/Card";
import { DetailRow } from "../components/DetailRow";
import { Feedback } from "../components/Feedback";
import { PayCalculationBreakdown } from "../components/PayCalculationBreakdown";
import { Screen } from "../components/Screen";
import { ScreenHeader } from "../components/ScreenHeader";
import { SectionHeader } from "../components/SectionHeader";
import { StatusBadge } from "../components/StatusBadge";
import { useAuth } from "../context/AuthContext";
import type { ForemanStackParamList } from "../types/navigation";
import type { ShiftSummary } from "../types/shifts";
import {
  formatAuditDecimal,
  formatMoneyWithCurrencyLabel,
  formatMinutes
} from "../utils/format";
import { formatPauseMinutes } from "../utils/pauseDisplay";
import { getShiftStatusPresentation } from "../utils/status";
import { theme } from "../utils/theme";

type ShiftSummaryScreenProps = NativeStackScreenProps<
  ForemanStackParamList,
  "ShiftSummary"
>;

type SummaryLoadError = {
  message: string;
  notClosed: boolean;
};

function isNotClosedSummaryError(error: unknown): boolean {
  return (
    error instanceof ApiError &&
    error.status === 409 &&
    getErrorMessage(error).includes("available only for CLOSED")
  );
}

function formatAuditAmount(value: number, currencyLabel: string | null): string {
  return `${formatAuditDecimal(value)} ${currencyLabel ?? "currency unavailable"}`;
}

function ResultMetric({
  label,
  value,
  testID
}: {
  label: string;
  value: string;
  testID: string;
}) {
  return (
    <View
      accessible
      accessibilityLabel={`${label}: ${value}`}
      accessibilityRole="text"
      style={styles.metric}
      testID={testID}
    >
      <Text allowFontScaling style={styles.metricLabel}>
        {label}
      </Text>
      <Text allowFontScaling style={styles.metricValue}>
        {value}
      </Text>
    </View>
  );
}

export function ShiftSummaryScreen(props: ShiftSummaryScreenProps) {
  return (
    <ShiftSummaryContent
      key={`shift-summary-${props.route.params.shiftId}`}
      {...props}
    />
  );
}

function ShiftSummaryContent({ navigation, route }: ShiftSummaryScreenProps) {
  const { shiftId, shiftTitle } = route.params;
  const { authenticatedRequest, user } = useAuth();
  const canAccess = user?.role === "FOREMAN" && user.company !== null;
  const [summary, setSummary] = useState<ShiftSummary | null>(null);
  const [loading, setLoading] = useState(canAccess);
  const [error, setError] = useState<SummaryLoadError | null>(null);
  const mountedRef = useRef(true);
  const focusedRef = useRef(false);
  const loadSequenceRef = useRef(0);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      focusedRef.current = false;
      loadSequenceRef.current += 1;
    };
  }, []);

  const loadSummary = useCallback(async () => {
    if (!focusedRef.current || !canAccess) return;

    const sequence = ++loadSequenceRef.current;
    const isCurrent = () =>
      mountedRef.current &&
      focusedRef.current &&
      loadSequenceRef.current === sequence;

    setLoading(true);
    setError(null);
    try {
      const nextSummary = await authenticatedRequest((token) =>
        getShiftSummary(token, shiftId)
      );
      if (!isCurrent()) return;

      if (nextSummary.shiftId !== shiftId) {
        setSummary(null);
        setError({
          message: "The returned summary does not match the requested shift.",
          notClosed: false
        });
        return;
      }

      setSummary(nextSummary);
    } catch (caughtError) {
      if (isCurrent()) {
        const notClosed = isNotClosedSummaryError(caughtError);
        if (notClosed) {
          setSummary(null);
        }
        setError({
          message: getErrorMessage(caughtError),
          notClosed
        });
      }
    } finally {
      if (isCurrent()) setLoading(false);
    }
  }, [authenticatedRequest, canAccess, shiftId]);

  useFocusEffect(
    useCallback(() => {
      focusedRef.current = true;
      if (canAccess) void loadSummary();
      return () => {
        focusedRef.current = false;
        loadSequenceRef.current += 1;
      };
    }, [canAccess, loadSummary])
  );

  if (!canAccess) {
    return (
      <Screen>
        <View style={styles.page} testID="shift-summary-access-gate">
          <ScreenHeader
            backAction={{ label: "Back", onPress: navigation.goBack }}
            eyebrow="Shift result"
            title={shiftTitle ?? `Shift #${shiftId}`}
          />
          <Feedback
            message="Only a foreman with a company can open managed shift summaries."
            mode="screen"
            title="Foreman company access required"
            tone="error"
          />
        </View>
      </Screen>
    );
  }

  const statusPresentation = summary
    ? getShiftStatusPresentation(summary.status)
    : undefined;
  const isClosed = summary?.status === "CLOSED";
  const hasForemanSummary =
    isClosed &&
    (summary.foremanWorkedMinutes !== undefined ||
      summary.foremanPauseMinutes !== undefined ||
      summary.foremanHourlyRate !== undefined ||
      summary.foremanSalary !== undefined);

  return (
    <Screen
      scroll
      scrollProps={{
        accessibilityLabel: "Shift summary results",
        testID: "shift-summary-scroll"
      }}
    >
      <View style={styles.page} testID="shift-summary-content">
        <ScreenHeader
          backAction={{ label: "Back", onPress: navigation.goBack }}
          eyebrow="Shift result"
          subtitle="Read-only backend results for approved attendance."
          title={shiftTitle ?? `Shift #${shiftId}`}
        />

        {loading && !summary ? (
          <Feedback
            loading
            message="Fetching the authoritative final totals."
            mode="screen"
            testID="shift-summary-loading"
            title="Loading summary"
          />
        ) : error && !summary ? (
          <Feedback
            action={{
              accessibilityHint: "Reloads the summary for this shift.",
              label: "Retry",
              onPress: () => {
                void loadSummary();
              },
              testID: "shift-summary-retry"
            }}
            message={error.message}
            mode="screen"
            testID="shift-summary-error"
            title={error.notClosed ? "Summary not ready" : "Summary not available"}
            tone={error.notClosed ? "neutral" : "error"}
          />
        ) : summary ? (
          <>
            {loading ? (
              <Feedback
                loading
                message="Refreshing the returned summary without changing displayed results."
                testID="shift-summary-refreshing"
                title="Refreshing summary"
              />
            ) : null}
            {error ? (
              <Feedback
                action={{
                  label: "Retry refresh",
                  onPress: () => {
                    void loadSummary();
                  }
                }}
                message={error.message}
                testID="shift-summary-refresh-error"
                title="Could not refresh summary"
                tone="error"
              />
            ) : null}

            {!isClosed ? (
              <Card testID="shift-summary-not-closed">
                <View style={styles.cardContent}>
                  <SectionHeader
                    supportingText="Final salary and pay-breakdown results are available only after the backend closes the shift."
                    title="Summary not ready"
                  />
                  {statusPresentation ? (
                    <StatusBadge
                      accessibilityLabel="Shift status"
                      label={statusPresentation.label}
                      tone={statusPresentation.tone}
                    />
                  ) : null}
                  <DetailRow label="Shift ID" value={String(summary.shiftId)} />
                </View>
              </Card>
            ) : (
              <>
                <Card testID="shift-summary-status-card">
                  <View style={styles.cardContent}>
                    <SectionHeader
                      supportingText="Final persisted results returned by the backend."
                      title="Closed shift summary"
                    />
                    {statusPresentation ? (
                      <StatusBadge
                        accessibilityLabel="Shift status"
                        label={statusPresentation.label}
                        tone={statusPresentation.tone}
                      />
                    ) : null}
                    <DetailRow label="Shift ID" value={String(summary.shiftId)} />
                  </View>
                </Card>

                <Card testID="shift-summary-worker-totals">
                  <View style={styles.cardContent}>
                    <SectionHeader
                      supportingText="Worker salary is a currency-settlement total. Base and premium are separate scale-8 audit components returned by the backend."
                      title="Worker totals"
                    />
                    <View style={styles.metricGrid}>
                      <ResultMetric
                        label="Approved workers"
                        testID="shift-summary-total-workers"
                        value={String(summary.totalWorkers)}
                      />
                      <ResultMetric
                        label="Final worker salary"
                        testID="shift-summary-total-salary"
                        value={formatMoneyWithCurrencyLabel(
                          summary.totalSalary,
                          summary.currencyLabel
                        )}
                      />
                      <ResultMetric
                        label="Base amount (audit)"
                        testID="shift-summary-total-base"
                        value={formatAuditAmount(
                          summary.totalBaseAmount,
                          summary.currencyLabel
                        )}
                      />
                      <ResultMetric
                        label="Premium amount (audit)"
                        testID="shift-summary-total-premium"
                        value={formatAuditAmount(
                          summary.totalPremiumAmount,
                          summary.currencyLabel
                        )}
                      />
                    </View>
                    <Feedback
                      message="The final worker salary may differ from the audit component sum because the backend settles each attendance separately. This screen does not calculate or hide that rounding delta."
                      testID="shift-summary-rounding-note"
                      title="Settlement and audit totals"
                    />
                  </View>
                </Card>

                {hasForemanSummary ? (
                  <Card testID="shift-summary-foreman-card">
                    <View style={styles.cardContent}>
                      <SectionHeader
                        supportingText="Private owner-foreman results returned separately from worker totals."
                        title="Foreman result"
                      />
                      {summary.foremanWorkedMinutes !== undefined ? (
                        <DetailRow
                          label="Worked time"
                          value={formatMinutes(summary.foremanWorkedMinutes)}
                        />
                      ) : null}
                      {summary.foremanPauseMinutes !== undefined ? (
                        <DetailRow
                          label="Pause time"
                          value={formatPauseMinutes(summary.foremanPauseMinutes)}
                        />
                      ) : null}
                      {summary.foremanHourlyRate !== undefined ? (
                        <DetailRow
                          label="Hourly rate"
                          value={formatMoneyWithCurrencyLabel(
                            summary.foremanHourlyRate,
                            summary.currencyLabel
                          )}
                        />
                      ) : null}
                      {summary.foremanSalary !== undefined ? (
                        <DetailRow
                          label="Final salary"
                          value={formatMoneyWithCurrencyLabel(
                            summary.foremanSalary,
                            summary.currencyLabel
                          )}
                        />
                      ) : null}
                    </View>
                  </Card>
                ) : null}

                <View style={styles.section} testID="shift-summary-workers">
                  <SectionHeader
                    supportingText="Backend-approved attendance rows in returned order."
                    title="Worker results"
                  />
                  {summary.workers.length === 0 ? (
                    <Feedback
                      message="The backend returned no approved worker rows for this closed shift."
                      mode="screen"
                      testID="shift-summary-workers-empty"
                      title="No approved workers"
                    />
                  ) : (
                    <View style={styles.list}>
                      {summary.workers.map((worker) => (
                        <Card
                          key={worker.attendanceId}
                          testID={`shift-summary-worker-${worker.attendanceId}`}
                        >
                          <View style={styles.cardContent}>
                            <View style={styles.workerHeader}>
                              <View style={styles.workerCopy}>
                                <Text allowFontScaling style={styles.workerName}>
                                  {worker.firstName} {worker.lastName}
                                </Text>
                                <Text allowFontScaling style={styles.workerMeta}>
                                  Worker #{worker.workerId}
                                </Text>
                              </View>
                              <StatusBadge label="Approved result" tone="success" />
                            </View>
                            <View style={styles.rows}>
                              <DetailRow
                                label="Worked time"
                                value={formatMinutes(worker.workedMinutes)}
                              />
                              {worker.pauseMinutes !== undefined ? (
                                <DetailRow
                                  label="Pause time"
                                  value={formatPauseMinutes(worker.pauseMinutes)}
                                />
                              ) : null}
                              <DetailRow
                                label="Hourly rate"
                                value={formatMoneyWithCurrencyLabel(
                                  worker.hourlyRate,
                                  summary.currencyLabel
                                )}
                              />
                              <DetailRow
                                label="Final salary"
                                value={formatMoneyWithCurrencyLabel(
                                  worker.salary,
                                  summary.currencyLabel
                                )}
                              />
                            </View>

                            {worker.payCalculation ? (
                              <PayCalculationBreakdown
                                calculation={worker.payCalculation}
                                currencyLabel={summary.currencyLabel}
                              />
                            ) : (
                              <Feedback
                                message="No calculation snapshot was returned. The worker's stored final salary and backend fallback totals remain authoritative; no detailed breakdown was reconstructed."
                                testID={`shift-summary-breakdown-absent-${worker.attendanceId}`}
                                title="Historical breakdown unavailable"
                              />
                            )}
                          </View>
                        </Card>
                      ))}
                    </View>
                  )}
                </View>
              </>
            )}
          </>
        ) : (
          <Feedback
            action={{ label: "Retry", onPress: () => void loadSummary() }}
            message="No authoritative summary response is available."
            mode="screen"
            title="No summary"
          />
        )}
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  page: {
    flex: 1,
    gap: theme.gap.section
  },
  cardContent: {
    width: "100%",
    gap: theme.space[3]
  },
  metricGrid: {
    width: "100%",
    flexDirection: "row",
    flexWrap: "wrap",
    gap: theme.space[2]
  },
  metric: {
    minWidth: 132,
    flexGrow: 1,
    flexBasis: "46%",
    flexShrink: 1,
    gap: theme.space[1],
    borderRadius: theme.radius.md,
    borderWidth: theme.border.default,
    borderColor: theme.colors.border,
    backgroundColor: theme.colors.surface.subtle,
    padding: theme.space[3]
  },
  metricLabel: {
    ...theme.typography.caption,
    color: theme.colors.ink.secondary,
    flexShrink: 1
  },
  metricValue: {
    ...theme.typography.cardTitle,
    color: theme.colors.ink.primary,
    flexShrink: 1
  },
  section: {
    width: "100%",
    gap: theme.space[3]
  },
  list: {
    width: "100%",
    gap: theme.space[3]
  },
  workerHeader: {
    width: "100%",
    flexDirection: "row",
    flexWrap: "wrap",
    alignItems: "flex-start",
    gap: theme.space[3]
  },
  workerCopy: {
    minWidth: theme.target.min,
    flexGrow: 1,
    flexShrink: 1,
    gap: theme.space[1]
  },
  workerName: {
    ...theme.typography.cardTitle,
    color: theme.colors.ink.primary,
    flexShrink: 1
  },
  workerMeta: {
    ...theme.typography.caption,
    color: theme.colors.ink.secondary,
    flexShrink: 1
  },
  rows: {
    width: "100%",
    borderTopWidth: theme.border.default,
    borderTopColor: theme.colors.border,
    paddingTop: theme.space[2]
  }
});
