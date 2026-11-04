import type { BottomTabScreenProps } from "@react-navigation/bottom-tabs";
import type { CompositeScreenProps } from "@react-navigation/native";
import { useFocusEffect } from "@react-navigation/native";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { RefreshControl, StyleSheet, View } from "react-native";
import { ApiError, getErrorMessage } from "../api/errors";
import { approveManagedPayoutRequest, getManagedPayoutRequests } from "../api/payroll";
import { Button } from "../components/Button";
import { EmptyState } from "../components/EmptyState";
import { Feedback } from "../components/Feedback";
import { PayoutRequestCard } from "../components/PayoutRequestCard";
import { Screen } from "../components/Screen";
import { ScreenHeader } from "../components/ScreenHeader";
import { SectionHeader } from "../components/SectionHeader";
import { SegmentedControl } from "../components/SegmentedControl";
import { useAuth } from "../context/AuthContext";
import type { ForemanStackParamList, ForemanTabParamList } from "../types/navigation";
import type { PayoutRequest, PayoutRequestStatus } from "../types/payroll";
import { theme } from "../utils/theme";

type ForemanPayrollRequestsScreenProps = CompositeScreenProps<
  BottomTabScreenProps<ForemanTabParamList, "ForemanPayrollRequests">,
  NativeStackScreenProps<ForemanStackParamList>
>;

type ForemanPayrollRequestsContentProps = ForemanPayrollRequestsScreenProps & {
  auth: ReturnType<typeof useAuth>;
};

type MutationState =
  | { type: "refresh" }
  | { type: "approve"; requestId: number };

type ActiveLoad = {
  generation: number;
  status: PayoutRequestStatus;
  promise: Promise<boolean>;
};

type MutationOwner = {
  mutation: MutationState;
  token: number;
};

type ApproveBlockReason = "inFlight" | "confirmed" | "conflict";

type ApproveBlockOwner = {
  reason: ApproveBlockReason;
  scope: string;
  token: number;
};

const statusOptions = [
  {
    accessibilityHint: "Shows payout requests that can still be approved.",
    label: "Pending",
    testID: "foreman-payroll-segment-pending",
    value: "PENDING"
  },
  {
    accessibilityHint: "Shows payout requests already approved by the backend.",
    label: "Approved",
    testID: "foreman-payroll-segment-approved",
    value: "APPROVED"
  }
] as const;

function formatApproveError(error: unknown): string {
  if (error instanceof ApiError && error.status === 409) {
    return "This request could not be approved because its backend state changed. The managed list has been refreshed.";
  }

  const message = getErrorMessage(error);
  if (message.toLowerCase().includes("forbidden")) {
    return "You are not authorized to approve this payout request.";
  }

  return message;
}

function getStatusLabel(status: PayoutRequestStatus): string {
  return status === "PENDING" ? "Pending" : "Approved";
}

export function ForemanPayrollRequestsScreen(props: ForemanPayrollRequestsScreenProps) {
  const auth = useAuth();
  const scopeKey = [
    auth.user?.id ?? "anonymous",
    auth.user?.company?.id ?? "no-company",
    auth.user?.role ?? "no-role"
  ].join(":");

  return (
    <ForemanPayrollRequestsContent
      {...props}
      auth={auth}
      key={`foreman-payroll:${scopeKey}`}
    />
  );
}

