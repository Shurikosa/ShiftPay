import type { ComponentProps, ReactElement } from "react";
import { RefreshControl, Text } from "react-native";
import { act, create, type ReactTestRenderer } from "react-test-renderer";
import { ApiError } from "../../api/errors";
import {
  approveManagedPayoutRequest,
  getManagedPayoutRequests
} from "../../api/payroll";
import { Button } from "../../components/Button";
import { SegmentedControl } from "../../components/SegmentedControl";
import { useAuth } from "../../context/AuthContext";
import type { User } from "../../types/auth";
import type { PayoutRequest, PayoutRequestStatus } from "../../types/payroll";
import { ForemanPayrollRequestsScreen } from "../ForemanPayrollRequestsScreen";

let mockFocusCallback: (() => void | (() => void)) | null = null;
let mockFocusCleanup: (() => void) | null = null;

jest.mock("@expo/vector-icons/Ionicons", () => {
  const React = jest.requireActual<typeof import("react")>("react");
  const { Text: NativeText } = jest.requireActual<typeof import("react-native")>(
    "react-native"
  );
  const MockIonicons = (props: Record<string, unknown>) =>
    React.createElement(NativeText, props as ComponentProps<typeof NativeText>);
  return { __esModule: true, default: MockIonicons };
});
jest.mock("@react-navigation/native", () => {
  const React = jest.requireActual<typeof import("react")>("react");
  return {
    useFocusEffect: (effect: () => void | (() => void)) =>
      React.useEffect(() => {
        mockFocusCallback = effect;
        mockFocusCleanup = effect() ?? null;
        return () => {
          const cleanup = mockFocusCleanup;
          mockFocusCleanup = null;
          cleanup?.();
          if (mockFocusCallback === effect) mockFocusCallback = null;
        };
      }, [effect])
  };
});
jest.mock("../../api/payroll", () => ({
  approveManagedPayoutRequest: jest.fn(),
  getManagedPayoutRequests: jest.fn()
}));
jest.mock("../../context/AuthContext", () => ({ useAuth: jest.fn() }));

const mockedApprove = jest.mocked(approveManagedPayoutRequest);
const mockedGetRequests = jest.mocked(getManagedPayoutRequests);
const mockedUseAuth = jest.mocked(useAuth);

const foreman: User = {
  id: 5,
  email: "foreman@example.com",
  firstName: "Fran",
  lastName: "Foreman",
  role: "FOREMAN",
  company: {
    id: 10,
    name: "Acme Construction",
    joinCode: "ACME42",
    currencyLabel: "EUR",
    timeZone: "Europe/Berlin"
  }
};

const nextForeman: User = {
  ...foreman,
  id: 6,
  email: "next-foreman@example.com",
  company: {
    ...foreman.company!,
    id: 11,
    name: "Next Construction"
  }
};

const navigation = { goBack: jest.fn(), navigate: jest.fn() };
const props = {
  navigation,
  route: { key: "foreman-payroll", name: "ForemanPayrollRequests" }
} as unknown as ComponentProps<typeof ForemanPayrollRequestsScreen>;

type Deferred<T> = {
  promise: Promise<T>;
  resolve: (value: T) => void;
  reject: (reason: unknown) => void;
};

function deferred<T>(): Deferred<T> {
  let resolve!: (value: T) => void;
  let reject!: (reason: unknown) => void;
  const promise = new Promise<T>((nextResolve, nextReject) => {
    resolve = nextResolve;
    reject = nextReject;
  });
  return { promise, reject, resolve };
}

