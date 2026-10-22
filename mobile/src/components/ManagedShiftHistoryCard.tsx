import { useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import type { ManagedShift } from "../types/shifts";
import {
  formatDateTime,
  formatMoneyWithCurrencyLabel,
  formatMinutes
} from "../utils/format";
import { getShiftStatusPresentation } from "../utils/status";
import { theme } from "../utils/theme";
import { Button } from "./Button";
import { Card } from "./Card";
import { DetailRow } from "./DetailRow";
import { StatusBadge } from "./StatusBadge";

type ManagedShiftHistoryCardProps = {
  shift: ManagedShift;
  onFullView: () => void;
};

function ChevronIcon({ expanded }: { expanded: boolean }) {
  // Keep native icon loading on the rendered card path, not route registration.
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { AppIcon } = require("./AppIcon") as typeof import("./AppIcon");
  return (
    <AppIcon
      name={expanded ? "chevronUp" : "chevronDown"}
      tone="secondary"
    />
  );
}

function returnedRate(value: number | null | undefined, currencyLabel: string | null) {
  return value == null
    ? "Unavailable"
    : formatMoneyWithCurrencyLabel(value, currencyLabel);
}

export function ManagedShiftHistoryCard({
  shift,
  onFullView
}: ManagedShiftHistoryCardProps) {
  const [expanded, setExpanded] = useState(false);
  const status = getShiftStatusPresentation(shift.status);

  return (
    <Card testID={`managed-shift-history-card-${shift.id}`}>
      <View style={styles.content}>
        <View style={styles.header}>
          <View style={styles.headingText}>
            <Text style={styles.title}>{shift.title}</Text>
            {status ? <StatusBadge label={status.label} tone={status.tone} /> : null}
          </View>
          <Pressable
            accessibilityLabel={`${expanded ? "Collapse" : "Expand"} details for ${shift.title}`}
            accessibilityRole="button"
            accessibilityState={{ expanded }}
            hitSlop={0}
            onPress={() => {
              setExpanded((current) => !current);
            }}
            style={({ pressed }) => [styles.chevron, pressed && styles.chevronPressed]}
            testID={`managed-shift-expand-${shift.id}`}
          >
            <ChevronIcon expanded={expanded} />
          </Pressable>
        </View>

        {expanded ? (
          <View style={styles.details} testID={`managed-shift-details-${shift.id}`}>
            <DetailRow label="Company" value={shift.companyName} />
            {shift.location ? <DetailRow label="Location" value={shift.location} /> : null}
            {status ? <DetailRow label="Status" value={status.label} /> : null}
            <DetailRow label="Join code" value={shift.joinCode} />
            {shift.actualStartTime ? (
              <DetailRow
                label="Actual start"
                value={formatDateTime(shift.actualStartTime)}
              />
            ) : null}
            {shift.actualEndTime ? (
              <DetailRow
                label="Actual end"
                value={formatDateTime(shift.actualEndTime)}
              />
            ) : null}
            <DetailRow
              label="Default break"
              value={`${shift.defaultBreakMinutes} min`}
            />
            <DetailRow
              label="Worker default rate"
              value={returnedRate(shift.defaultHourlyRate, shift.currencyLabel)}
            />
            {shift.foremanHourlyRate !== undefined ? (
              <DetailRow
                label="Foreman rate"
                value={returnedRate(shift.foremanHourlyRate, shift.currencyLabel)}
              />
            ) : null}
            <DetailRow
              label="Currency label"
              value={shift.currencyLabel ?? "Unavailable"}
            />
            {shift.pauseState ? (
              <>
                <DetailRow
                  label="Personal pause"
                  value={shift.pauseState.personallyPaused ? "Active" : "Inactive"}
                />
                {shift.pauseState.personalPauseStartedAt ? (
                  <DetailRow
                    label="Personal pause started"
                    value={formatDateTime(shift.pauseState.personalPauseStartedAt)}
                  />
                ) : null}
                <DetailRow
                  label="Crew pause"
                  value={shift.pauseState.allPaused ? "Active" : "Inactive"}
                />
                {shift.pauseState.allPauseStartedAt ? (
                  <DetailRow
                    label="Crew pause started"
                    value={formatDateTime(shift.pauseState.allPauseStartedAt)}
                  />
                ) : null}
                {shift.pauseState.effectivePauseMinutes !== null ? (
                  <DetailRow
                    label="Effective pause"
                    value={formatMinutes(shift.pauseState.effectivePauseMinutes)}
                  />
                ) : null}
              </>
            ) : null}
          </View>
        ) : null}

        <Button
          label="Full view"
          onPress={onFullView}
          trailingIcon="forward"
          variant="secondary"
        />
      </View>
    </Card>
  );
}

const styles = StyleSheet.create({
  content: {
    gap: theme.space[3]
  },
  header: {
    alignItems: "flex-start",
    flexDirection: "row",
    gap: theme.space[3]
  },
  headingText: {
    alignItems: "flex-start",
    flex: 1,
    gap: theme.space[2]
  },
  title: {
    ...theme.typography.cardTitle,
    color: theme.colors.ink.primary,
    flexShrink: 1
  },
  chevron: {
    alignItems: "center",
    borderRadius: theme.radius.sm,
    justifyContent: "center",
    minHeight: theme.target.min,
    minWidth: theme.target.min
  },
  chevronPressed: {
    backgroundColor: theme.colors.surface.subtle
  },
  details: {
    borderTopColor: theme.colors.border,
    borderTopWidth: theme.border.default,
    paddingTop: theme.space[2]
  }
});