function ForemanPayrollRequestsContent({
  auth,
  navigation
}: ForemanPayrollRequestsContentProps) {
  const { authenticatedRequest, user } = auth;
  const canAccess = user?.role === "FOREMAN" && user.company !== null;
  const company = canAccess ? user.company : null;
  const accessScope = canAccess && company ? `${user.id}:${company.id}` : null;

  const [requests, setRequests] = useState<PayoutRequest[]>([]);
  const [publishedStatus, setPublishedStatus] = useState<PayoutRequestStatus | null>(null);
  const [publishedScope, setPublishedScope] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<PayoutRequestStatus>("PENDING");
  const [initialLoading, setInitialLoading] = useState(canAccess);
  const [refreshing, setRefreshing] = useState(false);
  const [mutation, setMutation] = useState<MutationState | null>(null);
  const [initialError, setInitialError] = useState<string | null>(null);
  const [refreshError, setRefreshError] = useState<string | null>(null);
  const [approveError, setApproveError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [blockedRequestIds, setBlockedRequestIds] = useState<ReadonlySet<number>>(
    () => new Set()
  );

  const mountedRef = useRef(true);
  const focusedRef = useRef(false);
  const canAccessRef = useRef(canAccess);
  const statusFilterRef = useRef<PayoutRequestStatus>("PENDING");
  const requestsRef = useRef<PayoutRequest[]>([]);
  const publishedStatusRef = useRef<PayoutRequestStatus | null>(null);
  const publishedScopeRef = useRef<string | null>(null);
  const accessScopeRef = useRef(accessScope);
  const previousAccessScopeRef = useRef(accessScope);
  const blockedRequestOwnersRef = useRef(new Map<number, ApproveBlockOwner>());
  const revalidationRequestOwnersRef = useRef(new Map<number, number>());
  const loadGenerationRef = useRef(0);
  const actionGenerationRef = useRef(0);
  const mutationTokenRef = useRef(0);
  const activeLoadRef = useRef<ActiveLoad | null>(null);
  const mutationOwnerRef = useRef<MutationOwner | null>(null);

  useLayoutEffect(() => {
    accessScopeRef.current = accessScope;
  }, [accessScope]);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      focusedRef.current = false;
      loadGenerationRef.current += 1;
      actionGenerationRef.current += 1;
      activeLoadRef.current = null;
      mutationOwnerRef.current = null;
    };
  }, []);

  useEffect(() => {
    const scopeChanged = previousAccessScopeRef.current !== accessScope;
    previousAccessScopeRef.current = accessScope;
    canAccessRef.current = canAccess;
    if (!canAccess || scopeChanged) {
      loadGenerationRef.current += 1;
      actionGenerationRef.current += 1;
      activeLoadRef.current = null;
      mutationOwnerRef.current = null;
      requestsRef.current = [];
      publishedStatusRef.current = null;
      publishedScopeRef.current = null;
      blockedRequestOwnersRef.current.clear();
      revalidationRequestOwnersRef.current.clear();
      setRequests([]);
      setPublishedStatus(null);
      setPublishedScope(null);
      setMutation(null);
      setBlockedRequestIds(new Set());
      setInitialError(null);
      setRefreshError(null);
      setApproveError(null);
      setSuccessMessage(null);
      setInitialLoading(canAccess);
      setRefreshing(false);
    }
  }, [accessScope, canAccess]);

  const publishDisabledRequestIds = useCallback(() => {
    if (mountedRef.current) {
      setBlockedRequestIds(
        new Set([
          ...blockedRequestOwnersRef.current.keys(),
          ...revalidationRequestOwnersRef.current.keys()
        ])
      );
    }
  }, []);

  const reconcileApproveGuards = useCallback(
    (targetStatus: PayoutRequestStatus, nextRequests: readonly PayoutRequest[]) => {
      if (targetStatus !== "PENDING" && targetStatus !== "APPROVED") return;

      let changed = false;
      for (const [requestId, owner] of blockedRequestOwnersRef.current) {
        if (owner.scope !== accessScopeRef.current) continue;
        if (owner.reason === "confirmed") {
          blockedRequestOwnersRef.current.delete(requestId);
          changed = true;
        } else if (
          owner.reason === "conflict" &&
          targetStatus === "PENDING" &&
          !nextRequests.some((request) => request.id === requestId)
        ) {
          blockedRequestOwnersRef.current.delete(requestId);
          changed = true;
        }
      }

      if (targetStatus === "PENDING") {
        for (const requestId of revalidationRequestOwnersRef.current.keys()) {
          revalidationRequestOwnersRef.current.delete(requestId);
          changed = true;
        }
      }

      if (changed) publishDisabledRequestIds();
    },
    [publishDisabledRequestIds]
  );

  const loadRequests = useCallback((
    targetStatus: PayoutRequestStatus,
    options: { force?: boolean } = {}
  ): Promise<boolean> => {
    const requestScope = accessScopeRef.current;
    if (!focusedRef.current || !canAccessRef.current || requestScope === null) {
      return Promise.resolve(false);
    }

    const activeLoad = activeLoadRef.current;
    if (
      options.force !== true &&
      activeLoad &&
      activeLoad.status === targetStatus &&
      activeLoad.generation === loadGenerationRef.current
    ) {
      return activeLoad.promise;
    }

    const generation = loadGenerationRef.current + 1;
    loadGenerationRef.current = generation;
    const hasUsableData =
      publishedStatusRef.current === targetStatus &&
      publishedScopeRef.current === requestScope;

    if (hasUsableData) {
      setRefreshing(true);
      setRefreshError(null);
    } else {
      setInitialLoading(true);
      setInitialError(null);
    }

    const isCurrent = () =>
      mountedRef.current &&
      focusedRef.current &&
      canAccessRef.current &&
      accessScopeRef.current === requestScope &&
      generation === loadGenerationRef.current &&
      statusFilterRef.current === targetStatus;

    const promise = authenticatedRequest((token) =>
      getManagedPayoutRequests(token, targetStatus)
    )
      .then((nextRequests) => {
        if (!isCurrent()) return false;

        requestsRef.current = nextRequests;
        publishedStatusRef.current = targetStatus;
        publishedScopeRef.current = requestScope;
        setRequests(nextRequests);
        setPublishedStatus(targetStatus);
        setPublishedScope(requestScope);
        setInitialError(null);
        setRefreshError(null);
        reconcileApproveGuards(targetStatus, nextRequests);
        return true;
      })
      .catch((caughtError: unknown) => {
        if (!isCurrent()) return false;

        const message = getErrorMessage(caughtError);
        if (hasUsableData) {
          setRefreshError(message);
        } else {
          setInitialError(message);
        }
        return false;
      })
      .finally(() => {
        if (isCurrent()) {
          setInitialLoading(false);
          setRefreshing(false);
        }
        if (activeLoadRef.current?.generation === generation) {
          activeLoadRef.current = null;
        }
      });

    activeLoadRef.current = { generation, promise, status: targetStatus };
    return promise;
  }, [authenticatedRequest, reconcileApproveGuards]);

  useFocusEffect(
    useCallback(() => {
      focusedRef.current = true;
      setMutation(mutationOwnerRef.current?.mutation ?? null);
      publishDisabledRequestIds();
      if (canAccess && accessScope !== null) {
        void loadRequests(statusFilterRef.current);
      }

      return () => {
        focusedRef.current = false;
        loadGenerationRef.current += 1;
        actionGenerationRef.current += 1;
        activeLoadRef.current = null;
      };
    }, [accessScope, canAccess, loadRequests, publishDisabledRequestIds])
  );

  const beginMutation = (nextMutation: MutationState): number | null => {
    if (mutationOwnerRef.current) return null;

    const token = mutationTokenRef.current + 1;
    mutationTokenRef.current = token;
    mutationOwnerRef.current = { mutation: nextMutation, token };
    setMutation(nextMutation);
    return token;
  };

  const finishMutation = (token: number) => {
    if (mutationOwnerRef.current?.token !== token) return;

    mutationOwnerRef.current = null;
    if (mountedRef.current && focusedRef.current) setMutation(null);
  };

  const handleRefresh = () => {
    if (!canAccessRef.current) return;
    const token = beginMutation({ type: "refresh" });
    if (token === null) return;

    setApproveError(null);
    setSuccessMessage(null);
    void loadRequests(statusFilterRef.current).finally(() => finishMutation(token));
  };

  const handleApprove = (requestId: number) => {
    const currentRequest = requestsRef.current.find((request) => request.id === requestId);
    if (
      !mountedRef.current ||
      !focusedRef.current ||
      !canAccessRef.current ||
      statusFilterRef.current !== "PENDING" ||
      publishedStatusRef.current !== "PENDING" ||
      currentRequest?.status !== "PENDING" ||
      blockedRequestOwnersRef.current.has(requestId) ||
      revalidationRequestOwnersRef.current.has(requestId) ||
      activeLoadRef.current !== null
    ) {
      return;
    }

    const token = beginMutation({ type: "approve", requestId });
    if (token === null || accessScopeRef.current === null) return;

    const operationScope = accessScopeRef.current;
    blockedRequestOwnersRef.current.set(requestId, {
      reason: "inFlight",
      scope: operationScope,
      token
    });
    publishDisabledRequestIds();
    const generation = actionGenerationRef.current + 1;
    actionGenerationRef.current = generation;
    setApproveError(null);
    setRefreshError(null);
    setSuccessMessage(null);

    void authenticatedRequest((token) => approveManagedPayoutRequest(token, requestId))
      .then(async () => {
        const blockOwner = blockedRequestOwnersRef.current.get(requestId);
        const ownsBlock =
          blockOwner?.token === token && blockOwner.scope === operationScope;
        if (ownsBlock) {
          blockedRequestOwnersRef.current.set(requestId, {
            ...blockOwner,
            reason: "confirmed"
          });
        }

        if (
          !mountedRef.current ||
          !canAccessRef.current ||
          accessScopeRef.current !== operationScope
        ) {
          return;
        }

        if (!focusedRef.current || generation !== actionGenerationRef.current) {
          if (focusedRef.current && ownsBlock) {
            await loadRequests(statusFilterRef.current, { force: true });
          }
          return;
        }

        statusFilterRef.current = "APPROVED";
        setStatusFilter("APPROVED");
        setSuccessMessage("Payout request approved.");
        await loadRequests("APPROVED");
      })
      .catch(async (caughtError: unknown) => {
        const blockOwner = blockedRequestOwnersRef.current.get(requestId);
        const ownsBlock =
          blockOwner?.token === token && blockOwner.scope === operationScope;
        const isConflict = caughtError instanceof ApiError && caughtError.status === 409;
        const isCurrentFocus =
          mountedRef.current &&
          focusedRef.current &&
          canAccessRef.current &&
          accessScopeRef.current === operationScope &&
          generation === actionGenerationRef.current;

        if (ownsBlock) {
          if (isConflict) {
            blockedRequestOwnersRef.current.set(requestId, {
              ...blockOwner,
              reason: "conflict"
            });
          } else {
            blockedRequestOwnersRef.current.delete(requestId);
            if (
              mountedRef.current &&
              canAccessRef.current &&
              accessScopeRef.current === operationScope &&
              !isCurrentFocus
            ) {
              revalidationRequestOwnersRef.current.set(requestId, token);
            }
          }
        }

        if (
          !mountedRef.current ||
          !canAccessRef.current ||
          accessScopeRef.current !== operationScope
        ) {
          return;
        }

        if (focusedRef.current) publishDisabledRequestIds();
        if (!isCurrentFocus) {
          if (focusedRef.current && ownsBlock) {
            await loadRequests("PENDING", { force: true });
          }
          return;
        }

        setApproveError(formatApproveError(caughtError));
        if (isConflict) {
          await loadRequests("PENDING");
        }
      })
      .finally(() => finishMutation(token));
  };

  const handleSetStatusFilter = (nextStatusFilter: PayoutRequestStatus) => {
    if (
      nextStatusFilter === statusFilterRef.current ||
      mutationOwnerRef.current !== null ||
      !canAccessRef.current
    ) {
      return;
    }

    statusFilterRef.current = nextStatusFilter;
    setStatusFilter(nextStatusFilter);
    setApproveError(null);
    setSuccessMessage(null);
    setInitialError(null);
    setRefreshError(null);
    void loadRequests(nextStatusFilter);
  };

  if (!canAccess || !company) {
    return (
      <Screen>
        <View style={styles.page} testID="foreman-payroll-access-gate">
          <ScreenHeader
            eyebrow="Foreman payroll"
            title="Payroll requests"
          />
          <Feedback
            message="Only a foreman with a company can review managed payout requests."
            mode="screen"
            title="Foreman company access required"
            tone="error"
          />
          <Button
            label="Back to dashboard"
            onPress={() => navigation.navigate("ForemanDashboard")}
            testID="foreman-payroll-back-dashboard"
            variant="ghost"
          />
        </View>
      </Screen>
    );
  }

  const isMutating = mutation !== null;
  const visibleRequests =
    publishedStatus === statusFilter && publishedScope === accessScope ? requests : [];
  const hasUsableData =
    publishedStatus === statusFilter && publishedScope === accessScope;

  return (
    <Screen
      scroll
      scrollProps={{
        accessibilityLabel: "Managed payroll requests",
        refreshControl: (
          <RefreshControl
            enabled={!isMutating}
            onRefresh={handleRefresh}
            refreshing={refreshing || mutation?.type === "refresh"}
          />
        ),
        testID: "foreman-payroll-scroll"
      }}
    >
      <View style={styles.page} testID="foreman-payroll-content">
        <ScreenHeader
          eyebrow="Foreman payroll"
          subtitle={`${company.name} · Review backend payout requests without changing their calculated totals.`}
          title="Payroll requests"
        />

        <SegmentedControl<PayoutRequestStatus>
          accessibilityHint="Choose pending or approved managed payout requests."
          accessibilityLabel="Payroll request status"
          disabled={isMutating}
          onChange={handleSetStatusFilter}
          options={statusOptions}
          testID="foreman-payroll-status-segments"
          value={statusFilter}
        />

        {successMessage ? (
          <Feedback
            message={successMessage}
            testID="foreman-payroll-success"
            title="Request updated"
            tone="success"
          />
        ) : null}
        {approveError ? (
          <Feedback
            message={approveError}
            testID="foreman-payroll-approve-error"
            title="Could not approve request"
            tone="error"
          />
        ) : null}
        {refreshError ? (
          <Feedback
            action={{
              disabled: isMutating,
              label: "Retry refresh",
              onPress: handleRefresh,
              testID: "foreman-payroll-refresh-retry"
            }}
            message={refreshError}
            testID="foreman-payroll-refresh-error"
            title="Could not refresh requests"
            tone="error"
          />
        ) : null}

        <View style={styles.section}>
          <SectionHeader
            action={{
              disabled: isMutating || initialLoading,
              icon: "refresh",
              label: "Refresh",
              onPress: handleRefresh
            }}
            supportingText={
              statusFilter === "PENDING"
                ? "Approve only requests that the backend still reports as pending."
                : "Approved requests remain read-only in this list."
            }
            title={`${getStatusLabel(statusFilter)} requests`}
          />

          {initialLoading && !hasUsableData ? (
            <Feedback
              loading
              message={`Fetching ${getStatusLabel(statusFilter).toLowerCase()} managed payout requests.`}
              mode="screen"
              testID="foreman-payroll-loading"
              title="Loading requests"
            />
          ) : initialError && !hasUsableData ? (
            <Feedback
              action={{
                disabled: isMutating,
                label: "Retry",
                onPress: handleRefresh,
                testID: "foreman-payroll-initial-retry"
              }}
              message={initialError}
              mode="screen"
              testID="foreman-payroll-initial-error"
              title="Could not load requests"
              tone="error"
            />
          ) : visibleRequests.length === 0 ? (
            <EmptyState
              message="Worker payout requests for your managed shifts will appear here."
              testID={`foreman-payroll-empty-${statusFilter.toLowerCase()}`}
              title={`No ${getStatusLabel(statusFilter).toLowerCase()} requests`}
            />
          ) : (
            <View style={styles.list} testID="foreman-payroll-list">
              {visibleRequests.map((request) => {
                const approveBlocked = blockedRequestIds.has(request.id);
                return (
                  <PayoutRequestCard
                    action={
                      request.status === "PENDING" ? (
                        <Button
                          accessibilityHint={`Approves payout request ${request.id} using backend totals.`}
                          accessibilityLabel={`Approve payout request ${request.id}`}
                          disabled={isMutating || approveBlocked}
                          label="Approve"
                          loading={
                            mutation?.type === "approve" && mutation.requestId === request.id
                          }
                          onPress={() => handleApprove(request.id)}
                          testID={`foreman-payroll-approve-${request.id}`}
                        />
                      ) : null
                    }
                    key={request.id}
                    request={request}
                    showWorker
                    timeZone={company.timeZone}
                  />
                );
              })}
            </View>
          )}
        </View>

        <Button
          label="Back to dashboard"
          onPress={() => navigation.navigate("ForemanDashboard")}
          testID="foreman-payroll-back-dashboard"
          variant="ghost"
        />
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  page: {
    flex: 1,
    gap: theme.gap.section
  },
  section: {
    gap: theme.space[4]
  },
  list: {
    gap: theme.space[4]
  }
});