function requestFixture(
  id: number,
  status: PayoutRequestStatus = "PENDING",
  overrides: Partial<PayoutRequest> = {}
): PayoutRequest {
  return {
    id,
    companyId: 10,
    companyName: "Acme Construction",
    currencyLabel: "EUR",
    workerId: id + 100,
    workerFirstName: `Worker${id}`,
    workerLastName: "Example",
    status,
    rawPayableMinutes: 97,
    payoutRoundedMinutes: 999,
    exactCalculatedAmount: 987.654321,
    totalBaseAmount: 876.54321,
    totalPremiumAmount: 765.4321,
    payoutAmount: 43,
    requestedAt: "2026-07-06T20:00:00Z",
    approvedAt: status === "APPROVED" ? "2026-07-07T10:00:00Z" : null,
    paidAt: status === "APPROVED" ? "2026-07-07T10:00:00Z" : null,
    items: [
      {
        attendanceId: id + 200,
        shiftId: id + 300,
        title: `Backend shift ${id}`,
        actualStartTime: "2026-07-06T18:00:00Z",
        actualEndTime: "2026-07-06T19:37:00Z",
        paymentStatus: status === "APPROVED" ? "PAID" : "PAYMENT_REQUESTED",
        rawPayableMinutes: 97,
        payoutRoundedMinutes: 888,
        hourlyRate: 777,
        calculatedSalary: 666,
        totalBaseAmount: 555,
        totalPremiumAmount: 444,
        payoutAmount: 43,
        paidAt: status === "APPROVED" ? "2026-07-07T10:00:00Z" : null
      }
    ],
    ...overrides
  };
}

async function flushPromises() {
  await Promise.resolve();
  await Promise.resolve();
  await Promise.resolve();
}

function renderText(view: ReactTestRenderer): string {
  return view.root
    .findAllByType(Text)
    .map((node) => node.props.children)
    .flat(Infinity)
    .filter((value) => typeof value === "string" || typeof value === "number")
    .join(" ")
    .replace(/\s+/gu, " ");
}

function findButton(view: ReactTestRenderer, label: string) {
  const button = view.root
    .findAllByType(Button)
    .find((candidate) => candidate.props.label === label);
  if (!button) throw new Error(`Button not found: ${label}`);
  return button;
}

function pressSegment(view: ReactTestRenderer, value: PayoutRequestStatus) {
  const control = view.root.findByType(SegmentedControl);
  act(() => void control.props.onChange(value));
}

function blurScreen() {
  const cleanup = mockFocusCleanup;
  mockFocusCleanup = null;
  cleanup?.();
}

function refocusScreen() {
  if (!mockFocusCallback || mockFocusCleanup) {
    throw new Error("Focus lifecycle is not ready for refocus");
  }
  mockFocusCleanup = mockFocusCallback() ?? null;
}

function updateSynchronously(
  renderer: ReactTestRenderer,
  element: ReactElement
) {
  const syncRenderer = renderer as ReactTestRenderer & {
    unstable_flushSync: (callback: () => void) => void;
  };
  syncRenderer.unstable_flushSync(() => renderer.update(element));
}

