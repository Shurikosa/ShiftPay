import type { ComponentProps } from "react";
import { Text } from "react-native";
import { act, create, type ReactTestRenderer } from "react-test-renderer";
import { getMyCompany, updateMyCompany } from "../../api/companies";
import { Button } from "../../components/Button";
import { FormField } from "../../components/FormField";
import { useAuth } from "../../context/AuthContext";
import type { User } from "../../types/auth";
import type { CompanySettingsResponse } from "../../types/company";
import { ForemanCompanySettingsScreen } from "../ForemanCompanySettingsScreen";

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
jest.mock("../../api/companies", () => ({
  getMyCompany: jest.fn(),
  updateMyCompany: jest.fn()
}));
jest.mock("../../context/AuthContext", () => ({ useAuth: jest.fn() }));

const mockedGetMyCompany = jest.mocked(getMyCompany);
const mockedUpdateMyCompany = jest.mocked(updateMyCompany);
const mockedUseAuth = jest.mocked(useAuth);

const settings: CompanySettingsResponse = {
  id: 10,
  name: "Acme Construction",
  joinCode: "CMP123",
  currencyLabel: "EUR",
  defaultWorkerHourlyRate: 20,
  defaultForemanHourlyRate: 30,
  timeZone: "Europe/Berlin"
};

const foreman: User = {
  id: 5,
  email: "foreman@example.com",
  firstName: "Fran",
  lastName: "Foreman",
  role: "FOREMAN",
  company: {
    id: settings.id,
    name: settings.name,
    joinCode: settings.joinCode,
    currencyLabel: settings.currencyLabel,
    timeZone: settings.timeZone
  }
};

const nextForeman: User = {
  ...foreman,
  id: 6,
  email: "next@example.com",
  company: {
    ...foreman.company!,
    id: 11,
    name: "Next Company"
  }
};

type Props = ComponentProps<typeof ForemanCompanySettingsScreen>;
const navigation = { goBack: jest.fn(), navigate: jest.fn() };
const props = {
  navigation,
  route: { key: "settings", name: "ForemanCompanySettings", params: undefined }
} as unknown as Props;

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

function company(overrides: Partial<CompanySettingsResponse> = {}) {
  return { ...settings, ...overrides };
}

async function flush(): Promise<void> {
  for (let step = 0; step < 10; step += 1) {
    await Promise.resolve();
  }
}

function renderedText(renderer: ReactTestRenderer): string {
  return renderer.root
    .findAllByType(Text)
    .map((node) => node.props.children)
    .flat(Infinity)
    .filter((value) => typeof value === "string" || typeof value === "number")
    .join(" ")
    .replace(/\s+/gu, " ");
}

function findField(renderer: ReactTestRenderer, label: string) {
  const field = renderer.root
    .findAllByType(FormField)
    .find((candidate) => candidate.props.label === label);
  if (!field) throw new Error(`Field not found: ${label}`);
  return field;
}

