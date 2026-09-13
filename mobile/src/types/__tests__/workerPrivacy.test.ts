import type { WorkerStackParamList } from "../navigation";
import type { WorkerShiftHistoryItem } from "../shifts";

type PrivateForemanField =
  | "foremanWorkedMinutes"
  | "foremanPauseMinutes"
  | "foremanHourlyRate"
  | "foremanSalary";

type ForemanOnlyRoute = "ForemanShiftDetails" | "ShiftSummary";

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

describe("worker privacy types", () => {
  it("keeps private foreman salary fields out of worker history DTOs", () => {
    expect(workerDtoExcludesPrivateForemanFields).toBe(true);
  });

  it("keeps managed breakdown screens out of worker navigation", () => {
    expect(workerNavigatorExcludesManagedBreakdownRoutes).toBe(true);
  });
});
