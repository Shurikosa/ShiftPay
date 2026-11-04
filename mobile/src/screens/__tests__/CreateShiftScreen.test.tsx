import Ionicons from "@expo/vector-icons/Ionicons";
import type { ComponentProps } from "react";
import { ActivityIndicator, ScrollView, Text } from "react-native";
import { act, create, type ReactTestRenderer } from "react-test-renderer";
import { getMyCompany } from "../../api/companies";
import { ApiError } from "../../api/errors";
import { createShift } from "../../api/shifts";
import { Button } from "../../components/Button";
import { Feedback } from "../../components/Feedback";
import { FormField } from "../../components/FormField";
import { ScreenHeader } from "../../components/ScreenHeader";
import { useAuth } from "../../context/AuthContext";
import { useForemanManagedShifts } from "../../hooks/useForemanManagedShifts";
import type { User } from "../../types/auth";
import type { CompanySettingsResponse } from "../../types/company";
import { CreateShiftScreen } from "../CreateShiftScreen";

jest.mock("@expo/vector-icons/Ionicons", () => {
  const React = jest.requireActual<typeof import("react")>("react");
  const { Text: NativeText } = jest.requireActual<typeof import("react-native")>("react-native");
  const MockIonicons = (props: Record<string, unknown>) =>
    React.createElement(NativeText, props as ComponentProps<typeof NativeText>);
  return { __esModule: true, default: MockIonicons };
});
jest.mock("@react-navigation/native", () => {
  const React = jest.requireActual<typeof import("react")>("react");
  return { useFocusEffect: (effect: () => void | (() => void)) => React.useEffect(effect, [effect]) };
});
jest.mock("../../api/companies", () => ({ getMyCompany: jest.fn() }));
jest.mock("../../api/shifts", () => ({ createShift: jest.fn() }));
jest.mock("../../context/AuthContext", () => ({ useAuth: jest.fn() }));
jest.mock("../../hooks/useForemanManagedShifts", () => ({ useForemanManagedShifts: jest.fn() }));

const mockedGetMyCompany = jest.mocked(getMyCompany);
const mockedCreateShift = jest.mocked(createShift);
const mockedUseAuth = jest.mocked(useAuth);
const mockedUseForemanManagedShifts = jest.mocked(useForemanManagedShifts);

const navigation = { goBack: jest.fn(), replace: jest.fn() };
const props = {
  navigation,
  route: { key: "create-shift", name: "CreateShift" }
} as unknown as ComponentProps<typeof CreateShiftScreen>;

const foreman: User = {
  id: 5,
  email: "foreman@example.com",
  firstName: "Frank",
  lastName: "Foreman",
  role: "FOREMAN",
  company: {
    id: 10,
    name: "Acme Construction",
    joinCode: "CMP123",
    currencyLabel: "EUR",
    timeZone: "Europe/Berlin"
  }
};

function settings(overrides: Partial<CompanySettingsResponse> = {}): CompanySettingsResponse {
  return {
    id: 10,
    name: "Acme Construction",
    joinCode: "CMP123",
    currencyLabel: "EUR",
    defaultWorkerHourlyRate: 20,
    defaultForemanHourlyRate: 30,
    timeZone: "Europe/Berlin",
    ...overrides
  };
}

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((resolvePromise, rejectPromise) => {
    resolve = resolvePromise;
    reject = rejectPromise;
  });
  return { promise, reject, resolve };
}

async function flush(): Promise<void> {
  await Promise.resolve();
  await Promise.resolve();
  await Promise.resolve();
  await Promise.resolve();
}

function field(renderer: ReactTestRenderer, label: string) {
  const result = renderer.root
    .findAllByType(FormField)
    .find((item) => item.props.label.startsWith(label));
  if (!result) throw new Error(`Missing ${label}`);
  return result;
}

function button(renderer: ReactTestRenderer, label: string) {
  const result = renderer.root
    .findAllByType(Button)
    .find((item) => item.props.label === label);
  if (!result) throw new Error(`Missing ${label}`);
  return result;
}

function output(renderer: ReactTestRenderer): string {
  return renderer.root
    .findAllByType(Text)
    .flatMap((node) => node.props.children)
    .filter((value): value is string | number => typeof value === "string" || typeof value === "number")
    .join(" ");
}

