import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import { StyleSheet, Text, View } from "react-native";
import { Button } from "../components/Button";
import { DetailRow } from "../components/DetailRow";
import { Screen } from "../components/Screen";
import { StatusBadge } from "../components/StatusBadge";
import type { WorkerStackParamList } from "../types/navigation";
import {
  formatDateTime,
  formatMoney,
  formatMinutes,
  formatOptionalLocation,
  formatRate
} from "../utils/format";
import { getAttendanceStatusTone, getShiftStatusTone } from "../utils/status";
import { colors, radii, spacing, typography } from "../utils/theme";

type WorkerShiftDetailsScreenProps = NativeStackScreenProps<
  WorkerStackParamList,
  "WorkerShiftDetails"
>;

export function WorkerShiftDetailsScreen({
  navigation,
  route
}: WorkerShiftDetailsScreenProps) {
  const { shift } = route.params;

  return (
    <Screen>
      <View style={styles.container}>
        <View style={styles.header}>
          <Text style={styles.kicker}>Shift details</Text>
          <Text style={styles.title}>{shift.title}</Text>
          <Text style={styles.subtitle}>{formatOptionalLocation(shift.location)}</Text>
        </View>

        <View style={styles.badges}>
          <StatusBadge label={shift.status} tone={getShiftStatusTone(shift.status)} />
          <StatusBadge
            label={shift.attendanceStatus}
            tone={getAttendanceStatusTone(shift.attendanceStatus)}
          />
        </View>

        <View style={styles.panel}>
          <DetailRow label="Company" value={shift.companyName} />
          <DetailRow label="Actual start" value={formatDateTime(shift.actualStartTime)} />
          <DetailRow label="Actual end" value={formatDateTime(shift.actualEndTime)} />
          <DetailRow label="Hourly rate" value={formatRate(shift.hourlyRate)} />
          <DetailRow label="Break" value={`${shift.breakMinutes} min`} />
          <DetailRow label="Worked time" value={formatMinutes(shift.workedMinutes)} />
          <DetailRow label="Calculated salary" value={formatMoney(shift.calculatedSalary)} />
        </View>

        <Button
          label="Back"
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
  badges: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.sm
  },
  panel: {
    borderRadius: radii.card,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.white,
    paddingHorizontal: spacing.md
  }
});