describe("ForemanPayrollRequestsScreen", () => {
  let view: ReactTestRenderer | null = null;
  let authenticatedRequest: jest.Mock;

  beforeAll(() => {
    (
      globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }
    ).IS_REACT_ACT_ENVIRONMENT = true;
  });

  beforeEach(() => {
    jest.clearAllMocks();
    mockedApprove.mockReset();
    mockedGetRequests.mockReset();
    mockedUseAuth.mockReset();
    mockFocusCallback = null;
    mockFocusCleanup = null;
    authenticatedRequest = jest.fn(
      (request: (token: string) => Promise<unknown>) => request("foreman-token")
    );
    mockedUseAuth.mockReturnValue({
      authenticatedRequest,
      user: foreman
    } as unknown as ReturnType<typeof useAuth>);
    mockedApprove.mockResolvedValue(requestFixture(1, "APPROVED"));
    mockedGetRequests.mockResolvedValue([]);
  });

  afterEach(() => {
    if (view) act(() => view?.unmount());
    view = null;
  });

  it("loads PENDING by default and presents only compact persisted request data", async () => {
    mockedGetRequests.mockResolvedValueOnce([
      requestFixture(1, "PENDING", {
        currencyLabel: "PLN",
        approvedAt: null,
        paidAt: null
      }),
      requestFixture(2, "PENDING", { currencyLabel: null })
    ]);

    await act(async () => {
      view = create(<ForemanPayrollRequestsScreen {...props} />);
      await flushPromises();
    });

    expect(mockedGetRequests).toHaveBeenCalledTimes(1);
    expect(mockedGetRequests).toHaveBeenCalledWith("foreman-token", "PENDING");
    const control = view!.root.findByType(SegmentedControl);
    expect(control.props.value).toBe("PENDING");
    expect(control.props.accessibilityLabel).toBe("Payroll request status");

    const text = renderText(view!);
    expect(text).toContain("Worker1 Example");
    expect(text).toContain("Pending approval");
    expect(text).toContain("43 PLN");
    expect(text).toContain("43 (currency unavailable)");
    expect(text).not.toContain("Approved 7 Jul");
    expect(text).not.toContain("987.654321");
    expect(text).not.toContain("999");
    expect(text).not.toContain("777");
  });

  it("switches segments without showing PENDING cards under the APPROVED heading", async () => {
    const approvedLoad = deferred<PayoutRequest[]>();
    mockedGetRequests
      .mockResolvedValueOnce([requestFixture(1)])
      .mockReturnValueOnce(approvedLoad.promise);

    await act(async () => {
      view = create(<ForemanPayrollRequestsScreen {...props} />);
      await flushPromises();
    });

    pressSegment(view!, "APPROVED");
    expect(renderText(view!)).toContain("Approved requests");
    expect(renderText(view!)).not.toContain("Worker1 Example");
    expect(view!.root.findByProps({ testID: "foreman-payroll-loading" })).toBeTruthy();

    await act(async () => {
      approvedLoad.resolve([requestFixture(2, "APPROVED")]);
      await flushPromises();
    });
    expect(mockedGetRequests).toHaveBeenLastCalledWith("foreman-token", "APPROVED");
    expect(renderText(view!)).toContain("Worker2 Example");
    expect(renderText(view!)).not.toContain("Worker1 Example");
    expect(view!.root.findAllByProps({ testID: "foreman-payroll-approve-2" })).toHaveLength(0);
  });

  it("shows initial failure and retries the same segment", async () => {
    mockedGetRequests
      .mockRejectedValueOnce(new Error("managed payroll offline"))
      .mockResolvedValueOnce([requestFixture(3)]);

    await act(async () => {
      view = create(<ForemanPayrollRequestsScreen {...props} />);
      await flushPromises();
    });
    expect(view!.root.findByProps({ testID: "foreman-payroll-initial-error" })).toBeTruthy();

    await act(async () => {
      findButton(view!, "Retry").props.onPress();
      await flushPromises();
    });
    expect(mockedGetRequests).toHaveBeenCalledTimes(2);
    expect(renderText(view!)).toContain("Worker3 Example");
  });

  it("retains usable cards on pull-to-refresh failure and offers refresh-only retry", async () => {
    mockedGetRequests
      .mockResolvedValueOnce([requestFixture(4)])
      .mockRejectedValueOnce(new Error("temporary network failure"))
      .mockResolvedValueOnce([requestFixture(5)]);

    await act(async () => {
      view = create(<ForemanPayrollRequestsScreen {...props} />);
      await flushPromises();
    });
    await act(async () => {
      view!.root.findByType(RefreshControl).props.onRefresh();
      await flushPromises();
    });

    expect(renderText(view!)).toContain("Worker4 Example");
    expect(view!.root.findByProps({ testID: "foreman-payroll-refresh-error" })).toBeTruthy();
    await act(async () => {
      findButton(view!, "Retry refresh").props.onPress();
      await flushPromises();
    });
    expect(mockedApprove).not.toHaveBeenCalled();
    expect(renderText(view!)).toContain("Worker5 Example");
  });

  it("locks rapid approve taps and unlocks after a direct mutation failure", async () => {
    const firstApprove = deferred<PayoutRequest>();
    const retryApprove = deferred<PayoutRequest>();
    mockedGetRequests.mockResolvedValueOnce([requestFixture(6)]);
    mockedApprove
      .mockReturnValueOnce(firstApprove.promise)
      .mockReturnValueOnce(retryApprove.promise);

    await act(async () => {
      view = create(<ForemanPayrollRequestsScreen {...props} />);
      await flushPromises();
    });
    const savedApprove = findButton(view!, "Approve").props.onPress;
    act(() => {
      savedApprove();
      savedApprove();
    });
    expect(mockedApprove).toHaveBeenCalledTimes(1);
    expect(mockedApprove).toHaveBeenCalledWith("foreman-token", 6);

    await act(async () => {
      firstApprove.reject(new Error("approve unavailable"));
      await flushPromises();
    });
    expect(view!.root.findByProps({ testID: "foreman-payroll-approve-error" })).toBeTruthy();

    act(() => void savedApprove());
    expect(mockedApprove).toHaveBeenCalledTimes(2);
  });

  it("releases a rejected blurred approve after refocus revalidates PENDING", async () => {
    const blurredApprove = deferred<PayoutRequest>();
    const retryApprove = deferred<PayoutRequest>();
    mockedGetRequests
      .mockResolvedValueOnce([requestFixture(20)])
      .mockResolvedValueOnce([requestFixture(20)]);
    mockedApprove
      .mockReturnValueOnce(blurredApprove.promise)
      .mockReturnValueOnce(retryApprove.promise);

    await act(async () => {
      view = create(<ForemanPayrollRequestsScreen {...props} />);
      await flushPromises();
    });
    act(() => void findButton(view!, "Approve").props.onPress());
    expect(mockedApprove).toHaveBeenCalledTimes(1);

    act(blurScreen);
    await act(async () => {
      blurredApprove.reject(new Error("approve failed while blurred"));
      await flushPromises();
    });

    await act(async () => {
      refocusScreen();
      await flushPromises();
    });
    const approveAfterRefocus = findButton(view!, "Approve");
    expect(mockedGetRequests).toHaveBeenLastCalledWith("foreman-token", "PENDING");
    expect(approveAfterRefocus.props.disabled).toBe(false);

    act(() => {
      approveAfterRefocus.props.onPress();
      approveAfterRefocus.props.onPress();
    });
    expect(mockedApprove).toHaveBeenCalledTimes(2);
  });

  it("keeps a blurred confirmed approve blocked until a post-confirmation GET", async () => {
    const blurredApprove = deferred<PayoutRequest>();
    const reconciliation = deferred<PayoutRequest[]>();
    mockedGetRequests
      .mockResolvedValueOnce([requestFixture(21)])
      .mockReturnValueOnce(reconciliation.promise);
    mockedApprove.mockReturnValueOnce(blurredApprove.promise);

    await act(async () => {
      view = create(<ForemanPayrollRequestsScreen {...props} />);
      await flushPromises();
    });
    const savedApprove = findButton(view!, "Approve").props.onPress;
    act(() => void savedApprove());
    act(blurScreen);

    await act(async () => {
      blurredApprove.resolve(requestFixture(21, "APPROVED"));
      await flushPromises();
    });
    await act(async () => {
      refocusScreen();
      await flushPromises();
    });

    expect(findButton(view!, "Approve").props.disabled).toBe(true);
    act(() => void savedApprove());
    expect(mockedApprove).toHaveBeenCalledTimes(1);

    await act(async () => {
      reconciliation.resolve([requestFixture(21)]);
      await flushPromises();
    });
    expect(findButton(view!, "Approve").props.disabled).toBe(false);
    expect(mockedApprove).toHaveBeenCalledTimes(1);
  });

  it("forces a new GET when the refocus GET started before approve success", async () => {
    const blurredApprove = deferred<PayoutRequest>();
    const preConfirmationLoad = deferred<PayoutRequest[]>();
    const postConfirmationLoad = deferred<PayoutRequest[]>();
    mockedGetRequests
      .mockResolvedValueOnce([requestFixture(24)])
      .mockReturnValueOnce(preConfirmationLoad.promise)
      .mockReturnValueOnce(postConfirmationLoad.promise);
    mockedApprove.mockReturnValueOnce(blurredApprove.promise);

    await act(async () => {
      view = create(<ForemanPayrollRequestsScreen {...props} />);
      await flushPromises();
    });
    const savedApprove = findButton(view!, "Approve").props.onPress;
    act(() => void savedApprove());
    act(blurScreen);
    await act(async () => {
      refocusScreen();
      await flushPromises();
    });
    expect(mockedGetRequests).toHaveBeenCalledTimes(2);

    await act(async () => {
      blurredApprove.resolve(requestFixture(24, "APPROVED"));
      await flushPromises();
    });
    expect(mockedGetRequests).toHaveBeenCalledTimes(3);
    expect(mockedGetRequests).toHaveBeenLastCalledWith("foreman-token", "PENDING");

    await act(async () => {
      preConfirmationLoad.resolve([requestFixture(24)]);
      await flushPromises();
    });
    expect(findButton(view!, "Approve").props.disabled).toBe(true);
    act(() => void savedApprove());
    expect(mockedApprove).toHaveBeenCalledTimes(1);

    await act(async () => {
      postConfirmationLoad.resolve([]);
      await flushPromises();
    });
    expect(renderText(view!)).not.toContain("Worker24 Example");
    expect(mockedApprove).toHaveBeenCalledTimes(1);
  });

  it("keeps a rejected blur guarded after failed refocus GET and Retry only revalidates", async () => {
    const blurredApprove = deferred<PayoutRequest>();
    mockedGetRequests
      .mockResolvedValueOnce([requestFixture(25)])
      .mockRejectedValueOnce(new Error("refocus reconciliation failed"))
      .mockResolvedValueOnce([requestFixture(25)]);
    mockedApprove.mockReturnValueOnce(blurredApprove.promise);

    await act(async () => {
      view = create(<ForemanPayrollRequestsScreen {...props} />);
      await flushPromises();
    });
    act(() => void findButton(view!, "Approve").props.onPress());
    act(blurScreen);
    await act(async () => {
      blurredApprove.reject(new Error("approve failed while blurred"));
      await flushPromises();
    });
    await act(async () => {
      refocusScreen();
      await flushPromises();
    });

    expect(view!.root.findByProps({ testID: "foreman-payroll-refresh-error" })).toBeTruthy();
    expect(findButton(view!, "Approve").props.disabled).toBe(true);
    expect(mockedApprove).toHaveBeenCalledTimes(1);

    await act(async () => {
      findButton(view!, "Retry refresh").props.onPress();
      await flushPromises();
    });
    expect(mockedApprove).toHaveBeenCalledTimes(1);
    expect(mockedGetRequests).toHaveBeenLastCalledWith("foreman-token", "PENDING");
    expect(findButton(view!, "Approve").props.disabled).toBe(false);
  });

  it("does not let an unmounted old callback clear a newer operation for the same ID", async () => {
    const oldApprove = deferred<PayoutRequest>();
    const newerApprove = deferred<PayoutRequest>();
    mockedGetRequests
      .mockResolvedValueOnce([requestFixture(22)])
      .mockResolvedValueOnce([requestFixture(22)]);
    mockedApprove
      .mockReturnValueOnce(oldApprove.promise)
      .mockReturnValueOnce(newerApprove.promise);

    await act(async () => {
      view = create(<ForemanPayrollRequestsScreen {...props} />);
      await flushPromises();
    });
    act(() => void findButton(view!, "Approve").props.onPress());
    act(() => view?.unmount());
    view = null;

    await act(async () => {
      view = create(<ForemanPayrollRequestsScreen {...props} />);
      await flushPromises();
    });
    act(() => void findButton(view!, "Approve").props.onPress());
    expect(mockedApprove).toHaveBeenCalledTimes(2);

    await act(async () => {
      oldApprove.reject(new Error("late old failure"));
      await flushPromises();
    });
    expect(findButton(view!, "Approve").props.disabled).toBe(true);
    expect(mockedApprove).toHaveBeenCalledTimes(2);
  });

  it("does not let an old account callback clear the new account owner token", async () => {
    const oldApprove = deferred<PayoutRequest>();
    const newerApprove = deferred<PayoutRequest>();
    mockedGetRequests
      .mockResolvedValueOnce([requestFixture(23)])
      .mockResolvedValueOnce([requestFixture(23, "PENDING", { companyId: 11 })]);
    mockedApprove
      .mockReturnValueOnce(oldApprove.promise)
      .mockReturnValueOnce(newerApprove.promise);

    await act(async () => {
      view = create(<ForemanPayrollRequestsScreen {...props} />);
      await flushPromises();
    });
    act(() => void findButton(view!, "Approve").props.onPress());

    mockedUseAuth.mockReturnValue({
      authenticatedRequest,
      user: nextForeman
    } as unknown as ReturnType<typeof useAuth>);
    await act(async () => {
      view!.update(<ForemanPayrollRequestsScreen {...props} />);
      await flushPromises();
    });
    expect(renderText(view!)).toContain("Next Construction");
    act(() => void findButton(view!, "Approve").props.onPress());
    expect(mockedApprove).toHaveBeenCalledTimes(2);

    await act(async () => {
      oldApprove.reject(new Error("late previous-account failure"));
      await flushPromises();
    });
    expect(findButton(view!, "Approve").props.disabled).toBe(true);
    expect(mockedApprove).toHaveBeenCalledTimes(2);
  });

  it.each([
    ["successMessage", "Payout request approved."],
    ["approveError", "scope A approve error"],
    ["refreshError", "scope A refresh error"],
    ["initialError", "scope A initial error"]
  ] as const)(
    "remounts before rendering scope B when scope A has %s",
    async (stateKind, scopeAMarker) => {
      if (stateKind === "initialError") {
        mockedGetRequests.mockRejectedValueOnce(new Error(scopeAMarker));
      } else {
        mockedGetRequests.mockResolvedValueOnce([requestFixture(30)]);
      }
      if (stateKind === "successMessage") {
        mockedApprove.mockResolvedValueOnce(requestFixture(30, "APPROVED"));
        mockedGetRequests.mockResolvedValueOnce([requestFixture(30, "APPROVED")]);
      } else if (stateKind === "approveError") {
        mockedApprove.mockRejectedValueOnce(new Error(scopeAMarker));
      } else if (stateKind === "refreshError") {
        mockedGetRequests.mockRejectedValueOnce(new Error(scopeAMarker));
      }

      await act(async () => {
        view = create(<ForemanPayrollRequestsScreen {...props} />);
        await flushPromises();
      });
      if (stateKind === "successMessage" || stateKind === "approveError") {
        await act(async () => {
          findButton(view!, "Approve").props.onPress();
          await flushPromises();
        });
      } else if (stateKind === "refreshError") {
        await act(async () => {
          view!.root.findByType(RefreshControl).props.onRefresh();
          await flushPromises();
        });
      }
      expect(renderText(view!)).toContain(scopeAMarker);
      expect(renderText(view!)).toContain("Acme Construction");

      const scopeBLoad = deferred<PayoutRequest[]>();
      mockedGetRequests.mockReturnValueOnce(scopeBLoad.promise);
      mockedUseAuth.mockReturnValue({
        authenticatedRequest,
        user: nextForeman
      } as unknown as ReturnType<typeof useAuth>);

      let immediateScopeBTree = "";
      act(() => {
        updateSynchronously(view!, <ForemanPayrollRequestsScreen {...props} />);
        immediateScopeBTree = renderText(view!);
      });

      expect(immediateScopeBTree).toContain("Next Construction");
      expect(immediateScopeBTree).toContain("Loading requests");
      expect(immediateScopeBTree).not.toContain(scopeAMarker);
      expect(immediateScopeBTree).not.toContain("Worker30 Example");
      expect(immediateScopeBTree).not.toContain("Acme Construction");
      expect(view!.root.findAllByProps({ testID: "foreman-payroll-approve-30" })).toHaveLength(0);
    }
  );

  it("ignores a late scope A refresh after scope B renders", async () => {
    const lateScopeARefresh = deferred<PayoutRequest[]>();
    const scopeBLoad = deferred<PayoutRequest[]>();
    mockedGetRequests
      .mockResolvedValueOnce([requestFixture(31)])
      .mockReturnValueOnce(lateScopeARefresh.promise)
      .mockReturnValueOnce(scopeBLoad.promise);

    await act(async () => {
      view = create(<ForemanPayrollRequestsScreen {...props} />);
      await flushPromises();
    });
    act(() => void view!.root.findByType(RefreshControl).props.onRefresh());

    mockedUseAuth.mockReturnValue({
      authenticatedRequest,
      user: nextForeman
    } as unknown as ReturnType<typeof useAuth>);
    let immediateScopeBTree = "";
    act(() => {
      updateSynchronously(view!, <ForemanPayrollRequestsScreen {...props} />);
      immediateScopeBTree = renderText(view!);
    });
    expect(immediateScopeBTree).toContain("Next Construction");
    expect(immediateScopeBTree).not.toContain("Worker31 Example");

    await act(async () => {
      lateScopeARefresh.reject(new Error("late scope A refresh error"));
      await flushPromises();
    });
    expect(renderText(view!)).not.toContain("late scope A refresh error");
    expect(renderText(view!)).not.toContain("Worker31 Example");

    await act(async () => {
      scopeBLoad.resolve([
        requestFixture(32, "PENDING", {
          companyId: 11,
          companyName: "Next Construction"
        })
      ]);
      await flushPromises();
    });
    expect(renderText(view!)).toContain("Worker32 Example");
    expect(renderText(view!)).not.toContain("Worker31 Example");
  });

  it("shows distinct empty states for both filters", async () => {
    mockedGetRequests.mockResolvedValue([]);
    await act(async () => {
      view = create(<ForemanPayrollRequestsScreen {...props} />);
      await flushPromises();
    });
    expect(view!.root.findByProps({ testID: "foreman-payroll-empty-pending" })).toBeTruthy();

    pressSegment(view!, "APPROVED");
    await act(async () => {
      await flushPromises();
    });
    expect(view!.root.findByProps({ testID: "foreman-payroll-empty-approved" })).toBeTruthy();
  });

  it("reconciles a 409 conflict without sending another approve", async () => {
    const reconciliation = deferred<PayoutRequest[]>();
    mockedGetRequests
      .mockResolvedValueOnce([requestFixture(7)])
      .mockReturnValueOnce(reconciliation.promise);
    mockedApprove.mockRejectedValueOnce(new ApiError("Not pending", 409));

    await act(async () => {
      view = create(<ForemanPayrollRequestsScreen {...props} />);
      await flushPromises();
    });
    const savedApprove = findButton(view!, "Approve").props.onPress;
    act(() => void savedApprove());
    act(() => void savedApprove());
    expect(mockedApprove).toHaveBeenCalledTimes(1);

    await act(async () => {
      reconciliation.resolve([]);
      await flushPromises();
    });
    expect(mockedGetRequests).toHaveBeenLastCalledWith("foreman-token", "PENDING");
    expect(renderText(view!)).toContain("backend state changed");
    act(() => void savedApprove());
    expect(mockedApprove).toHaveBeenCalledTimes(1);
  });

  it("keeps a confirmed approve locked when the APPROVED refresh fails, then retries only GET", async () => {
    mockedGetRequests
      .mockResolvedValueOnce([requestFixture(8)])
      .mockRejectedValueOnce(new Error("approved list unavailable"))
      .mockResolvedValueOnce([requestFixture(8, "APPROVED")]);
    mockedApprove.mockResolvedValueOnce(requestFixture(8, "APPROVED"));

    await act(async () => {
      view = create(<ForemanPayrollRequestsScreen {...props} />);
      await flushPromises();
    });
    const savedApprove = findButton(view!, "Approve").props.onPress;
    await act(async () => {
      savedApprove();
      await flushPromises();
    });

    expect(mockedApprove).toHaveBeenCalledTimes(1);
    expect(view!.root.findByProps({ testID: "foreman-payroll-success" })).toBeTruthy();
    expect(view!.root.findByProps({ testID: "foreman-payroll-initial-error" })).toBeTruthy();
    act(() => void savedApprove());
    expect(mockedApprove).toHaveBeenCalledTimes(1);

    await act(async () => {
      findButton(view!, "Retry").props.onPress();
      await flushPromises();
    });
    expect(mockedApprove).toHaveBeenCalledTimes(1);
    expect(mockedGetRequests).toHaveBeenLastCalledWith("foreman-token", "APPROVED");
    expect(renderText(view!)).toContain("Worker8 Example");
    expect(renderText(view!)).toContain("Approved");
  });

  it("ignores a late response from the previous segment", async () => {
    const pendingLoad = deferred<PayoutRequest[]>();
    mockedGetRequests
      .mockReturnValueOnce(pendingLoad.promise)
      .mockResolvedValueOnce([requestFixture(10, "APPROVED")]);

    await act(async () => {
      view = create(<ForemanPayrollRequestsScreen {...props} />);
      await flushPromises();
    });
    pressSegment(view!, "APPROVED");
    await act(async () => {
      await flushPromises();
    });
    expect(renderText(view!)).toContain("Worker10 Example");

    await act(async () => {
      pendingLoad.resolve([requestFixture(9)]);
      await flushPromises();
    });
    expect(renderText(view!)).toContain("Worker10 Example");
    expect(renderText(view!)).not.toContain("Worker9 Example");
  });

  it.each([
    {
      label: "WORKER",
      user: { ...foreman, role: "WORKER" as const }
    },
    {
      label: "foreman without company",
      user: { ...foreman, company: null }
    }
  ])("blocks $label before any managed payroll request", async ({ user }) => {
    mockedUseAuth.mockReturnValue({
      authenticatedRequest,
      user
    } as unknown as ReturnType<typeof useAuth>);

    await act(async () => {
      view = create(<ForemanPayrollRequestsScreen {...props} />);
      await flushPromises();
    });
    expect(view!.root.findByProps({ testID: "foreman-payroll-access-gate" })).toBeTruthy();
    expect(mockedGetRequests).not.toHaveBeenCalled();
    expect(mockedApprove).not.toHaveBeenCalled();
  });

  it("uses an explicit accessible Back to dashboard action", async () => {
    await act(async () => {
      view = create(<ForemanPayrollRequestsScreen {...props} />);
      await flushPromises();
    });

    const backActions = view!.root.findAllByProps({
      accessibilityLabel: "Back to dashboard"
    });
    const back = backActions.find((action) => action.props.accessibilityRole === "button");
    expect(back).toBeTruthy();
    act(() => void back!.props.onPress());
    expect(navigation.navigate).toHaveBeenCalledWith("ForemanDashboard");
    expect(navigation.goBack).not.toHaveBeenCalled();
  });

  it("does not publish a late load after unmount", async () => {
    const load = deferred<PayoutRequest[]>();
    mockedGetRequests.mockReturnValueOnce(load.promise);
    await act(async () => {
      view = create(<ForemanPayrollRequestsScreen {...props} />);
      await flushPromises();
    });
    act(() => view?.unmount());
    view = null;

    await act(async () => {
      load.resolve([requestFixture(11)]);
      await flushPromises();
    });
    expect(mockedGetRequests).toHaveBeenCalledTimes(1);
  });
});