describe("CreateShiftScreen", () => {
  let renderer: ReactTestRenderer | null = null;
  let authenticatedRequest: jest.Mock;
  let refresh: jest.Mock;

  beforeAll(() => {
    (globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  });

  beforeEach(() => {
    jest.clearAllMocks();
    mockedGetMyCompany.mockResolvedValue(settings());
    mockedCreateShift.mockResolvedValue({ id: 99 } as Awaited<ReturnType<typeof createShift>>);
    refresh = jest.fn().mockResolvedValue(undefined);
    mockedUseForemanManagedShifts.mockReturnValue({ refresh } as never);
    authenticatedRequest = jest.fn((request: (token: string) => Promise<unknown>) => request("token"));
    mockedUseAuth.mockReturnValue({ user: foreman, authenticatedRequest } as unknown as ReturnType<typeof useAuth>);
  });

  afterEach(() => {
    act(() => renderer?.unmount());
    renderer = null;
  });

  async function renderScreen({ settle = true }: { settle?: boolean } = {}): Promise<ReactTestRenderer> {
    await act(async () => {
      renderer = create(<CreateShiftScreen {...props} />);
      if (settle) await flush();
    });
    return renderer!;
  }

  it("blocks the form until company settings load and provides a scrollable keyboard-safe header", async () => {
    const pending = deferred<CompanySettingsResponse>();
    mockedGetMyCompany.mockReturnValueOnce(pending.promise);
    const view = await renderScreen({ settle: false });

    expect(view.root.findAllByType(FormField)).toHaveLength(0);
    expect(view.root.findAllByType(ActivityIndicator)).toHaveLength(1);
    expect(view.root.findByType(ScreenHeader).props).toMatchObject({ title: "Create shift" });
    expect(view.root.findByType(ScrollView).props).toMatchObject({
      horizontal: false,
      keyboardDismissMode: "on-drag",
      keyboardShouldPersistTaps: "handled",
      scrollEnabled: true,
      testID: "create-shift-scroll"
    });

    await act(async () => {
      pending.resolve(settings());
      await flush();
    });
    expect(view.root.findAllByType(FormField)).toHaveLength(4);
  });

  it("shows settings failure with a retry that only reloads settings", async () => {
    mockedGetMyCompany.mockRejectedValueOnce(new Error("Settings offline."));
    const view = await renderScreen();
    expect(view.root.findByProps({ testID: "create-shift-settings-error" })).toBeDefined();
    expect(view.root.findAllByType(FormField)).toHaveLength(0);

    mockedGetMyCompany.mockResolvedValueOnce(settings());
    await act(async () => {
      button(view, "Retry").props.onPress();
      await flush();
    });
    expect(mockedGetMyCompany).toHaveBeenCalledTimes(2);
    expect(mockedCreateShift).not.toHaveBeenCalled();
    expect(field(view, "Worker hourly rate").props.value).toBe("20");
  });

  it("shows returned company context, exact label and independent defaults without timezone", async () => {
    mockedGetMyCompany.mockResolvedValueOnce(settings({ defaultForemanHourlyRate: null }));
    const view = await renderScreen();
    expect(output(view)).toContain("Acme Construction");
    expect(output(view)).toContain("Currency label:");
    expect(output(view)).toContain("EUR");
    expect(output(view)).toContain("20 EUR");
    expect(output(view)).toContain("No company default");
    expect(output(view)).not.toContain("Europe/Berlin");
    expect(field(view, "Worker hourly rate").props.value).toBe("20");
    expect(field(view, "Foreman hourly rate").props.value).toBe("");
  });

  it("does not let a later settings refresh overwrite either user-edited rate", async () => {
    const view = await renderScreen();
    const savedSubmit = button(view, "Create shift").props.onPress;
    act(() => {
      field(view, "Worker hourly rate").props.onChangeText("17");
      field(view, "Foreman hourly rate").props.onChangeText("27");
    });

    const pending = deferred<CompanySettingsResponse>();
    const nextAuthenticatedRequest = jest.fn((request: (token: string) => Promise<unknown>) => request("token"));
    mockedGetMyCompany.mockReturnValueOnce(pending.promise);
    mockedUseAuth.mockReturnValue({ user: foreman, authenticatedRequest: nextAuthenticatedRequest } as unknown as ReturnType<typeof useAuth>);
    await act(async () => {
      renderer!.update(<CreateShiftScreen {...props} />);
      await Promise.resolve();
    });
    expect(view.root.findAllByType(FormField)).toHaveLength(0);
    act(() => void savedSubmit());
    expect(mockedCreateShift).not.toHaveBeenCalled();

    await act(async () => {
      pending.resolve(settings({ defaultWorkerHourlyRate: 40, defaultForemanHourlyRate: 50 }));
      await flush();
    });
    expect(field(view, "Worker hourly rate").props.value).toBe("17");
    expect(field(view, "Foreman hourly rate").props.value).toBe("27");
  });

  it("ignores an older settings response when a newer request wins", async () => {
    const view = await renderScreen();
    const older = deferred<CompanySettingsResponse>();
    const newer = deferred<CompanySettingsResponse>();

    mockedGetMyCompany.mockReturnValueOnce(older.promise).mockReturnValueOnce(newer.promise);
    mockedUseAuth.mockReturnValue({ user: foreman, authenticatedRequest: jest.fn((request: (token: string) => Promise<unknown>) => request("token")) } as unknown as ReturnType<typeof useAuth>);
    await act(async () => {
      renderer!.update(<CreateShiftScreen {...props} />);
      await Promise.resolve();
    });
    mockedUseAuth.mockReturnValue({ user: foreman, authenticatedRequest: jest.fn((request: (token: string) => Promise<unknown>) => request("token")) } as unknown as ReturnType<typeof useAuth>);
    await act(async () => {
      renderer!.update(<CreateShiftScreen {...props} />);
      await Promise.resolve();
    });
    await act(async () => {
      newer.resolve(settings({ defaultWorkerHourlyRate: 52 }));
      await flush();
    });
    await act(async () => {
      older.resolve(settings({ defaultWorkerHourlyRate: 41 }));
      await flush();
    });
    expect(field(view, "Worker hourly rate").props.value).toBe("52");
  });

  it("omits each blank override only when its matching company default exists", async () => {
    const view = await renderScreen();
    act(() => {
      field(view, "Location").props.onChangeText("  Yard 7  ");
      field(view, "Worker hourly rate").props.onChangeText("");
      field(view, "Foreman hourly rate").props.onChangeText("");
    });
    await act(async () => {
      button(view, "Create shift").props.onPress();
      await flush();
    });
    expect(mockedCreateShift).toHaveBeenCalledWith("token", { location: "Yard 7" });
  });

  it("sends explicit zero for both rate overrides and break minutes", async () => {
    const view = await renderScreen();
    act(() => {
      field(view, "Default break minutes").props.onChangeText("0");
      field(view, "Worker hourly rate").props.onChangeText("0");
      field(view, "Foreman hourly rate").props.onChangeText("0");
    });
    await act(async () => {
      button(view, "Create shift").props.onPress();
      await flush();
    });
    expect(mockedCreateShift).toHaveBeenCalledWith("token", {
      location: "",
      defaultBreakMinutes: 0,
      defaultHourlyRate: 0,
      foremanHourlyRate: 0
    });
  });

  it.each([
    ["worker", { defaultWorkerHourlyRate: null }, "Worker hourly rate", "Enter a worker rate or set a company default."],
    ["foreman", { defaultForemanHourlyRate: null }, "Foreman hourly rate", "Enter a foreman rate or set a company default."]
  ] as const)("blocks a blank %s rate when its matching default is absent", async (_kind, overrides, label, message) => {
    mockedGetMyCompany.mockResolvedValueOnce(settings(overrides));
    const view = await renderScreen();
    act(() => void button(view, "Create shift").props.onPress());
    expect(field(view, label).props.error).toBe(message);
    expect(mockedCreateShift).not.toHaveBeenCalled();
  });

  it.each(["abc", ".", "-1", "10.123"])("blocks invalid rate input %s", async (value) => {
    const view = await renderScreen();
    act(() => void field(view, "Worker hourly rate").props.onChangeText(value));
    act(() => void button(view, "Create shift").props.onPress());
    expect(field(view, "Worker hourly rate").props.error).toBe("Use a non-negative rate with up to two decimal places.");
    expect(mockedCreateShift).not.toHaveBeenCalled();
  });

  it.each(["-1", "1.5", "break"])("blocks invalid break minutes %s", async (value) => {
    const view = await renderScreen();
    act(() => void field(view, "Default break minutes").props.onChangeText(value));
    act(() => void button(view, "Create shift").props.onPress());
    expect(field(view, "Default break minutes").props.error).toBe("Enter a whole number 0 or greater.");
    expect(mockedCreateShift).not.toHaveBeenCalled();
  });

  it("retains input after a server error and permits a direct retry", async () => {
    mockedCreateShift.mockRejectedValueOnce(new Error("Server unavailable."));
    const view = await renderScreen();
    act(() => void field(view, "Location").props.onChangeText("North site"));
    await act(async () => {
      button(view, "Create shift").props.onPress();
      await flush();
    });
    expect(view.root.findByType(Feedback).props).not.toBeUndefined();
    expect(view.root.findByProps({ testID: "create-shift-submit-error" })).toBeDefined();
    expect(field(view, "Location").props.value).toBe("North site");

    await act(async () => {
      button(view, "Create shift").props.onPress();
      await flush();
    });
    expect(mockedCreateShift).toHaveBeenCalledTimes(2);
    expect(navigation.replace).toHaveBeenCalledWith("ForemanShiftDetails", { shiftId: 99 });
  });

  it("locks duplicate submit, disables the form, then navigates with the returned shift id", async () => {
    const pending = deferred<Awaited<ReturnType<typeof createShift>>>();
    mockedCreateShift.mockReturnValueOnce(pending.promise);
    const view = await renderScreen();
    const savedSubmit = button(view, "Create shift").props.onPress;

    await act(async () => {
      savedSubmit();
      savedSubmit();
      await Promise.resolve();
    });
    expect(mockedCreateShift).toHaveBeenCalledTimes(1);
    expect(field(view, "Location").props.editable).toBe(false);
    expect(button(view, "Create shift").props.loading).toBe(true);
    expect(button(view, "Cancel").props.disabled).toBe(true);

    await act(async () => {
      pending.resolve({ id: 707 } as Awaited<ReturnType<typeof createShift>>);
      await flush();
    });
    expect(refresh).toHaveBeenCalledTimes(1);
    expect(navigation.replace).toHaveBeenCalledWith("ForemanShiftDetails", { shiftId: 707 });
    expect(view.root.findByProps({ testID: "create-shift-success" })).toBeDefined();
  });

  it("routes null and stale currency labels to Company Settings without inventing a label", async () => {
    mockedGetMyCompany.mockResolvedValueOnce(settings({ currencyLabel: null }));
    const nullLabelView = await renderScreen();
    expect(navigation.replace).toHaveBeenCalledWith("ForemanCompanySettings", {
      notice: "Company currency label must be configured before creating a shift."
    });
    expect(output(nullLabelView)).not.toContain("currency unavailable");
    act(() => nullLabelView.unmount());
    renderer = null;
    navigation.replace.mockClear();

    mockedGetMyCompany.mockResolvedValueOnce(settings());
    mockedCreateShift.mockRejectedValueOnce(new ApiError("currency label must be configured", 409));
    const conflictView = await renderScreen();
    await act(async () => {
      button(conflictView, "Create shift").props.onPress();
      await flush();
    });
    expect(navigation.replace).toHaveBeenCalledWith("ForemanCompanySettings", {
      notice: "currency label must be configured"
    });
  });

  it("does not update or navigate after unmount during settings or create", async () => {
    const settingsPending = deferred<CompanySettingsResponse>();
    mockedGetMyCompany.mockReturnValueOnce(settingsPending.promise);
    await renderScreen({ settle: false });
    act(() => renderer!.unmount());
    renderer = null;
    await act(async () => {
      settingsPending.resolve(settings({ currencyLabel: null }));
      await flush();
    });
    expect(navigation.replace).not.toHaveBeenCalled();

    const createPending = deferred<Awaited<ReturnType<typeof createShift>>>();
    mockedGetMyCompany.mockResolvedValueOnce(settings());
    mockedCreateShift.mockReturnValueOnce(createPending.promise);
    const view = await renderScreen();
    await act(async () => {
      button(view, "Create shift").props.onPress();
      await Promise.resolve();
    });
    act(() => view.unmount());
    renderer = null;
    await act(async () => {
      createPending.resolve({ id: 808 } as Awaited<ReturnType<typeof createShift>>);
      await flush();
    });
    expect(navigation.replace).not.toHaveBeenCalled();
    expect(refresh).not.toHaveBeenCalled();
  });

  it.each([
    ["foreman without a company", { ...foreman, company: null }, "Company required"],
    ["worker with a company", { ...foreman, role: "WORKER" as const }, "Foreman access required"]
  ])("enforces the %s gate before loading settings", async (_case, user, gateTitle) => {
    mockedUseAuth.mockReturnValue({ user, authenticatedRequest } as unknown as ReturnType<typeof useAuth>);
    const view = await renderScreen();
    expect(output(view)).toContain(gateTitle);
    expect(view.root.findAllByType(FormField)).toHaveLength(0);
    expect(mockedGetMyCompany).not.toHaveBeenCalled();
    act(() => void view.root.findByType(ScreenHeader).props.backAction.onPress());
    expect(navigation.goBack).toHaveBeenCalledTimes(1);
  });

  it("exposes named actions and no unsupported planned-time or title fields", async () => {
    const view = await renderScreen();
    expect(view.root.findAllByType(Ionicons).length).toBeGreaterThan(0);
    expect(button(view, "Create shift").props.accessibilityHint).toContain("Creates this shift");
    expect(button(view, "Cancel").props.label).toBe("Cancel");
    expect(view.root.findByType(ScreenHeader).props.backAction.label).toBe("Back");
    expect(view.root.findAllByType(FormField).map((item) => item.props.label)).toEqual([
      "Location",
      "Default break minutes",
      "Worker hourly rate (EUR)",
      "Foreman hourly rate (EUR)"
    ]);
    expect(output(view)).not.toContain("Planned start");
    expect(output(view)).not.toContain("Planned end");
    expect(output(view)).not.toContain("Shift title");
  });
});
