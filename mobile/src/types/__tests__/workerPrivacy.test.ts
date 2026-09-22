import type { WorkerStackParamList } from "../navigation";
import type {
  ApproveAttendanceResponse,
  JoinShiftResponse,
  WorkerShiftHistoryItem
} from "../shifts";

type PrivateForemanField =
  | "foremanWorkedMinutes"
  | "foremanPauseMinutes"
  | "foremanHourlyRate"
  | "foremanSalary";

type ForemanOnlyRoute = "ForemanCompanySettings" | "ForemanShiftDetails" | "ShiftSummary";

const workerDtoExcludesPrivateForemanFields: Extract<
  keyof WorkerShiftHistoryItem,
  PrivateForemanField
> extends never
  ? true
  : false = true;

const workerNavigatorExcludesManagedBreakdownRoutes: Extract<
  keyof WorkerStackParamList,
  ForemanOnlyRoute
> extends never
  ? true
  : false = true;

const joinedAttendanceFixture: JoinShiftResponse = {
  attendanceId: 1,
  shiftId: 2,
  workerId: 3,
  status: "JOINED",
  hourlyRate: 20,
  currencyLabel: null
};

const approvedAttendanceFixture: ApproveAttendanceResponse = {
  attendanceId: 1,
  status: "APPROVED",
  hourlyRate: 20,
  currencyLabel: "грн",
  approvedAt: "2026-09-20T10:00:00Z"
};

describe("worker privacy types", () => {
  it("keeps private foreman salary fields out of worker history DTOs", () => {
    expect(workerDtoExcludesPrivateForemanFields).toBe(true);
  });

  it("keeps managed breakdown screens out of worker navigation", () => {
    expect(workerNavigatorExcludesManagedBreakdownRoutes).toBe(true);
  });

  it("models the backend-snapshotted currency label on join and approval responses", () => {
    expect(joinedAttendanceFixture.currencyLabel).toBeNull();
    expect(approvedAttendanceFixture.currencyLabel).toBe("грн");
  });
});
