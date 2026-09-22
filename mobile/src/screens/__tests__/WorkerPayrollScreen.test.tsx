import type { ComponentProps } from "react";
import { act, create, type ReactTestRenderer } from "react-test-renderer";
import { createPayoutRequest, getMyPayoutRequests, getPayableAttendances, previewPayoutRequest } from "../../api/payroll";
import { ApiError } from "../../api/errors";
import { Button } from "../../components/Button";
import { useAuth } from "../../context/AuthContext";
import type { PayableAttendance } from "../../types/payroll";
import { WorkerPayrollScreen } from "../WorkerPayrollScreen";

jest.mock("@react-navigation/native", () => { const React = jest.requireActual<typeof import("react")>("react"); return { useFocusEffect: (effect: () => void | (() => void)) => React.useEffect(effect, [effect]) }; });
jest.mock("../../api/payroll", () => ({ createPayoutRequest: jest.fn(), getMyPayoutRequests: jest.fn(), getPayableAttendances: jest.fn(), previewPayoutRequest: jest.fn() }));
jest.mock("../../context/AuthContext", () => ({ useAuth: jest.fn() }));
const mockedPayable = jest.mocked(getPayableAttendances);
const mockedRequests = jest.mocked(getMyPayoutRequests);
const mockedPreview = jest.mocked(previewPayoutRequest);
const mockedCreate = jest.mocked(createPayoutRequest);
const mockedUseAuth = jest.mocked(useAuth);
const props = { navigation: { goBack: jest.fn() }, route: { key: "payroll", name: "WorkerPayroll" } } as unknown as ComponentProps<typeof WorkerPayrollScreen>;

function attendance(id: number, label: string | null): PayableAttendance {
  return { attendanceId: id, shiftId: id, companyId: 10, companyName: "Acme", currencyLabel: label, title: `Shift ${id}`, location: null, actualStartTime: null, actualEndTime: "2026-01-01T10:00:00Z", paymentStatus: "UNPAID", rawPayableMinutes: 120, payoutRoundedMinutes: 120, hourlyRate: 20, calculatedSalary: 40, totalBaseAmount: 40, totalPremiumAmount: 0, payoutAmount: 40 };
}
async function flush() { await Promise.resolve(); await Promise.resolve(); await Promise.resolve(); }
function control(view: ReactTestRenderer, label: string) { const result = view.root.findAllByType(Button).find((item) => item.props.label === label); if (!result) throw new Error(label); return result; }
function rows(view: ReactTestRenderer) {
  return view.root.findAll(
    (item) => item.props.accessibilityRole === "checkbox" && typeof item.props.onPress === "function"
  );
}

describe("WorkerPayrollScreen historical currency safeguards", () => {
  let renderer: ReactTestRenderer | null = null;
  beforeEach(() => {
    jest.clearAllMocks();
    mockedPayable.mockResolvedValue([attendance(1, "EUR")]);
    mockedRequests.mockResolvedValue([]);
    mockedPreview.mockResolvedValue({ currencyLabel: "EUR", rawPayableMinutes: 120, payoutRoundedMinutes: 120, exactCalculatedAmount: 40, totalBaseAmount: 40, totalPremiumAmount: 0, payoutAmount: 40, items: [] });
    mockedCreate.mockResolvedValue({} as Awaited<ReturnType<typeof createPayoutRequest>>);
    mockedUseAuth.mockReturnValue({ user: { role: "WORKER", company: { name: "Acme" } }, authenticatedRequest: jest.fn((request: (token: string) => Promise<unknown>) => request("token")) } as unknown as ReturnType<typeof useAuth>);
  });
  afterEach(() => act(() => renderer?.unmount()));
  async function render() { await act(async () => { renderer = create(<WorkerPayrollScreen {...props} />); await flush(); }); return renderer!; }

  it("does not allow a null-label legacy item to be submitted", async () => {
    mockedPayable.mockResolvedValueOnce([attendance(1, null)]);
    const view = await render();
    const row = rows(view)[0]!;
    expect(row.props.disabled).toBe(true);
    expect(JSON.stringify(view.toJSON())).toContain("Historical currency unavailable");
    expect(control(view, "Create payout request").props.disabled).toBe(true);
    expect(mockedCreate).not.toHaveBeenCalled();
  });

  it("does not combine mixed labels, but previews equal-label selections using backend totals", async () => {
    mockedPayable.mockResolvedValueOnce([attendance(1, "EUR"), attendance(2, "USD"), attendance(3, "EUR")]);
    const view = await render();
    act(() => void rows(view)[0]!.props.onPress());
    expect(rows(view)[1]!.props.disabled).toBe(true);
    act(() => void rows(view)[2]!.props.onPress());
    await act(async () => { control(view, "Preview").props.onPress(); await flush(); });
    expect(mockedPreview).toHaveBeenCalledWith("token", { attendanceIds: [1, 3] });
    // The intentionally inconsistent mock proves that the displayed selection comes from
    // the preview response rather than a local sum of the two 120-minute rows.
    expect(JSON.stringify(view.toJSON())).not.toContain("4 h 0 min");
  });

  it("keeps a backend payout conflict visible without calculating replacement totals", async () => {
    mockedPreview.mockRejectedValueOnce(new ApiError("MIXED_CURRENCY_LABELS", 409));
    const view = await render();
    act(() => void rows(view)[0]!.props.onPress());
    await act(async () => { control(view, "Preview").props.onPress(); await flush(); });
    expect(JSON.stringify(view.toJSON())).toContain("MIXED_CURRENCY_LABELS");
    expect(control(view, "Create payout request").props.disabled).toBe(true);
  });
});
