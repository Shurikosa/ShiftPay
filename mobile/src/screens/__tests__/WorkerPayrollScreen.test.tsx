import type { ComponentProps } from "react";
import { RefreshControl } from "react-native";
import { act, create, type ReactTestRenderer } from "react-test-renderer";
import { ApiError } from "../../api/errors";
import {
  createPayoutRequest,
  getMyPayoutRequests,
  getPayableAttendances,
  previewPayoutRequest
} from "../../api/payroll";
import { Button } from "../../components/Button";
import { useAuth } from "../../context/AuthContext";
import type {
  PayableAttendance,
  PayoutRequest,
  PayoutRequestPreview
} from "../../types/payroll";
import { WorkerPayrollScreen } from "../WorkerPayrollScreen";

jest.mock("@react-navigation/native", () => {
  const React = jest.requireActual<typeof import("react")>("react");
  let currentEffect: (() => void | (() => void)) | undefined;
  let currentCleanup: (() => void) | undefined;

  return {
    __blurPayrollScreen: () => {
      currentCleanup?.();
      currentCleanup = undefined;
    },
    __focusPayrollScreen: () => {
      const cleanup = currentEffect?.();
      currentCleanup = typeof cleanup === "function" ? cleanup : undefined;
    },
    useFocusEffect: (effect: () => void | (() => void)) =>
      React.useEffect(() => {
        currentEffect = effect;
        const cleanup = effect();
        currentCleanup = typeof cleanup === "function" ? cleanup : undefined;

        return () => {
          if (currentEffect === effect) {
            currentCleanup?.();
            currentCleanup = undefined;
            currentEffect = undefined;
          } else if (typeof cleanup === "function") {
            cleanup();
          }
        };
      }, [effect])
  };
});
jest.mock("../../api/payroll", () => ({
  createPayoutRequest: jest.fn(),
  getMyPayoutRequests: jest.fn(),
  getPayableAttendances: jest.fn(),
  previewPayoutRequest: jest.fn()
}));
jest.mock("../../components/AppIcon", () => ({
  AppIcon: () => null,
  isAppIconName: () => true
}));
jest.mock("../../context/AuthContext", () => ({ useAuth: jest.fn() }));

const mockedPayable = jest.mocked(getPayableAttendances);
const mockedRequests = jest.mocked(getMyPayoutRequests);
const mockedPreview = jest.mocked(previewPayoutRequest);
const mockedCreate = jest.mocked(createPayoutRequest);
const mockedUseAuth = jest.mocked(useAuth);
const navigationFocus = jest.requireMock("@react-navigation/native") as {
  __blurPayrollScreen: () => void;
  __focusPayrollScreen: () => void;
};
const navigation = { goBack: jest.fn(), navigate: jest.fn() };
const props = {
  navigation,
  route: { key: "payroll", name: "WorkerPayroll" }
} as unknown as ComponentProps<typeof WorkerPayrollScreen>;

function attendance(
  id: number,
  label: string | null,
  overrides: Partial<PayableAttendance> = {}
): PayableAttendance {
  return {
    attendanceId: id,
    shiftId: id + 1_000,
    companyId: 10,
    companyName: "Acme Construction",
    currencyLabel: label,
    title: `Shift ${id}`,
    location: null,
    actualStartTime: null,
    actualEndTime: "2026-01-01T10:00:00Z",
    paymentStatus: "UNPAID",
    rawPayableMinutes: 120,
    payoutRoundedMinutes: 999,
    hourlyRate: 88.75,
    calculatedSalary: 777.25,
    totalBaseAmount: 666.125,
    totalPremiumAmount: 555.875,
    payoutAmount: 40,
    ...overrides
  };
}

function preview(overrides: Partial<PayoutRequestPreview> = {}): PayoutRequestPreview {
  return {
    currencyLabel: "EUR",
    rawPayableMinutes: 17,
    payoutRoundedMinutes: 999,
    exactCalculatedAmount: 777.25,
    totalBaseAmount: 666.125,
    totalPremiumAmount: 555.875,
    payoutAmount: 91,
    items: [],
    ...overrides
  };
}