function findButton(renderer: ReactTestRenderer, label: string) {
  const button = renderer.root
    .findAllByType(Button)
    .find((candidate) => candidate.props.label === label);
  if (!button) throw new Error(`Button not found: ${label}`);
  return button;
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

describe("ForemanCompanySettingsScreen", () => {
  let renderer: ReactTestRenderer | null = null;
  let authenticatedRequest: jest.Mock;
  let applyCompany: jest.Mock;
  let refreshCurrentUser: jest.Mock;

  beforeAll(() => {
    (
      globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }
    ).IS_REACT_ACT_ENVIRONMENT = true;
  });

  beforeEach(() => {
    jest.clearAllMocks();
    mockedGetMyCompany.mockReset();
    mockedUpdateMyCompany.mockReset();
    mockedUseAuth.mockReset();
    mockFocusCallback = null;
    mockFocusCleanup = null;
    authenticatedRequest = jest.fn(
      (request: (token: string) => Promise<unknown>) => request("token")
    );
    applyCompany = jest.fn().mockResolvedValue(undefined);
    refreshCurrentUser = jest.fn().mockResolvedValue(foreman);
    mockedGetMyCompany.mockResolvedValue(settings);
    mockedUpdateMyCompany.mockResolvedValue(settings);
    mockedUseAuth.mockReturnValue({
      authenticatedRequest,
      applyCompany,
      refreshCurrentUser,
      user: foreman
    } as unknown as ReturnType<typeof useAuth>);
  });

  afterEach(() => {
    if (renderer) act(() => renderer?.unmount());
    renderer = null;
  });

  it("blocks the form until GET resolves and groups editable and read-only settings", async () => {
    const load = deferred<CompanySettingsResponse>();
    mockedGetMyCompany.mockReturnValueOnce(load.promise);
    await act(async () => {
      renderer = create(<ForemanCompanySettingsScreen {...props} />);
      await flush();
    });

    expect(renderer!.root.findByProps({ testID: "company-settings-loading" })).toBeTruthy();
    expect(renderer!.root.findAllByType(FormField)).toHaveLength(0);
    expect(mockedGetMyCompany).toHaveBeenCalledWith("token");

    await act(async () => {
      load.resolve(settings);
      await flush();
    });
    const text = renderedText(renderer!);
    expect(text).toContain("Company identity");
    expect(text).toContain("Currency and localization");
    expect(text).toContain("Default hourly rates");
    expect(text).toContain("Company details");
    expect(text).toContain("CMP123");
    expect(text).toContain("Europe/Berlin");
    expect(findField(renderer!, "Company name").props.value).toBe("Acme Construction");
    expect(findButton(renderer!, "Save company settings").props.disabled).toBe(true);
  });

  it("retries a failed blocking GET", async () => {
    mockedGetMyCompany
      .mockRejectedValueOnce(new Error("settings offline"))
      .mockResolvedValueOnce(settings);
    await act(async () => {
      renderer = create(<ForemanCompanySettingsScreen {...props} />);
      await flush();
    });

    expect(renderer!.root.findByProps({ testID: "company-settings-load-error" })).toBeTruthy();
    await act(async () => {
      findButton(renderer!, "Retry").props.onPress();
      await flush();
    });
    expect(mockedGetMyCompany).toHaveBeenCalledTimes(2);
    expect(findField(renderer!, "Company name").props.value).toBe("Acme Construction");
  });

  it("preserves the exact currency-label boundary algorithm and Unicode code-point limit", async () => {
    await act(async () => {
      renderer = create(<ForemanCompanySettingsScreen {...props} />);
      await flush();
    });
    const label = "\u00A0MiXeD\u2007Label\u200B\u3000";
    act(() => void findField(renderer!, "Currency label").props.onChangeText(label));
    await act(async () => {
      findButton(renderer!, "Save company settings").props.onPress();
      await flush();
    });
    expect(mockedUpdateMyCompany).toHaveBeenCalledWith("token", {
      name: "Acme Construction",
      currencyLabel: "MiXeD\u2007Label\u200B",
      defaultWorkerHourlyRate: 20,
      defaultForemanHourlyRate: 30
    });

    act(() => void findField(renderer!, "Currency label").props.onChangeText("😀".repeat(65)));
    act(() => void findButton(renderer!, "Save company settings").props.onPress());
    expect(findField(renderer!, "Currency label").props.error).toBe(
      "Use 64 Unicode characters or fewer."
    );
  });

  it.each([
    "\u0009\u000A\u000B\u000C\u000D",
    "\u0020\u0085\u00A0\u1680",
    "\u2000\u2001\u2002\u2003\u2004\u2005\u2006\u2007\u2008\u2009\u200A",
    "\u2028\u2029\u202F\u205F\u3000"
  ])("rejects boundary-only currency input %p", async (boundaryOnly) => {
    await act(async () => {
      renderer = create(<ForemanCompanySettingsScreen {...props} />);
      await flush();
    });
    act(() => void findField(renderer!, "Currency label").props.onChangeText(boundaryOnly));
    act(() => void findButton(renderer!, "Save company settings").props.onPress());
    expect(findField(renderer!, "Currency label").props.error).toBe(
      "Enter a currency label."
    );
    expect(mockedUpdateMyCompany).not.toHaveBeenCalled();
  });

  it("requires a migrated null label and never invents a replacement", async () => {
    mockedGetMyCompany.mockResolvedValueOnce(company({ currencyLabel: null }));
    await act(async () => {
      renderer = create(<ForemanCompanySettingsScreen {...props} />);
      await flush();
    });

    expect(renderer!.root.findByProps({ testID: "company-settings-null-label" })).toBeTruthy();
    expect(findField(renderer!, "Currency label").props.value).toBe("");
    expect(findButton(renderer!, "Save company settings").props.disabled).toBe(false);
    act(() => void findButton(renderer!, "Save company settings").props.onPress());
    expect(findField(renderer!, "Currency label").props.error).toBe(
      "Enter a currency label."
    );
    expect(mockedUpdateMyCompany).not.toHaveBeenCalled();
    expect(renderedText(renderer!)).toContain("Existing history remains unchanged");
  });

  it("sends independent nullable defaults and preserves explicit zero", async () => {
    mockedUpdateMyCompany.mockResolvedValueOnce(
      company({ defaultWorkerHourlyRate: null, defaultForemanHourlyRate: 0 })
    );
    await act(async () => {
      renderer = create(<ForemanCompanySettingsScreen {...props} />);
      await flush();
    });
    act(() => {
      findField(renderer!, "Default worker hourly rate").props.onChangeText("");
      findField(renderer!, "Default foreman hourly rate").props.onChangeText("0");
    });
    await act(async () => {
      findButton(renderer!, "Save company settings").props.onPress();
      await flush();
    });
    expect(mockedUpdateMyCompany).toHaveBeenCalledWith("token", {
      name: "Acme Construction",
      currencyLabel: "EUR",
      defaultWorkerHourlyRate: null,
      defaultForemanHourlyRate: 0
    });
  });

  it("shows local rate errors without sending PUT", async () => {
    await act(async () => {
      renderer = create(<ForemanCompanySettingsScreen {...props} />);
      await flush();
    });
    act(() => {
      findField(renderer!, "Default worker hourly rate").props.onChangeText("-1");
      findField(renderer!, "Default foreman hourly rate").props.onChangeText("1.234");
    });
    act(() => void findButton(renderer!, "Save company settings").props.onPress());
    expect(findField(renderer!, "Default worker hourly rate").props.error).toContain(
      "non-negative"
    );
    expect(findField(renderer!, "Default foreman hourly rate").props.error).toContain(
      "two decimal"
    );
    expect(mockedUpdateMyCompany).not.toHaveBeenCalled();
  });

  it("maps backend field validation and presents a general server error", async () => {
    mockedUpdateMyCompany
      .mockRejectedValueOnce(new Error("currencyLabel: backend label rejection"))
      .mockRejectedValueOnce(new Error("settings service unavailable"));
    await act(async () => {
      renderer = create(<ForemanCompanySettingsScreen {...props} />);
      await flush();
    });
    act(() => void findField(renderer!, "Currency label").props.onChangeText("USD"));
    await act(async () => {
      findButton(renderer!, "Save company settings").props.onPress();
      await flush();
    });
    expect(findField(renderer!, "Currency label").props.error).toBe(
      "backend label rejection"
    );

    act(() => void findField(renderer!, "Currency label").props.onChangeText("GBP"));
    await act(async () => {
      findButton(renderer!, "Save company settings").props.onPress();
      await flush();
    });
    expect(renderer!.root.findByProps({ testID: "company-settings-save-error" })).toBeTruthy();
    expect(renderedText(renderer!)).toContain("settings service unavailable");
  });

  it("tracks dirty state, locks duplicate saves, and publishes saved feedback", async () => {
    const save = deferred<CompanySettingsResponse>();
    mockedUpdateMyCompany.mockReturnValueOnce(save.promise);
    await act(async () => {
      renderer = create(<ForemanCompanySettingsScreen {...props} />);
      await flush();
    });
    act(() => void findField(renderer!, "Company name").props.onChangeText("Acme GmbH"));
    expect(renderer!.root.findByProps({ testID: "company-settings-dirty" })).toBeTruthy();
    const saveAction = findButton(renderer!, "Save company settings").props.onPress;
    act(() => {
      saveAction();
      saveAction();
    });
    expect(mockedUpdateMyCompany).toHaveBeenCalledTimes(1);
    expect(findButton(renderer!, "Save company settings").props.loading).toBe(true);

    await act(async () => {
      save.resolve(company({ name: "Acme GmbH" }));
      await flush();
    });
    expect(renderer!.root.findByProps({ testID: "company-settings-success" })).toBeTruthy();
    expect(renderer!.root.findAllByProps({ testID: "company-settings-dirty" })).toHaveLength(0);
    expect(applyCompany).toHaveBeenCalledWith(company({ name: "Acme GmbH" }));
    expect(refreshCurrentUser).toHaveBeenCalledTimes(1);
  });

  it("does not overwrite dirty form state on blur and refocus", async () => {
    await act(async () => {
      renderer = create(<ForemanCompanySettingsScreen {...props} />);
      await flush();
    });
    act(() => void findField(renderer!, "Company name").props.onChangeText("Draft company"));
    act(blurScreen);
    act(refocusScreen);
    await act(async () => flush());

    expect(mockedGetMyCompany).toHaveBeenCalledTimes(1);
    expect(findField(renderer!, "Company name").props.value).toBe("Draft company");
    expect(renderer!.root.findByProps({ testID: "company-settings-dirty" })).toBeTruthy();
  });

  it("ignores a pre-save background GET that resolves after PUT success", async () => {
    const backgroundLoad = deferred<CompanySettingsResponse>();
    const save = deferred<CompanySettingsResponse>();
    mockedGetMyCompany
      .mockResolvedValueOnce(settings)
      .mockReturnValueOnce(backgroundLoad.promise);
    mockedUpdateMyCompany.mockReturnValueOnce(save.promise);

    await act(async () => {
      renderer = create(<ForemanCompanySettingsScreen {...props} />);
      await flush();
    });
    act(blurScreen);
    act(refocusScreen);
    act(() => void findField(renderer!, "Company name").props.onChangeText("Saved company"));
    act(() => void findButton(renderer!, "Save company settings").props.onPress());

    await act(async () => {
      save.resolve(company({ name: "Saved company", defaultWorkerHourlyRate: 44 }));
      await flush();
    });
    expect(findField(renderer!, "Company name").props.value).toBe("Saved company");
    expect(findField(renderer!, "Default worker hourly rate").props.value).toBe("44");
    expect(renderer!.root.findByProps({ testID: "company-settings-success" })).toBeTruthy();

    await act(async () => {
      backgroundLoad.resolve(company({ name: "Pre-save company", defaultWorkerHourlyRate: 9 }));
      await flush();
    });
    expect(findField(renderer!, "Company name").props.value).toBe("Saved company");
    expect(findField(renderer!, "Default worker hourly rate").props.value).toBe("44");
    expect(renderer!.root.findByProps({ testID: "company-settings-success" })).toBeTruthy();
  });

  it("ignores a pre-save GET that resolves while PUT is pending", async () => {
    const backgroundLoad = deferred<CompanySettingsResponse>();
    const save = deferred<CompanySettingsResponse>();
    mockedGetMyCompany
      .mockResolvedValueOnce(settings)
      .mockReturnValueOnce(backgroundLoad.promise);
    mockedUpdateMyCompany.mockReturnValueOnce(save.promise);

    await act(async () => {
      renderer = create(<ForemanCompanySettingsScreen {...props} />);
      await flush();
    });
    act(blurScreen);
    act(refocusScreen);
    act(() => void findField(renderer!, "Company name").props.onChangeText("Pending save"));
    act(() => void findButton(renderer!, "Save company settings").props.onPress());

    await act(async () => {
      backgroundLoad.resolve(company({ name: "Old GET value" }));
      await flush();
    });
    expect(findField(renderer!, "Company name").props.value).toBe("Pending save");
    expect(findButton(renderer!, "Save company settings").props.loading).toBe(true);

    await act(async () => {
      save.resolve(company({ name: "Pending save" }));
      await flush();
    });
    expect(findField(renderer!, "Company name").props.value).toBe("Pending save");
  });

  it("publishes confirmed save when refocused before applyCompany finishes", async () => {
    const save = deferred<CompanySettingsResponse>();
    const applied = deferred<void>();
    const refreshed = deferred<User>();
    const updated = company({ name: "Blurred save", defaultWorkerHourlyRate: 55 });
    mockedGetMyCompany
      .mockResolvedValueOnce(settings)
      .mockRejectedValueOnce(new Error("reconciliation offline"))
      .mockResolvedValueOnce(updated);
    mockedUpdateMyCompany.mockReturnValueOnce(save.promise);
    applyCompany.mockReturnValueOnce(applied.promise);
    refreshCurrentUser.mockReturnValueOnce(refreshed.promise);

    await act(async () => {
      renderer = create(<ForemanCompanySettingsScreen {...props} />);
      await flush();
    });
    act(() => void findField(renderer!, "Company name").props.onChangeText("Blurred save"));
    act(() => void findField(renderer!, "Default worker hourly rate").props.onChangeText("55"));
    const savedSaveAction = findButton(renderer!, "Save company settings").props.onPress;
    act(() => void savedSaveAction());
    act(blurScreen);

    await act(async () => {
      save.resolve(updated);
      await flush();
    });
    expect(applyCompany).toHaveBeenCalledWith(updated);
    expect(refreshCurrentUser).not.toHaveBeenCalled();

    await act(async () => {
      refocusScreen();
      await flush();
    });

    expect(findField(renderer!, "Company name").props.value).toBe("Blurred save");
    expect(findField(renderer!, "Default worker hourly rate").props.value).toBe("55");
    expect(renderer!.root.findAllByProps({ testID: "company-settings-dirty" })).toHaveLength(0);
    expect(renderer!.root.findByProps({ testID: "company-settings-success" })).toBeTruthy();
    expect(findButton(renderer!, "Save company settings").props.disabled).toBe(true);
    act(() => void savedSaveAction());
    expect(mockedUpdateMyCompany).toHaveBeenCalledTimes(1);
    expect(mockedGetMyCompany).toHaveBeenCalledTimes(1);

    await act(async () => {
      applied.resolve();
      await flush();
    });
    expect(refreshCurrentUser).toHaveBeenCalledTimes(1);
    await act(async () => {
      refreshed.resolve(foreman);
      await flush();
    });

    expect(renderer!.root.findByProps({ testID: "company-settings-refresh-error" })).toBeTruthy();
    expect(mockedUpdateMyCompany).toHaveBeenCalledTimes(1);

    await act(async () => {
      findButton(renderer!, "Retry load").props.onPress();
      await flush();
    });
    expect(mockedUpdateMyCompany).toHaveBeenCalledTimes(1);
    expect(mockedGetMyCompany).toHaveBeenCalledTimes(3);
    expect(findField(renderer!, "Company name").props.value).toBe("Blurred save");
    expect(renderer!.root.findAllByProps({ testID: "company-settings-dirty" })).toHaveLength(0);
  });

  it("publishes confirmed save when refocused between applyCompany and refreshCurrentUser", async () => {
    const save = deferred<CompanySettingsResponse>();
    const applied = deferred<void>();
    const refreshed = deferred<User>();
    const updated = company({ name: "Applied while blurred", defaultForemanHourlyRate: 61 });
    mockedGetMyCompany
      .mockResolvedValueOnce(settings)
      .mockRejectedValueOnce(new Error("reconciliation offline"))
      .mockResolvedValueOnce(updated);
    mockedUpdateMyCompany.mockReturnValueOnce(save.promise);
    applyCompany.mockReturnValueOnce(applied.promise);
    refreshCurrentUser.mockReturnValueOnce(refreshed.promise);

    await act(async () => {
      renderer = create(<ForemanCompanySettingsScreen {...props} />);
      await flush();
    });
    act(() => void findField(renderer!, "Company name").props.onChangeText(updated.name));
    act(() =>
      void findField(renderer!, "Default foreman hourly rate").props.onChangeText("61")
    );
    const savedSaveAction = findButton(renderer!, "Save company settings").props.onPress;
    act(() => void savedSaveAction());
    act(blurScreen);

    await act(async () => {
      save.resolve(updated);
      await flush();
      applied.resolve();
      await flush();
    });
    expect(refreshCurrentUser).toHaveBeenCalledTimes(1);

    await act(async () => {
      refocusScreen();
      await flush();
    });
    expect(findField(renderer!, "Company name").props.value).toBe(updated.name);
    expect(findField(renderer!, "Default foreman hourly rate").props.value).toBe("61");
    expect(renderer!.root.findAllByProps({ testID: "company-settings-dirty" })).toHaveLength(0);
    expect(renderer!.root.findByProps({ testID: "company-settings-success" })).toBeTruthy();
    act(() => void savedSaveAction());
    expect(mockedUpdateMyCompany).toHaveBeenCalledTimes(1);
    expect(mockedGetMyCompany).toHaveBeenCalledTimes(1);

    await act(async () => {
      refreshed.resolve(foreman);
      await flush();
    });
    expect(renderer!.root.findByProps({ testID: "company-settings-refresh-error" })).toBeTruthy();

    await act(async () => {
      findButton(renderer!, "Retry load").props.onPress();
      await flush();
    });
    expect(mockedUpdateMyCompany).toHaveBeenCalledTimes(1);
    expect(findField(renderer!, "Company name").props.value).toBe(updated.name);
    expect(renderer!.root.findAllByProps({ testID: "company-settings-dirty" })).toHaveLength(0);
  });

  it("retains confirmed save until refocus after both post-PUT sync awaits", async () => {
    const save = deferred<CompanySettingsResponse>();
    const applied = deferred<void>();
    const refreshed = deferred<User>();
    const updated = company({ name: "Synced while blurred", currencyLabel: "CHF" });
    mockedGetMyCompany
      .mockResolvedValueOnce(settings)
      .mockRejectedValueOnce(new Error("reconciliation offline"))
      .mockResolvedValueOnce(updated);
    mockedUpdateMyCompany.mockReturnValueOnce(save.promise);
    applyCompany.mockReturnValueOnce(applied.promise);
    refreshCurrentUser.mockReturnValueOnce(refreshed.promise);

    await act(async () => {
      renderer = create(<ForemanCompanySettingsScreen {...props} />);
      await flush();
    });
    act(() => void findField(renderer!, "Company name").props.onChangeText(updated.name));
    act(() => void findField(renderer!, "Currency label").props.onChangeText("CHF"));
    const savedSaveAction = findButton(renderer!, "Save company settings").props.onPress;
    act(() => void savedSaveAction());
    act(blurScreen);

    await act(async () => {
      save.resolve(updated);
      await flush();
    });
    await act(async () => {
      applied.resolve();
      await flush();
    });
    await act(async () => {
      refreshed.resolve(foreman);
      await flush();
    });
    expect(mockedGetMyCompany).toHaveBeenCalledTimes(1);

    await act(async () => {
      refocusScreen();
      await flush();
    });
    expect(findField(renderer!, "Company name").props.value).toBe(updated.name);
    expect(findField(renderer!, "Currency label").props.value).toBe("CHF");
    expect(renderer!.root.findAllByProps({ testID: "company-settings-dirty" })).toHaveLength(0);
    expect(renderer!.root.findByProps({ testID: "company-settings-success" })).toBeTruthy();
    expect(renderer!.root.findByProps({ testID: "company-settings-refresh-error" })).toBeTruthy();
    act(() => void savedSaveAction());
    expect(mockedUpdateMyCompany).toHaveBeenCalledTimes(1);

    await act(async () => {
      findButton(renderer!, "Retry load").props.onPress();
      await flush();
    });
    expect(mockedUpdateMyCompany).toHaveBeenCalledTimes(1);
    expect(findField(renderer!, "Company name").props.value).toBe(updated.name);
    expect(renderer!.root.findAllByProps({ testID: "company-settings-dirty" })).toHaveLength(0);
  });

  it("keeps confirmed PUT success when post-PUT auth synchronization fails", async () => {
    const save = deferred<CompanySettingsResponse>();
    const applied = deferred<void>();
    const refreshed = deferred<User>();
    const updated = company({ name: "Backend saved" });
    mockedGetMyCompany
      .mockResolvedValueOnce(settings)
      .mockRejectedValueOnce(new Error("reconciliation offline"))
      .mockResolvedValueOnce(updated);
    mockedUpdateMyCompany.mockReturnValueOnce(save.promise);
    applyCompany.mockReturnValueOnce(applied.promise);
    refreshCurrentUser.mockReturnValueOnce(refreshed.promise);

    await act(async () => {
      renderer = create(<ForemanCompanySettingsScreen {...props} />);
      await flush();
    });
    act(() => void findField(renderer!, "Company name").props.onChangeText(updated.name));
    act(() => void findButton(renderer!, "Save company settings").props.onPress());

    await act(async () => {
      save.resolve(updated);
      await flush();
    });
    await act(async () => {
      applied.reject(new Error("session persistence failed"));
      await flush();
    });
    await act(async () => {
      refreshed.resolve(foreman);
      await flush();
    });

    expect(findField(renderer!, "Company name").props.value).toBe(updated.name);
    expect(renderer!.root.findByProps({ testID: "company-settings-success" })).toBeTruthy();
    expect(renderer!.root.findAllByProps({ testID: "company-settings-save-error" })).toHaveLength(0);
    expect(renderer!.root.findAllByProps({ testID: "company-settings-dirty" })).toHaveLength(0);
    expect(renderer!.root.findByProps({ testID: "company-settings-refresh-error" })).toBeTruthy();
    expect(mockedUpdateMyCompany).toHaveBeenCalledTimes(1);

    await act(async () => {
      findButton(renderer!, "Retry load").props.onPress();
      await flush();
    });
    expect(mockedUpdateMyCompany).toHaveBeenCalledTimes(1);
    expect(findField(renderer!, "Company name").props.value).toBe(updated.name);
  });

  it("does not erase a new dirty edit during reconciliation Retry", async () => {
    const save = deferred<CompanySettingsResponse>();
    mockedGetMyCompany
      .mockResolvedValueOnce(settings)
      .mockRejectedValueOnce(new Error("reconciliation offline"))
      .mockResolvedValueOnce(company({ name: "Server after retry" }));
    mockedUpdateMyCompany.mockReturnValueOnce(save.promise);

    await act(async () => {
      renderer = create(<ForemanCompanySettingsScreen {...props} />);
      await flush();
    });
    act(() => void findField(renderer!, "Company name").props.onChangeText("Saved during blur"));
    act(() => void findButton(renderer!, "Save company settings").props.onPress());
    act(blurScreen);
    await act(async () => {
      save.resolve(company({ name: "Saved during blur" }));
      await flush();
    });
    await act(async () => {
      refocusScreen();
      await flush();
    });

    act(() => void findField(renderer!, "Company name").props.onChangeText("New unsaved edit"));
    expect(renderer!.root.findByProps({ testID: "company-settings-dirty" })).toBeTruthy();
    await act(async () => {
      findButton(renderer!, "Retry load").props.onPress();
      await flush();
    });

    expect(mockedUpdateMyCompany).toHaveBeenCalledTimes(1);
    expect(findField(renderer!, "Company name").props.value).toBe("New unsaved edit");
    expect(renderer!.root.findByProps({ testID: "company-settings-dirty" })).toBeTruthy();
  });

  it("preserves a route notice through loading and saving", async () => {
    const noticeProps = {
      ...props,
      route: {
        key: "settings-notice",
        name: "ForemanCompanySettings",
        params: {
          notice: "Company currency label must be configured before creating a shift."
        }
      }
    } as unknown as Props;
    await act(async () => {
      renderer = create(<ForemanCompanySettingsScreen {...noticeProps} />);
      await flush();
    });
    act(() => void findField(renderer!, "Currency label").props.onChangeText("UAH"));
    await act(async () => {
      findButton(renderer!, "Save company settings").props.onPress();
      await flush();
    });
    expect(renderer!.root.findByProps({ testID: "company-settings-route-notice" })).toBeTruthy();
    expect(renderedText(renderer!)).toContain(
      "Company currency label must be configured before creating a shift."
    );
  });

  it("ignores an older load after blur/refocus publishes a newer response", async () => {
    const older = deferred<CompanySettingsResponse>();
    const newer = deferred<CompanySettingsResponse>();
    mockedGetMyCompany
      .mockReturnValueOnce(older.promise)
      .mockReturnValueOnce(newer.promise);
    await act(async () => {
      renderer = create(<ForemanCompanySettingsScreen {...props} />);
      await flush();
    });
    act(blurScreen);
    act(refocusScreen);
    await act(async () => {
      newer.resolve(company({ name: "Newest company" }));
      await flush();
    });
    await act(async () => {
      older.resolve(company({ name: "Stale company" }));
      await flush();
    });
    expect(findField(renderer!, "Company name").props.value).toBe("Newest company");
    expect(renderedText(renderer!)).not.toContain("Stale company");
  });

  it("isolates a new account from late old-scope values and feedback", async () => {
    const oldScopeLoad = deferred<CompanySettingsResponse>();
    const nextScopeLoad = deferred<CompanySettingsResponse>();
    mockedGetMyCompany
      .mockResolvedValueOnce(settings)
      .mockReturnValueOnce(oldScopeLoad.promise)
      .mockReturnValueOnce(nextScopeLoad.promise);

    await act(async () => {
      renderer = create(<ForemanCompanySettingsScreen {...props} />);
      await flush();
    });
    act(blurScreen);
    act(refocusScreen);

    mockedUseAuth.mockReturnValue({
      authenticatedRequest,
      applyCompany,
      refreshCurrentUser,
      user: nextForeman
    } as unknown as ReturnType<typeof useAuth>);
    await act(async () => {
      renderer!.update(<ForemanCompanySettingsScreen {...props} />);
      await flush();
    });
    await act(async () => {
      nextScopeLoad.resolve(
        company({ id: 11, name: "Next Company", joinCode: "NEXT11" })
      );
      await flush();
    });
    expect(findField(renderer!, "Company name").props.value).toBe("Next Company");

    await act(async () => {
      oldScopeLoad.reject(new Error("old account load error"));
      await flush();
    });
    expect(findField(renderer!, "Company name").props.value).toBe("Next Company");
    expect(renderedText(renderer!)).not.toContain("old account load error");
    expect(renderedText(renderer!)).not.toContain("Acme Construction");
  });

  it("ignores a save response after unmount", async () => {
    const save = deferred<CompanySettingsResponse>();
    mockedUpdateMyCompany.mockReturnValueOnce(save.promise);
    await act(async () => {
      renderer = create(<ForemanCompanySettingsScreen {...props} />);
      await flush();
    });
    act(() => void findField(renderer!, "Company name").props.onChangeText("Late save"));
    act(() => void findButton(renderer!, "Save company settings").props.onPress());
    act(() => renderer?.unmount());
    renderer = null;

    await act(async () => {
      save.resolve(company({ name: "Late save" }));
      await flush();
    });
    expect(applyCompany).not.toHaveBeenCalled();
    expect(refreshCurrentUser).not.toHaveBeenCalled();
  });

  it("opens the existing nested Pay Rules route", async () => {
    await act(async () => {
      renderer = create(<ForemanCompanySettingsScreen {...props} />);
      await flush();
    });
    const payRules = findButton(renderer!, "Open Pay Rules");
    expect(payRules.props.accessibilityHint).toContain("nested Pay Rules");
    act(() => void payRules.props.onPress());
    expect(navigation.navigate).toHaveBeenCalledWith("ForemanPayRules");
  });

  it.each([
    ["WORKER", { ...foreman, role: "WORKER" as const }],
    ["FOREMAN without company", { ...foreman, company: null }]
  ])("blocks %s before GET", async (_label, user) => {
    mockedUseAuth.mockReturnValue({
      authenticatedRequest,
      applyCompany,
      refreshCurrentUser,
      user
    } as unknown as ReturnType<typeof useAuth>);
    await act(async () => {
      renderer = create(<ForemanCompanySettingsScreen {...props} />);
      await flush();
    });
    expect(renderer!.root.findByProps({ testID: "company-settings-access-gate" })).toBeTruthy();
    expect(mockedGetMyCompany).not.toHaveBeenCalled();
    expect(mockedUpdateMyCompany).not.toHaveBeenCalled();
  });
});
