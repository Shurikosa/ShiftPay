import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import { useFocusEffect } from "@react-navigation/native";
import { useCallback, useRef, useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import {
  approveManagedPayoutRequest,
  getManagedPayoutRequests
} from "../api/payroll";
import { Button } from "../components/Button";
import { PayoutRequestCard } from "../components/PayoutRequestCard";
import { Screen } from "../components/Screen";
import { StateMessage } from "../components/StateMessage";
import { useAuth } from "../context/AuthContext";
import type { ForemanStackParamList } from "../types/navigation";
import type { PayoutRequest, PayoutRequestStatus } from "../types/payroll";
import { getErrorMessage } from "../api/errors";
import { formatStatusLabel } from "../utils/status";
import { colors, spacing, typography } from "../utils/theme";

type ForemanPayrollRequestsScreenProps = NativeStackScreenProps<
  ForemanStackParamList,
  "ForemanPayrollRequests"
>;

type MutationState =
  | {
      type: "refresh";
    }
  | {
      type: "approve";
      requestId: number;
    };

function formatApproveError(error: unknown): string {
  const message = getErrorMessage(error);

  if (message.toLowerCase().includes("pending")) {
    return `${message}. Refresh the request list to see the latest state.`;
  }

  if (message.toLowerCase().includes("forbidden")) {
    return "You are not authorized to approve this payout request.";
  }

  if (message.toLowerCase().includes("payment requested")) {
    return `${message}. Refresh the request list before approving again.`;
  }

  return message;
}

export function ForemanPayrollRequestsScreen({
  navigation
}: ForemanPayrollRequestsScreenProps) {
  const { authenticatedRequest, user } = useAuth();
  const [requests, setRequests] = useState<PayoutRequest[]>([]);
  const [statusFilter, setStatusFilter] = useState<PayoutRequestStatus>("PENDING");
  const [loading, setLoading] = useState(true);
  const [mutation, setMutation] = useState<MutationState | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const mutationInFlightRef = useRef(false);

  const companyName = user?.company?.name ?? "Company not assigned";

  const loadRequests = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const nextRequests = await authenticatedRequest((token) =>
        getManagedPayoutRequests(token, statusFilter)
      );
      setRequests(nextRequests);
    } catch (caughtError) {
      setError(getErrorMessage(caughtError));
    } finally {
      setLoading(false);
    }
  }, [authenticatedRequest, statusFilter]);

  useFocusEffect(
    useCallback(() => {
      void loadRequests();
      return undefined;
    }, [loadRequests])
  );

  const beginMutation = (nextMutation: MutationState): boolean => {
    if (mutationInFlightRef.current) {
      return false;
    }

    mutationInFlightRef.current = true;
    setMutation(nextMutation);
    return true;
  };

  const finishMutation = () => {
    mutationInFlightRef.current = false;
    setMutation(null);
  };

  const handleRefresh = () => {
    if (!beginMutation({ type: "refresh" })) {
      return;
    }

    setSuccessMessage(null);

    void loadRequests().finally(() => {
      finishMutation();
    });
  };

  const handleApprove = (requestId: number) => {
    if (!beginMutation({ type: "approve", requestId })) {
      return;
    }

    setError(null);
    setSuccessMessage(null);

    void authenticatedRequest(async (token) => {
      const approvedRequest = await approveManagedPayoutRequest(token, requestId);
      const approvedRequests = await getManagedPayoutRequests(token, "APPROVED");

      return {
        approvedRequest,
        approvedRequests
      };
    })
      .then(({ approvedRequest, approvedRequests }) => {
        setStatusFilter("APPROVED");
        setRequests(approvedRequests);
        setSuccessMessage("Payout request approved.");
        if (!approvedRequests.some((request) => request.id === approvedRequest.id)) {
          setRequests([approvedRequest, ...approvedRequests]);
        }
      })
      .catch((caughtError) => {
        setError(formatApproveError(caughtError));
      })
      .finally(() => {
        finishMutation();
      });
  };

  const handleSetStatusFilter = (nextStatusFilter: PayoutRequestStatus) => {
    if (nextStatusFilter === statusFilter || mutationInFlightRef.current) {
      return;
    }

    setStatusFilter(nextStatusFilter);
    setSuccessMessage(null);
  };

  const isMutating = mutation !== null;

  return (
    <Screen>
      <View style={styles.container}>
        <View style={styles.header}>
          <Text style={styles.kicker}>Foreman payroll</Text>
          <Text style={styles.title}>Payroll requests</Text>
          <Text style={styles.subtitle}>{companyName}</Text>
        </View>

        {successMessage ? (
          <StateMessage title="Updated" message={successMessage} tone="success" />
        ) : null}
        {error ? <StateMessage title="Payroll action failed" message={error} tone="error" /> : null}

        <View style={styles.filterRow}>
          <Button
            disabled={statusFilter === "PENDING" || isMutating}
            label="Pending"
            onPress={() => {
              handleSetStatusFilter("PENDING");
            }}
            variant={statusFilter === "PENDING" ? "primary" : "secondary"}
            style={styles.filterButton}
          />
          <Button
            disabled={statusFilter === "APPROVED" || isMutating}
            label="Approved"
            onPress={() => {
              handleSetStatusFilter("APPROVED");
            }}
            variant={statusFilter === "APPROVED" ? "primary" : "secondary"}
            style={styles.filterButton}
          />
        </View>

        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>
              {formatStatusLabel(statusFilter)} requests
            </Text>
            <Button
              disabled={isMutating || loading}
              label="Refresh"
              loading={mutation?.type === "refresh"}
              onPress={handleRefresh}
              variant="ghost"
            />
          </View>

          {loading ? (
            <StateMessage loading title="Loading requests" message="Fetching payout requests." />
          ) : requests.length === 0 ? (
            <StateMessage
              title={`No ${formatStatusLabel(statusFilter).toLowerCase()} requests`}
              message="Worker payout requests for your managed shifts will appear here."
            />
          ) : (
            <View style={styles.list}>
              {requests.map((request) => (
                <PayoutRequestCard
                  action={
                    request.status === "PENDING" ? (
                      <Button
                        disabled={isMutating}
                        label="Approve"
                        loading={
                          mutation?.type === "approve" &&
                          mutation.requestId === request.id
                        }
                        onPress={() => {
                          handleApprove(request.id);
                        }}
                      />
                    ) : null
                  }
                  key={request.id}
                  request={request}
                  showWorker
                />
              ))}
            </View>
          )}
        </View>

        <Button
          label="Back to dashboard"
          onPress={() => {
            navigation.goBack();
          }}
          variant="ghost"
        />
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    gap: spacing.xl
  },
  header: {
    gap: spacing.sm
  },
  kicker: {
    ...typography.label,
    color: colors.primary
  },
  title: {
    ...typography.screenTitle,
    color: colors.text
  },
  subtitle: {
    ...typography.body,
    color: colors.textSecondary
  },
  filterRow: {
    flexDirection: "row",
    gap: spacing.md
  },
  filterButton: {
    flex: 1
  },
  section: {
    gap: spacing.md
  },
  sectionHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: spacing.md
  },
  sectionTitle: {
    ...typography.sectionTitle,
    color: colors.text
  },
  list: {
    gap: spacing.md
  }
});