function request(
  id: number,
  status: PayoutRequest["status"] = "PENDING"
): PayoutRequest {
  return {
    id,
    companyId: 10,
    companyName: "Acme Construction",
    currencyLabel: "EUR",
    workerId: 7,
    workerFirstName: "Ada",
    workerLastName: "Worker",
    status,
    requestedAt: "2026-01-02T10:00:00Z",
    approvedAt: status === "APPROVED" ? "2026-01-03T10:00:00Z" : null,
    paidAt: null,
    rawPayableMinutes: 17,
    payoutRoundedMinutes: 999,
    exactCalculatedAmount: 777.25,
    totalBaseAmount: 666.125,
    totalPremiumAmount: 555.875,
    payoutAmount: 91,
    items: []
  };
}

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((nextResolve, nextReject) => {
    resolve = nextResolve;
    reject = nextReject;
  });
  return { promise, reject, resolve };
}

async function flush() {
  await Promise.resolve();
  await Promise.resolve();
  await Promise.resolve();
}

function control(view: ReactTestRenderer, label: string) {
  const result = view.root
    .findAllByType(Button)
    .find((item) => item.props.label === label);
  if (!result) throw new Error(`Missing control: ${label}`);
  return result;
}

function attendanceRows(view: ReactTestRenderer) {
  return view.root.findAll(
    (item) =>
      item.props.accessibilityRole === "checkbox" &&
      typeof item.props.onPress === "function" &&
      typeof item.type !== "string"
  );
}

function rendered(view: ReactTestRenderer) {
  return JSON.stringify(
    view.toJSON(),
    (key, value: unknown) =>
      key === "_owner" || key === "refreshControl" ? undefined : value
  );
}

describe("WorkerPayrollScreen", () => {
  let renderer: ReactTestRenderer | null = null;
  const authenticatedRequest = jest.fn(
    (callback: (token: string) => Promise<unknown>) => callback("token")
  );

  beforeAll(() => {
    (
      globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }
    ).IS_REACT_ACT_ENVIRONMENT = true;
  });

  beforeEach(() => {
    jest.clearAllMocks();
    mockedPayable.mockReset();
    mockedRequests.mockReset();
    mockedPreview.mockReset();
    mockedCreate.mockReset();
    mockedUseAuth.mockReset();
    authenticatedRequest.mockImplementation(
      (callback: (token: string) => Promise<unknown>) => callback("token")
    );
    mockedPayable.mockResolvedValue([attendance(1, "EUR")]);
    mockedRequests.mockResolvedValue([]);
    mockedPreview.mockResolvedValue(preview());
    mockedCreate.mockResolvedValue(request(50));
    mockedUseAuth.mockReturnValue({
      user: {
        id: 7,
        email: "ada@example.com",
        firstName: "Ada",
        lastName: "Worker",
        role: "WORKER",
        company: {
          id: 10,
          name: "Acme Construction",
          currencyLabel: "EUR",
          timeZone: "Europe/Berlin"
        }
      },
      authenticatedRequest
    } as unknown as ReturnType<typeof useAuth>);
  });

  afterEach(() => {
    if (renderer) {
      act(() => renderer?.unmount());
      renderer = null;
    }
  });

  async function renderScreen() {
    await act(async () => {
      renderer = create(<WorkerPayrollScreen {...props} />);
      await flush();
    });
    return renderer!;
  }

  it("renders the redesigned header, selection flow, primary action, and accessible card", async () => {
    mockedPayable.mockResolvedValueOnce([
      attendance(501, "EUR", {
        title: "Night concrete pour",
        location: "North yard"
      })
    ]);
    const view = await renderScreen();
    const row = attendanceRows(view)[0]!;

    expect(rendered(view)).toContain("ShiftPay");
    expect(rendered(view)).toContain("Acme Construction");
    expect(rendered(view)).toContain("Payable work");
    expect(rendered(view)).toContain("Selection preview");
    expect(rendered(view)).toContain("Request history");
    expect(control(view, "Create payout request").props.variant).toBeUndefined();
    expect(row.props.accessibilityRole).toBe("checkbox");
    expect(row.props.accessibilityState).toEqual({ checked: false, disabled: false });
    expect(row.props.accessibilityLabel).toContain("Night concrete pour");
    expect(row.props.accessibilityLabel).toContain("North yard");
    expect(row.props.accessibilityLabel).not.toContain("501");
    expect(row.props.accessibilityLabel).not.toContain("1501");
  });

  it("shows an initial loader and provides retry after an initial failure", async () => {
    const pending = deferred<PayableAttendance[]>();
    mockedPayable.mockReturnValueOnce(pending.promise);

    await act(async () => {
      renderer = create(<WorkerPayrollScreen {...props} />);
      await flush();
    });
    expect(rendered(renderer!)).toContain("Loading payroll");

    await act(async () => {
      pending.reject(new Error("network unavailable"));
      await flush();
    });
    expect(rendered(renderer!)).toContain("Could not load payroll");
    expect(rendered(renderer!)).toContain("network unavailable");

    mockedPayable.mockResolvedValueOnce([attendance(2, "EUR")]);
    await act(async () => {
      control(renderer!, "Retry").props.onPress();
      await flush();
    });
    expect(rendered(renderer!)).toContain("Shift 2");
  });

  it("preserves usable attendance and history when refresh fails, then recovers", async () => {
    mockedPayable
      .mockResolvedValueOnce([attendance(1, "EUR")])
      .mockRejectedValueOnce(new Error("refresh failed"))
      .mockResolvedValueOnce([attendance(2, "EUR")]);
    mockedRequests
      .mockResolvedValueOnce([request(10)])
      .mockResolvedValueOnce([request(10)])
      .mockResolvedValueOnce([request(11)]);
    const view = await renderScreen();

    await act(async () => {
      view.root.findByType(RefreshControl).props.onRefresh();
      await flush();
    });
    expect(rendered(view)).toContain("Shift 1");
    expect(rendered(view)).toContain("Request #");
    expect(rendered(view)).toContain("refresh failed");

    await act(async () => {
      control(view, "Retry refresh").props.onPress();
      await flush();
    });
    expect(rendered(view)).toContain("Shift 2");
    expect(rendered(view)).not.toContain("Shift 1");
  });

  it("invalidates a completed preview as soon as a manual refresh starts and keeps it invalid after failure", async () => {
    const refresh = deferred<PayableAttendance[]>();
    mockedPayable
      .mockResolvedValueOnce([attendance(1, "EUR")])
      .mockReturnValueOnce(refresh.promise);
    const view = await renderScreen();
    act(() => void attendanceRows(view)[0]!.props.onPress());
    await act(async () => {
      control(view, "Preview selection").props.onPress();
      await flush();
    });
    expect(rendered(view)).toContain("Backend preview ready");
    expect(control(view, "Create payout request").props.disabled).toBe(false);

    act(() => {
      view.root.findByType(RefreshControl).props.onRefresh();
    });
    expect(rendered(view)).toContain("Shift 1");
    expect(rendered(view)).not.toContain("Backend preview ready");
    expect(control(view, "Create payout request").props.disabled).toBe(true);

    await act(async () => {
      refresh.reject(new Error("manual refresh failed"));
      await flush();
    });

    expect(rendered(view)).toContain("Shift 1");
    expect(rendered(view)).toContain("manual refresh failed");
    expect(rendered(view)).not.toContain("Backend preview ready");
    expect(rendered(view)).toContain("Preview required");
    expect(control(view, "Create payout request").props.disabled).toBe(true);
  });

  it("invalidates preview on blur/refocus and rejects the late response from the old preview", async () => {
    const oldPreview = deferred<PayoutRequestPreview>();
    const focusLoad = deferred<PayableAttendance[]>();
    mockedPreview.mockReturnValueOnce(oldPreview.promise);
    const view = await renderScreen();
    act(() => void attendanceRows(view)[0]!.props.onPress());
    act(() => {
      control(view, "Preview selection").props.onPress();
    });

    mockedPayable.mockReturnValueOnce(focusLoad.promise);
    act(() => {
      navigationFocus.__blurPayrollScreen();
      navigationFocus.__focusPayrollScreen();
    });

    await act(async () => {
      oldPreview.resolve(preview({ payoutAmount: 999 }));
      await flush();
    });
    expect(rendered(view)).not.toContain("999 EUR");
    expect(rendered(view)).not.toContain("Backend preview ready");
    expect(control(view, "Create payout request").props.disabled).toBe(true);

    await act(async () => {
      focusLoad.reject(new Error("focus refresh failed"));
      await flush();
    });
    expect(rendered(view)).toContain("Shift 1");
    expect(rendered(view)).toContain("focus refresh failed");
    expect(control(view, "Create payout request").props.disabled).toBe(true);
  });

  it("preserves backend attendance order and shows the no-payable state", async () => {
    mockedPayable.mockResolvedValueOnce([
      attendance(3, "EUR", { title: "Third returned" }),
      attendance(1, "EUR", { title: "First-numbered returned second" })
    ]);
    const view = await renderScreen();
    const output = rendered(view);
    expect(output.indexOf("Third returned")).toBeLessThan(
      output.indexOf("First-numbered returned second")
    );

    act(() => view.unmount());
    renderer = null;
    mockedPayable.mockResolvedValueOnce([]);
    const emptyView = await renderScreen();
    expect(rendered(emptyView)).toContain("No payable work");
  });

  it("does not allow null or mixed currency-label selections", async () => {
    mockedPayable.mockResolvedValueOnce([
      attendance(1, null),
      attendance(2, "EUR"),
      attendance(3, "USD"),
      attendance(4, "EUR")
    ]);
    const view = await renderScreen();
    const rows = attendanceRows(view);

    expect(rows[0]!.props.disabled).toBe(true);
    expect(rendered(view)).toContain("Historical currency unavailable");
    act(() => void rows[1]!.props.onPress());
    expect(attendanceRows(view)[2]!.props.disabled).toBe(true);
    expect(attendanceRows(view)[3]!.props.disabled).toBe(false);
    expect(control(view, "Create payout request").props.disabled).toBe(true);
  });

  it("derives rapid checkbox toggles from the latest selection without duplicate IDs", async () => {
    const view = await renderScreen();
    const row = attendanceRows(view)[0]!;

    act(() => {
      void row.props.onPress();
      void row.props.onPress();
    });
    expect(rendered(view)).toContain("0 attendance rows selected");
    expect(control(view, "Preview selection").props.disabled).toBe(true);
    expect(mockedPreview).not.toHaveBeenCalled();

    act(() => void row.props.onPress());
    await act(async () => {
      control(view, "Preview selection").props.onPress();
      await flush();
    });
    expect(mockedPreview).toHaveBeenCalledWith("token", { attendanceIds: [1] });
  });

  it("previews exact equal-label IDs and displays only authoritative backend totals", async () => {
    mockedPayable.mockResolvedValueOnce([
      attendance(1, "EUR"),
      attendance(3, "EUR")
    ]);
    mockedPreview.mockResolvedValueOnce(preview({ rawPayableMinutes: 17, payoutAmount: 91 }));
    const view = await renderScreen();

    act(() => void attendanceRows(view)[0]!.props.onPress());
    act(() => void attendanceRows(view)[1]!.props.onPress());
    await act(async () => {
      control(view, "Preview selection").props.onPress();
      await flush();
    });

    expect(mockedPreview).toHaveBeenCalledWith("token", { attendanceIds: [1, 3] });
    expect(rendered(view)).toContain("17 min");
    expect(rendered(view)).toContain("91 EUR");
    expect(rendered(view)).not.toContain("4 h 0 min");
    expect(rendered(view)).not.toContain("88.75");
    expect(rendered(view)).not.toContain("777.25");
    expect(rendered(view)).not.toContain("666.125");
    expect(rendered(view)).not.toContain("555.875");
  });

  it("keeps preview errors retryable and does not publish a delayed preview after unmount", async () => {
    mockedPreview.mockRejectedValueOnce(new ApiError("MIXED_CURRENCY_LABELS", 409));
    const view = await renderScreen();
    act(() => void attendanceRows(view)[0]!.props.onPress());
    await act(async () => {
      control(view, "Preview selection").props.onPress();
      await flush();
    });
    expect(rendered(view)).toContain("MIXED_CURRENCY_LABELS");
    expect(control(view, "Retry preview")).toBeDefined();

    act(() => view.unmount());
    renderer = null;
    const pending = deferred<PayoutRequestPreview>();
    mockedPreview.mockReturnValueOnce(pending.promise);
    const nextView = await renderScreen();
    act(() => void attendanceRows(nextView)[0]!.props.onPress());
    act(() => void control(nextView, "Preview selection").props.onPress());
    act(() => nextView.unmount());
    renderer = null;
    await act(async () => {
      pending.resolve(preview());
      await flush();
    });
  });

  it("refreshes canonical payable state after preview 400 without deduplicating the payload", async () => {
    mockedPayable
      .mockResolvedValueOnce([attendance(1, "EUR")])
      .mockResolvedValueOnce([attendance(2, "EUR")]);
    mockedPreview.mockRejectedValueOnce(
      new ApiError("DUPLICATE_ATTENDANCE_IDS", 400)
    );
    const view = await renderScreen();
    act(() => void attendanceRows(view)[0]!.props.onPress());

    await act(async () => {
      control(view, "Preview selection").props.onPress();
      await flush();
    });

    expect(mockedPreview).toHaveBeenCalledWith("token", { attendanceIds: [1] });
    expect(mockedPayable).toHaveBeenCalledTimes(2);
    expect(rendered(view)).toContain("DUPLICATE_ATTENDANCE_IDS");
    expect(rendered(view)).toContain("Shift 2");
    expect(rendered(view)).not.toContain("Shift 1");
    expect(control(view, "Create payout request").props.disabled).toBe(true);
  });

  it("holds a single mutation lock during a delayed preview", async () => {
    const pending = deferred<PayoutRequestPreview>();
    mockedPreview.mockReturnValueOnce(pending.promise);
    const view = await renderScreen();
    act(() => void attendanceRows(view)[0]!.props.onPress());

    act(() => {
      control(view, "Preview selection").props.onPress();
      control(view, "Preview selection").props.onPress();
      view.root.findByType(RefreshControl).props.onRefresh();
    });
    expect(mockedPreview).toHaveBeenCalledTimes(1);
    expect(mockedPayable).toHaveBeenCalledTimes(1);

    await act(async () => {
      pending.resolve(preview());
      await flush();
    });
  });

  it("invalidates a completed preview when refreshed payroll data replaces the selection", async () => {
    mockedPayable
      .mockResolvedValueOnce([attendance(1, "EUR")])
      .mockResolvedValueOnce([attendance(1, "EUR", { payoutAmount: 52 })]);
    mockedRequests.mockResolvedValue([]);
    const view = await renderScreen();
    act(() => void attendanceRows(view)[0]!.props.onPress());
    await act(async () => {
      control(view, "Preview selection").props.onPress();
      await flush();
    });
    expect(rendered(view)).toContain("Backend preview ready");

    await act(async () => {
      view.root.findByType(RefreshControl).props.onRefresh();
      await flush();
    });

    expect(rendered(view)).not.toContain("Backend preview ready");
    expect(rendered(view)).toContain("Preview required");
    expect(control(view, "Create payout request").props.disabled).toBe(true);
  });

  it("locks duplicate create and refresh actions and ignores completion after unmount", async () => {
    const pending = deferred<PayoutRequest>();
    mockedCreate.mockReturnValueOnce(pending.promise);
    const view = await renderScreen();
    act(() => void attendanceRows(view)[0]!.props.onPress());
    await act(async () => {
      control(view, "Preview selection").props.onPress();
      await flush();
    });

    act(() => {
      control(view, "Create payout request").props.onPress();
      control(view, "Create payout request").props.onPress();
      view.root.findByType(RefreshControl).props.onRefresh();
    });
    expect(mockedCreate).toHaveBeenCalledTimes(1);
    expect(mockedPayable).toHaveBeenCalledTimes(1);

    act(() => view.unmount());
    renderer = null;
    await act(async () => {
      pending.resolve(request(99));
      await flush();
    });
    expect(mockedPayable).toHaveBeenCalledTimes(1);
  });

  it("creates from the exact current preview and refreshes payable work and history", async () => {
    const created = request(77);
    mockedPayable
      .mockResolvedValueOnce([attendance(1, "EUR")])
      .mockResolvedValueOnce([]);
    mockedRequests.mockResolvedValueOnce([]).mockResolvedValueOnce([created]);
    mockedCreate.mockResolvedValueOnce(created);
    const view = await renderScreen();
    act(() => void attendanceRows(view)[0]!.props.onPress());
    await act(async () => {
      control(view, "Preview selection").props.onPress();
      await flush();
    });
    await act(async () => {
      control(view, "Create payout request").props.onPress();
      await flush();
    });

    expect(mockedCreate).toHaveBeenCalledWith("token", { attendanceIds: [1] });
    expect(mockedPayable).toHaveBeenCalledTimes(2);
    expect(mockedRequests).toHaveBeenCalledTimes(2);
    expect(rendered(view)).toContain("Payout request created");
    expect(rendered(view)).toContain("Request #");
    expect(rendered(view)).toContain("77");
  });

  it("keeps accepted-request success visible when the canonical refresh fails", async () => {
    mockedPayable
      .mockResolvedValueOnce([attendance(1, "EUR"), attendance(2, "EUR")])
      .mockRejectedValueOnce(new Error("reload failed"));
    mockedRequests.mockResolvedValue([]);
    mockedCreate.mockResolvedValueOnce(request(88));
    const view = await renderScreen();
    const submittedRow = attendanceRows(view)[0]!;
    const submittedOnPress = submittedRow.props.onPress as () => void;
    act(() => void submittedRow.props.onPress());
    await act(async () => {
      control(view, "Preview selection").props.onPress();
      await flush();
    });
    await act(async () => {
      control(view, "Create payout request").props.onPress();
      await flush();
    });

    expect(rendered(view)).toContain("Payout request created");
    expect(rendered(view)).toContain("reload failed");
    expect(rendered(view)).toContain("88");
    expect(rendered(view)).not.toContain("Shift 1");
    expect(rendered(view)).toContain("Shift 2");
    expect(rendered(view)).not.toContain("Could not create request");

    act(() => submittedOnPress());
    expect(rendered(view)).toContain("0 attendance rows selected");
    expect(control(view, "Preview selection").props.disabled).toBe(true);
    expect(mockedPreview).toHaveBeenCalledTimes(1);

    act(() => void attendanceRows(view)[0]!.props.onPress());
    await act(async () => {
      control(view, "Preview selection").props.onPress();
      await flush();
    });
    expect(mockedPreview).toHaveBeenLastCalledWith("token", {
      attendanceIds: [2]
    });
  });

  it("refreshes canonical data after a create conflict and keeps the conflict feedback", async () => {
    mockedPayable
      .mockResolvedValueOnce([attendance(1, "EUR")])
      .mockResolvedValueOnce([]);
    mockedRequests.mockResolvedValue([]);
    mockedCreate.mockRejectedValueOnce(new ApiError("ATTENDANCE_NOT_PAYABLE", 409));
    const view = await renderScreen();
    act(() => void attendanceRows(view)[0]!.props.onPress());
    await act(async () => {
      control(view, "Preview selection").props.onPress();
      await flush();
    });
    await act(async () => {
      control(view, "Create payout request").props.onPress();
      await flush();
    });

    expect(mockedPayable).toHaveBeenCalledTimes(2);
    expect(rendered(view)).toContain("ATTENDANCE_NOT_PAYABLE");
    expect(rendered(view)).toContain("No payable work");
  });

  it("segments request history without making status-specific API assumptions", async () => {
    mockedRequests.mockResolvedValueOnce([request(10), request(20, "APPROVED")]);
    const view = await renderScreen();
    expect(rendered(view)).toContain("10");
    expect(rendered(view)).not.toContain("Request #\",\"20");

    const approved = view.root.find(
      (item) => item.props.accessibilityRole === "radio" && item.props.accessibilityLabel === "Approved"
    );
    act(() => void approved.props.onPress());
    expect(rendered(view)).toContain("20");
    expect(mockedRequests).toHaveBeenCalledWith("token");
  });

  it("does not call payroll APIs outside the joined WORKER boundary", async () => {
    mockedUseAuth.mockReturnValue({
      user: {
        id: 8,
        role: "FOREMAN",
        company: {
          id: 10,
          name: "Acme",
          currencyLabel: "EUR",
          timeZone: "Europe/Berlin"
        }
      },
      authenticatedRequest
    } as unknown as ReturnType<typeof useAuth>);
    const view = await renderScreen();
    expect(rendered(view)).toContain("Payroll unavailable");
    expect(mockedPayable).not.toHaveBeenCalled();
    expect(mockedRequests).not.toHaveBeenCalled();

    act(() => view.unmount());
    renderer = null;
    mockedUseAuth.mockReturnValue({
      user: { id: 9, role: "WORKER", company: null },
      authenticatedRequest
    } as unknown as ReturnType<typeof useAuth>);
    const companyless = await renderScreen();
    expect(rendered(companyless)).toContain("Payroll unavailable");
    expect(mockedPayable).not.toHaveBeenCalled();
  });

  it("selects the worker Dashboard tab from Back to dashboard", async () => {
    const view = await renderScreen();
    act(() => void control(view, "Back to dashboard").props.onPress());
    expect(navigation.navigate).toHaveBeenCalledWith("WorkerDashboard");
    expect(navigation.goBack).not.toHaveBeenCalled();
  });
});
