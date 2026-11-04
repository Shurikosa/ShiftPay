import Ionicons from "@expo/vector-icons/Ionicons";
import type { ComponentProps } from "react";
import {
  act,
  create,
  type ReactTestInstance,
  type ReactTestRenderer
} from "react-test-renderer";
import { Switch } from "react-native";
import { ApiError } from "../../api/errors";
import { getMyCompany } from "../../api/companies";
import { getMyPayPolicy, updateMyPayPolicy } from "../../api/payPolicy";
import { Button } from "../../components/Button";
import { FormField } from "../../components/FormField";
import { SegmentedControl } from "../../components/SegmentedControl";
import { useAuth } from "../../context/AuthContext";
import type { PayPolicy } from "../../types/payPolicy";
import type { User } from "../../types/auth";
import type { CompanySettingsResponse } from "../../types/company";
import { ForemanPayRulesScreen } from "../ForemanPayRulesScreen";

let mockFocusLifecycle:
  | {
      effect: () => void | (() => void);
      cleanup: (() => void) | undefined;
    }
  | null = null;

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
  const actualReact = jest.requireActual<typeof import("react")>("react");

  return {
    useFocusEffect: (effect: () => void | (() => void)) => {
      actualReact.useEffect(() => {
        const lifecycle = {
          effect,
          cleanup: undefined as (() => void) | undefined
        };
        mockFocusLifecycle = lifecycle;
        const cleanup = effect();
        lifecycle.cleanup = typeof cleanup === "function" ? cleanup : undefined;

        return () => {
          if (mockFocusLifecycle === lifecycle) {
            lifecycle.cleanup?.();
            mockFocusLifecycle = null;
          }
        };
      }, [effect]);
    }
  };
});

jest.mock("../../api/payPolicy", () => ({
  getMyPayPolicy: jest.fn(),
  updateMyPayPolicy: jest.fn()
}));

jest.mock("../../api/companies", () => ({
  getMyCompany: jest.fn()
}));

jest.mock("../../context/AuthContext", () => ({
  useAuth: jest.fn()
}));

const mockedGetMyPayPolicy = jest.mocked(getMyPayPolicy);
const mockedUpdateMyPayPolicy = jest.mocked(updateMyPayPolicy);
const mockedGetMyCompany = jest.mocked(getMyCompany);
const mockedUseAuth = jest.mocked(useAuth);

void Ionicons;

type ScreenProps = ComponentProps<typeof ForemanPayRulesScreen>;

const screenProps = {
  navigation: {
    goBack: jest.fn()
  },
  route: {
    key: "pay-rules-test",
    name: "ForemanPayRules"
  }
} as unknown as ScreenProps;

function policyFixture(overrides: Partial<PayPolicy> = {}): PayPolicy {
  return {
    id: 2000,
    companyId: 10,
    version: 3,
    active: true,
    timeZone: "Europe/Berlin",
    weekStartsOn: "MONDAY",
    stackingStrategy: "ADD",
    rules: [
      {
        id: 3001,
        name: "Night",
        type: "TIME_OF_DAY",
        enabled: true,
        premiumPercent: 25,
        condition: {
          startTime: "22:00",
          endTime: "06:00"
        }
      },
      {
        id: 3002,
        name: "Daily overtime",
        type: "DAILY_OVERTIME",
        enabled: true,
        premiumPercent: 50,
        condition: {
          thresholdMinutes: 480
        }
      }
    ],
    createdAt: "2026-07-01T10:00:00Z",
    ...overrides
  };
}

function companySettingsFixture(overrides: Partial<CompanySettingsResponse> = {}): CompanySettingsResponse {
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

function deferred<TValue>() {
  let resolve!: (value: TValue) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<TValue>((promiseResolve, promiseReject) => {
    resolve = promiseResolve;
    reject = promiseReject;
  });

  return { promise, resolve, reject };
}

async function flushPromises(): Promise<void> {
  await Promise.resolve();
  await Promise.resolve();
}

function renderedOutput(renderer: ReactTestRenderer): string {
  return JSON.stringify(renderer.toJSON());
}

function blurPayRulesScreen(): void {
  const lifecycle = mockFocusLifecycle;
  lifecycle?.cleanup?.();
  if (lifecycle) {
    lifecycle.cleanup = undefined;
  }
}

function refocusPayRulesScreen(): void {
  const lifecycle = mockFocusLifecycle;
  if (!lifecycle) {
    throw new Error("Pay Rules focus lifecycle is not mounted");
  }
  const cleanup = lifecycle.effect();
  lifecycle.cleanup = typeof cleanup === "function" ? cleanup : undefined;
}

function findButton(renderer: ReactTestRenderer, label: string): ReactTestInstance {
  const button = renderer.root
    .findAllByType(Button)
    .find((candidate) => candidate.props.label === label);

  if (!button) {
    throw new Error(`Button not found: ${label}`);
  }

  return button;
}

function findFields(renderer: ReactTestRenderer, label: string): ReactTestInstance[] {
  return renderer.root
    .findAllByType(FormField)
    .filter((candidate) => candidate.props.label === label);
}

function editFirstRuleName(
  renderer: ReactTestRenderer,
  value = "Edited policy draft"
): void {
  findFields(renderer, "Rule name")[0]?.props.onChangeText(value);
}

function findSegmentedControl(
  renderer: ReactTestRenderer,
  accessibilityLabel: string
): ReactTestInstance {
  const control = renderer.root
    .findAllByType(SegmentedControl)
    .find((candidate) => candidate.props.accessibilityLabel === accessibilityLabel);

  if (!control) {
    throw new Error(`Segmented control not found: ${accessibilityLabel}`);
  }

  return control;
}

function authResult(authenticatedRequest: jest.Mock) {
  return {
    status: "authenticated",
    user: {
      id: 5,
      email: "foreman@example.com",
      firstName: "Frank",
      lastName: "Foreman",
      role: "FOREMAN",
      company: { id: 10, name: "Acme Construction", joinCode: "CMP123" }
    },
    authenticatedRequest,
    refreshCurrentUser: jest.fn(),
    applyCompany: jest.fn(),
    signIn: jest.fn(),
    register: jest.fn(),
    signOut: jest.fn(),
    clearError: jest.fn()
  } as unknown as ReturnType<typeof useAuth>;
}

function authResultForUser(
  authenticatedRequest: jest.Mock,
  user: User | null
): ReturnType<typeof useAuth> {
  return {
    ...authResult(authenticatedRequest),
    user
  } as ReturnType<typeof useAuth>;
}

describe("ForemanPayRulesScreen", () => {
  const mountedRenderers: ReactTestRenderer[] = [];
  let authenticatedRequest: jest.Mock;

  beforeAll(() => {
    (
      globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }
    ).IS_REACT_ACT_ENVIRONMENT = true;
  });

  beforeEach(() => {
    mockFocusLifecycle = null;
    jest.clearAllMocks();
    mockedGetMyPayPolicy.mockReset();
    mockedUpdateMyPayPolicy.mockReset();
    mockedGetMyCompany.mockReset();
    mockedGetMyCompany.mockResolvedValue(companySettingsFixture());

    authenticatedRequest = jest.fn(
      (request: (token: string) => Promise<unknown>) => request("foreman-token")
    );
    mockedUseAuth.mockReturnValue({
      status: "authenticated",
      user: {
        id: 5,
        email: "foreman@example.com",
        firstName: "Frank",
        lastName: "Foreman",
        role: "FOREMAN",
        company: {
          id: 10,
          name: "Acme Construction",
          joinCode: "CMP123"
        }
      },
      error: null,
      authenticatedRequest,
      refreshCurrentUser: jest.fn(),
      applyCompany: jest.fn(),
      signIn: jest.fn(),
      register: jest.fn(),
      signOut: jest.fn(),
      clearError: jest.fn()
    } as unknown as ReturnType<typeof useAuth>);
  });

  afterEach(() => {
    act(() => {
      mountedRenderers.forEach((renderer) => {
        renderer.unmount();
      });
      mountedRenderers.length = 0;
    });
  });

  async function renderScreen(): Promise<ReactTestRenderer> {
    let renderer!: ReactTestRenderer;

    await act(async () => {
      renderer = create(<ForemanPayRulesScreen {...screenProps} />);
      await flushPromises();
    });
    mountedRenderers.push(renderer);
    return renderer;
  }

  it("loads the focused policy through authenticatedRequest and displays metadata", async () => {
    const pendingPolicy = deferred<PayPolicy>();
    mockedGetMyPayPolicy.mockReturnValueOnce(pendingPolicy.promise);
    const renderer = await renderScreen();

    expect(renderedOutput(renderer)).toContain("Loading pay rules");
    expect(authenticatedRequest).toHaveBeenCalledTimes(1);
    expect(mockedGetMyPayPolicy).toHaveBeenCalledWith("foreman-token");

    await act(async () => {
      pendingPolicy.resolve(policyFixture());
      await flushPromises();
    });

    const output = renderedOutput(renderer);
    expect(output).toContain("Acme Construction");
    expect(output).toContain("Europe/Berlin");
    expect(output).toContain("Version 3");
    expect(findFields(renderer, "Rule name")[0]?.props.value).toBe("Night");
  });

  it.each([
    [
      "worker",
      {
        id: 6,
        email: "worker@example.com",
        firstName: "Wendy",
        lastName: "Worker",
        role: "WORKER",
        company: {
          id: 10,
          name: "Acme Construction",
          joinCode: "CMP123",
          currencyLabel: "EUR",
          timeZone: "Europe/Berlin"
        }
      } as User,
      "Foreman access required"
    ],
    [
      "admin",
      {
        id: 7,
        email: "admin@example.com",
        firstName: "Ada",
        lastName: "Admin",
        role: "ADMIN",
        company: {
          id: 10,
          name: "Acme Construction",
          joinCode: "CMP123",
          currencyLabel: "EUR",
          timeZone: "Europe/Berlin"
        }
      } as User,
      "Foreman access required"
    ],
    [
      "companyless foreman",
      {
        id: 5,
        email: "foreman@example.com",
        firstName: "Frank",
        lastName: "Foreman",
        role: "FOREMAN",
        company: null
      } as User,
      "Company required"
    ],
    ["missing user", null, "Foreman access required"]
  ])("blocks %s before any policy or company request", async (_case, user, title) => {
    mockedUseAuth.mockReturnValue(authResultForUser(authenticatedRequest, user));
    const renderer = await renderScreen();

    expect(renderedOutput(renderer)).toContain(title);
    expect(mockedGetMyPayPolicy).not.toHaveBeenCalled();
    expect(mockedGetMyCompany).not.toHaveBeenCalled();
    expect(mockedUpdateMyPayPolicy).not.toHaveBeenCalled();
  });

  it("remounts state synchronously for a new user/company scope and ignores the old response", async () => {
    const oldPolicy = deferred<PayPolicy>();
    const oldSettings = deferred<CompanySettingsResponse>();
    const nextPolicy = deferred<PayPolicy>();
    const nextSettings = deferred<CompanySettingsResponse>();
    mockedGetMyPayPolicy.mockReturnValueOnce(oldPolicy.promise).mockReturnValueOnce(nextPolicy.promise);
    mockedGetMyCompany.mockReturnValueOnce(oldSettings.promise).mockReturnValueOnce(nextSettings.promise);
    const renderer = await renderScreen();
    const nextRequest = jest.fn((request: (token: string) => Promise<unknown>) => request("next-token"));
    mockedUseAuth.mockReturnValue(
      authResultForUser(nextRequest, {
        id: 8,
        email: "next@example.com",
        firstName: "Nora",
        lastName: "Foreman",
        role: "FOREMAN",
        company: {
          id: 20,
          name: "Next Company",
          joinCode: "NEXT20",
          currencyLabel: "NEXT",
          timeZone: "Europe/Berlin"
        }
      })
    );

    act(() => {
      renderer.update(<ForemanPayRulesScreen {...screenProps} />);
      expect(renderedOutput(renderer)).toContain("Loading pay rules");
      expect(renderedOutput(renderer)).not.toContain("Acme Construction");
    });

    await act(async () => {
      oldPolicy.resolve(policyFixture({ version: 99 }));
      oldSettings.resolve(companySettingsFixture({ currencyLabel: "OLD_SCOPE" }));
      await flushPromises();
    });
    expect(renderedOutput(renderer)).not.toContain("Version 99");
    expect(renderedOutput(renderer)).not.toContain("OLD_SCOPE");

    await act(async () => {
      nextPolicy.resolve(policyFixture({ companyId: 20, version: 4 }));
      nextSettings.resolve(
        companySettingsFixture({ id: 20, name: "Next Company", currencyLabel: "NEXT" })
      );
      await flushPromises();
    });
    expect(renderedOutput(renderer)).toContain("Next Company");
    expect(renderedOutput(renderer)).toContain("Version 4");
    expect(renderedOutput(renderer)).toContain("NEXT");
  });

  it("does not publish a policy/settings pair returned for another company", async () => {
    mockedGetMyPayPolicy.mockResolvedValueOnce(
      policyFixture({ companyId: 99, version: 99 })
    );
    mockedGetMyCompany.mockResolvedValueOnce(
      companySettingsFixture({ id: 99, name: "Other Company", currencyLabel: "PRIVATE" })
    );
    const renderer = await renderScreen();

    expect(renderedOutput(renderer)).toContain("Could not load pay rules");
    expect(renderedOutput(renderer)).not.toContain("Other Company");
    expect(renderedOutput(renderer)).not.toContain("PRIVATE");
    expect(renderedOutput(renderer)).not.toContain("Version 99");
  });

  it("keeps edits made after a manual reload starts instead of hydrating its late pair", async () => {
    const latePolicy = deferred<PayPolicy>();
    const lateSettings = deferred<CompanySettingsResponse>();
    mockedGetMyPayPolicy.mockResolvedValueOnce(policyFixture({ version: 3 }));
    mockedGetMyCompany.mockResolvedValueOnce(companySettingsFixture({ currencyLabel: "CURRENT" }));
    const renderer = await renderScreen();
    mockedGetMyPayPolicy.mockReturnValueOnce(latePolicy.promise);
    mockedGetMyCompany.mockReturnValueOnce(lateSettings.promise);

    await act(async () => {
      findButton(renderer, "Reload current policy").props.onPress();
      await flushPromises();
    });
    act(() => {
      findFields(renderer, "Rule name")[0]?.props.onChangeText("My local draft");
    });
    expect(renderedOutput(renderer)).toContain("Unsaved pay-rule changes");

    await act(async () => {
      latePolicy.resolve(policyFixture({ version: 4 }));
      lateSettings.resolve(companySettingsFixture({ currencyLabel: "LATE" }));
      await flushPromises();
    });

    expect(findFields(renderer, "Rule name")[0]?.props.value).toBe("My local draft");
    expect(renderedOutput(renderer)).toContain("Version 3");
    expect(renderedOutput(renderer)).toContain("CURRENT");
    expect(renderedOutput(renderer)).not.toContain("LATE");
  });

  it("preserves a dirty draft across the required blur/refocus freshness load", async () => {
    mockedGetMyPayPolicy.mockResolvedValueOnce(policyFixture({ version: 3 }));
    mockedGetMyCompany.mockResolvedValueOnce(companySettingsFixture({ currencyLabel: "CURRENT" }));
    const renderer = await renderScreen();

    act(() => {
      findFields(renderer, "Rule name")[0]?.props.onChangeText("Draft kept across focus");
      blurPayRulesScreen();
    });
    mockedGetMyPayPolicy.mockResolvedValueOnce(policyFixture({ version: 4 }));
    mockedGetMyCompany.mockResolvedValueOnce(
      companySettingsFixture({ currencyLabel: "REFRESHED", defaultWorkerHourlyRate: 44 })
    );

    await act(async () => {
      refocusPayRulesScreen();
      await flushPromises();
    });

    expect(findFields(renderer, "Rule name")[0]?.props.value).toBe(
      "Draft kept across focus"
    );
    expect(renderedOutput(renderer)).toContain("Version 4");
    expect(renderedOutput(renderer)).toContain("REFRESHED");
    expect(renderedOutput(renderer)).toContain("Unsaved pay-rule changes");
    expect(findButton(renderer, "Save as new version").props.disabled).toBe(false);
  });

  it("keeps an already rendered policy visible during a manual background refresh", async () => {
    const refreshedPolicy = deferred<PayPolicy>();
    const refreshedSettings = deferred<CompanySettingsResponse>();
    mockedGetMyPayPolicy.mockResolvedValueOnce(policyFixture({ version: 3 }));
    mockedGetMyCompany.mockResolvedValueOnce(companySettingsFixture({ currencyLabel: "BEFORE" }));
    const renderer = await renderScreen();
    mockedGetMyPayPolicy.mockReturnValueOnce(refreshedPolicy.promise);
    mockedGetMyCompany.mockReturnValueOnce(refreshedSettings.promise);

    await act(async () => {
      findButton(renderer, "Reload current policy").props.onPress();
      await flushPromises();
    });
    expect(renderedOutput(renderer)).toContain("Version 3");
    expect(renderedOutput(renderer)).toContain("Refreshing pay rules");
    expect(renderedOutput(renderer)).not.toContain("Loading pay rules");
    expect(findFields(renderer, "Rule name")[0]?.props.value).toBe("Night");

    await act(async () => {
      refreshedPolicy.resolve(policyFixture({ version: 4 }));
      refreshedSettings.resolve(companySettingsFixture({ currencyLabel: "AFTER" }));
      await flushPromises();
    });
    expect(renderedOutput(renderer)).toContain("Version 4");
    expect(renderedOutput(renderer)).toContain("AFTER");
  });

  it("keeps a refocused screen visibly non-blocking but freshness-gated until its required load commits", async () => {
    const savedPolicy = deferred<PayPolicy>();
    const refocusedPolicy = deferred<PayPolicy>();
    const refocusedSettings = deferred<CompanySettingsResponse>();
    mockedGetMyPayPolicy.mockResolvedValueOnce(policyFixture({ version: 3 }));
    mockedGetMyCompany.mockResolvedValueOnce(companySettingsFixture());
    mockedUpdateMyPayPolicy.mockReturnValueOnce(savedPolicy.promise);
    const renderer = await renderScreen();

    act(() => editFirstRuleName(renderer, "Draft saved during refocus"));
    await act(async () => {
      findButton(renderer, "Save as new version").props.onPress();
      await flushPromises();
    });
    mockedGetMyPayPolicy.mockReturnValueOnce(refocusedPolicy.promise);
    mockedGetMyCompany.mockReturnValueOnce(refocusedSettings.promise);
    const refocusedRequest = jest.fn((request: (token: string) => Promise<unknown>) => request("refocused"));
    mockedUseAuth.mockReturnValue(authResult(refocusedRequest));
    await act(async () => {
      renderer.update(<ForemanPayRulesScreen {...screenProps} />);
      await flushPromises();
    });

    expect(renderedOutput(renderer)).toContain("Version 3");
    expect(renderedOutput(renderer)).toContain("Refreshing pay rules");
    expect(findButton(renderer, "Save as new version").props.disabled).toBe(true);
    expect(findFields(renderer, "Rule name")[0]?.props.editable).toBe(false);

    await act(async () => {
      savedPolicy.resolve(policyFixture({ version: 8 }));
      await flushPromises();
      await flushPromises();
    });
    expect(mockedGetMyPayPolicy).toHaveBeenCalledTimes(2);
    expect(findButton(renderer, "Save as new version").props.disabled).toBe(true);
    expect(findFields(renderer, "Rule name")[0]?.props.editable).toBe(false);

    await act(async () => {
      refocusedPolicy.resolve(policyFixture({ version: 9 }));
      refocusedSettings.resolve(companySettingsFixture({ currencyLabel: "REFOCUSED" }));
      await flushPromises();
    });
    expect(renderedOutput(renderer)).toContain("Version 9");
    expect(findButton(renderer, "Save as new version").props.disabled).toBe(true);
    expect(findFields(renderer, "Rule name")[0]?.props.editable).toBe(true);
  });

  it("keeps a refocus freshness failure visible, gated, and retryable", async () => {
    const requiredPolicy = deferred<PayPolicy>();
    mockedGetMyPayPolicy.mockResolvedValueOnce(policyFixture({ version: 3 }));
    const renderer = await renderScreen();
    mockedGetMyPayPolicy.mockReturnValueOnce(requiredPolicy.promise);
    const refocusedRequest = jest.fn((request: (token: string) => Promise<unknown>) => request("refocused"));
    mockedUseAuth.mockReturnValue(authResult(refocusedRequest));

    await act(async () => {
      renderer.update(<ForemanPayRulesScreen {...screenProps} />);
      await flushPromises();
      requiredPolicy.reject(new Error("offline"));
      await flushPromises();
      await flushPromises();
    });
    expect(renderedOutput(renderer)).toContain("Version 3");
    expect(renderedOutput(renderer)).toContain("Could not refresh pay rules");
    expect(findButton(renderer, "Retry refresh")).toBeDefined();
    expect(findButton(renderer, "Save as new version").props.disabled).toBe(true);
    expect(findFields(renderer, "Rule name")[0]?.props.editable).toBe(false);

    mockedGetMyPayPolicy.mockResolvedValueOnce(policyFixture({ version: 4 }));
    mockedGetMyCompany.mockResolvedValueOnce(companySettingsFixture({ currencyLabel: "RETRIED" }));
    await act(async () => {
      findButton(renderer, "Retry refresh").props.onPress();
      await flushPromises();
    });
    expect(renderedOutput(renderer)).toContain("Version 4");
    expect(findButton(renderer, "Save as new version").props.disabled).toBe(true);
    expect(findFields(renderer, "Rule name")[0]?.props.editable).toBe(true);
  });

  it("keeps the newest refocused policy/settings pair when an older load resolves afterward", async () => {
    const firstPolicy = deferred<PayPolicy>();
    const firstSettings = deferred<CompanySettingsResponse>();
    const newestPolicy = deferred<PayPolicy>();
    const newestSettings = deferred<CompanySettingsResponse>();
    mockedGetMyPayPolicy
      .mockReturnValueOnce(firstPolicy.promise)
      .mockReturnValueOnce(newestPolicy.promise);
    mockedGetMyCompany
      .mockReturnValueOnce(firstSettings.promise)
      .mockReturnValueOnce(newestSettings.promise);
    const firstRequest = jest.fn((request: (token: string) => Promise<unknown>) => request("first"));
    mockedUseAuth.mockReturnValue(authResult(firstRequest));
    const renderer = await renderScreen();

    const secondRequest = jest.fn((request: (token: string) => Promise<unknown>) => request("second"));
    mockedUseAuth.mockReturnValue(authResult(secondRequest));
    await act(async () => {
      renderer.update(<ForemanPayRulesScreen {...screenProps} />);
      await flushPromises();
    });
    await act(async () => {
      newestPolicy.resolve(policyFixture({ version: 9, rules: [{ id: 9, name: "Newest", type: "DAILY_OVERTIME", enabled: true, premiumPercent: 25, condition: { thresholdMinutes: 492 } }] }));
      newestSettings.resolve(companySettingsFixture({ currencyLabel: "USD", defaultWorkerHourlyRate: 77 }));
      await flushPromises();
    });
    expect(renderedOutput(renderer)).toContain("Version 9");
    expect(findFields(renderer, "Threshold hours")[0]?.props.value).toBe("8.2");
    expect(renderedOutput(renderer)).toContain("USD");

    await act(async () => {
      firstPolicy.resolve(policyFixture({ version: 1, rules: [{ id: 1, name: "Old", type: "DAILY_OVERTIME", enabled: true, premiumPercent: 25, condition: { thresholdMinutes: 31 } }] }));
      firstSettings.resolve(companySettingsFixture({ currencyLabel: "OLD", defaultWorkerHourlyRate: 100 }));
      await flushPromises();
    });
    expect(renderedOutput(renderer)).toContain("Version 9");
    expect(renderedOutput(renderer)).not.toContain("OLD");
    expect(findFields(renderer, "Threshold hours")[0]?.props.value).toBe("8.2");
  });

  it("ignores an older rejection and finalization while the newest focused load is pending", async () => {
    const stalePolicy = deferred<PayPolicy>();
    const latestPolicy = deferred<PayPolicy>();
    const latestSettings = deferred<CompanySettingsResponse>();
    mockedGetMyPayPolicy.mockReturnValueOnce(stalePolicy.promise).mockReturnValueOnce(latestPolicy.promise);
    mockedGetMyCompany.mockResolvedValueOnce(companySettingsFixture()).mockReturnValueOnce(latestSettings.promise);
    const firstRequest = jest.fn((request: (token: string) => Promise<unknown>) => request("first"));
    mockedUseAuth.mockReturnValue(authResult(firstRequest));
    const renderer = await renderScreen();
    const secondRequest = jest.fn((request: (token: string) => Promise<unknown>) => request("second"));
    mockedUseAuth.mockReturnValue(authResult(secondRequest));
    await act(async () => {
      renderer.update(<ForemanPayRulesScreen {...screenProps} />);
      await flushPromises();
    });
    await act(async () => {
      stalePolicy.reject(new Error("stale failure"));
      await flushPromises();
    });
    expect(renderedOutput(renderer)).toContain("Loading pay rules");
    expect(renderedOutput(renderer)).not.toContain("Could not load pay rules");
    await act(async () => {
      latestPolicy.resolve(policyFixture({ version: 10 }));
      latestSettings.resolve(companySettingsFixture({ currencyLabel: "NEW" }));
      await flushPromises();
    });
    expect(renderedOutput(renderer)).toContain("Version 10");
    expect(renderedOutput(renderer)).toContain("NEW");
  });

  it("supersedes rapid manual reloads and invalidates a load after unmount", async () => {
    mockedGetMyPayPolicy.mockResolvedValueOnce(policyFixture());
    mockedGetMyCompany.mockResolvedValueOnce(companySettingsFixture());
    const renderer = await renderScreen();
    const stalePolicy = deferred<PayPolicy>();
    const latestPolicy = deferred<PayPolicy>();
    const staleSettings = deferred<CompanySettingsResponse>();
    const latestSettings = deferred<CompanySettingsResponse>();
    mockedGetMyPayPolicy.mockReturnValueOnce(stalePolicy.promise).mockReturnValueOnce(latestPolicy.promise);
    mockedGetMyCompany.mockReturnValueOnce(staleSettings.promise).mockReturnValueOnce(latestSettings.promise);
    const reload = findButton(renderer, "Reload current policy").props.onPress;
    await act(async () => {
      void reload();
      void reload();
      await flushPromises();
    });
    await act(async () => {
      latestPolicy.resolve(policyFixture({ version: 12 }));
      latestSettings.resolve(companySettingsFixture({ currencyLabel: "LATEST" }));
      await flushPromises();
    });
    await act(async () => {
      stalePolicy.resolve(policyFixture({ version: 11 }));
      staleSettings.resolve(companySettingsFixture({ currencyLabel: "STALE" }));
      await flushPromises();
    });
    expect(renderedOutput(renderer)).toContain("Version 12");
    expect(renderedOutput(renderer)).not.toContain("STALE");

    const afterUnmountPolicy = deferred<PayPolicy>();
    const afterUnmountSettings = deferred<CompanySettingsResponse>();
    mockedGetMyPayPolicy.mockReturnValueOnce(afterUnmountPolicy.promise);
    mockedGetMyCompany.mockReturnValueOnce(afterUnmountSettings.promise);
    const finalReload = findButton(renderer, "Reload current policy").props.onPress;
    await act(async () => {
      void finalReload();
      renderer.unmount();
      afterUnmountPolicy.resolve(policyFixture({ version: 13 }));
      afterUnmountSettings.resolve(companySettingsFixture({ currencyLabel: "AFTER_UNMOUNT" }));
      await flushPromises();
    });
    mountedRenderers.pop();
  });

  it("keeps the saved policy and settings when a pre-save reload resolves afterward", async () => {
    const stalePolicy = deferred<PayPolicy>();
    const staleSettings = deferred<CompanySettingsResponse>();
    const savedPolicy = deferred<PayPolicy>();
    mockedGetMyPayPolicy.mockResolvedValueOnce(policyFixture({ version: 3 }));
    mockedGetMyCompany.mockResolvedValueOnce(companySettingsFixture({ currencyLabel: "BEFORE_SAVE" }));
    mockedUpdateMyPayPolicy.mockReturnValueOnce(savedPolicy.promise);
    const renderer = await renderScreen();
    act(() => editFirstRuleName(renderer, "Pre-save draft"));
    const save = findButton(renderer, "Save as new version").props.onPress;
    mockedGetMyPayPolicy.mockReturnValueOnce(stalePolicy.promise);
    mockedGetMyCompany.mockReturnValueOnce(staleSettings.promise);

    await act(async () => {
      findButton(renderer, "Reload current policy").props.onPress();
      save();
      savedPolicy.resolve(policyFixture({ version: 8, rules: [{ id: 8, name: "Saved", type: "DAILY_OVERTIME", enabled: true, premiumPercent: 25, condition: { thresholdMinutes: 492 } }] }));
      await flushPromises();
      await flushPromises();
    });
    expect(renderedOutput(renderer)).toContain("Version 8");
    expect(renderedOutput(renderer)).toContain("BEFORE_SAVE");
    expect(findFields(renderer, "Threshold hours")[0]?.props.value).toBe("8.2");
    act(() => editFirstRuleName(renderer, "New edit after confirmed save"));

    await act(async () => {
      stalePolicy.resolve(policyFixture({ version: 4, rules: [{ id: 4, name: "Stale", type: "DAILY_OVERTIME", enabled: true, premiumPercent: 25, condition: { thresholdMinutes: 31 } }] }));
      staleSettings.resolve(companySettingsFixture({ currencyLabel: "STALE", defaultWorkerHourlyRate: 100 }));
      await flushPromises();
    });
    expect(renderedOutput(renderer)).toContain("Version 8");
    expect(renderedOutput(renderer)).toContain("BEFORE_SAVE");
    expect(renderedOutput(renderer)).not.toContain("STALE");
    expect(findFields(renderer, "Threshold hours")[0]?.props.value).toBe("8.2");
    expect(findFields(renderer, "Rule name")[0]?.props.value).toBe(
      "New edit after confirmed save"
    );
    expect(renderedOutput(renderer)).toContain("Unsaved pay-rule changes");
  });

  it("ignores a pre-save reload rejection and finalization after save success", async () => {
    const stalePolicy = deferred<PayPolicy>();
    const savedPolicy = deferred<PayPolicy>();
    mockedGetMyPayPolicy.mockResolvedValueOnce(policyFixture({ version: 3 }));
    mockedUpdateMyPayPolicy.mockReturnValueOnce(savedPolicy.promise);
    const renderer = await renderScreen();
    act(() => editFirstRuleName(renderer, "Pre-save rejected load draft"));
    const save = findButton(renderer, "Save as new version").props.onPress;
    mockedGetMyPayPolicy.mockReturnValueOnce(stalePolicy.promise);

    await act(async () => {
      findButton(renderer, "Reload current policy").props.onPress();
      save();
      savedPolicy.resolve(policyFixture({ version: 8 }));
      await flushPromises();
      await flushPromises();
    });
    await act(async () => {
      stalePolicy.reject(new Error("stale reload failure"));
      await flushPromises();
    });
    expect(renderedOutput(renderer)).toContain("Version 8");
    expect(renderedOutput(renderer)).toContain("Pay rules saved");
    expect(renderedOutput(renderer)).not.toContain("Could not load pay rules");
  });

  it("queues a reload during save and commits only the post-save policy/settings pair", async () => {
    const savedPolicy = deferred<PayPolicy>();
    const postSavePolicy = deferred<PayPolicy>();
    const postSaveSettings = deferred<CompanySettingsResponse>();
    mockedGetMyPayPolicy.mockResolvedValueOnce(policyFixture({ version: 3 }));
    mockedGetMyCompany.mockResolvedValueOnce(companySettingsFixture({ currencyLabel: "OLD" }));
    mockedUpdateMyPayPolicy.mockReturnValueOnce(savedPolicy.promise);
    const renderer = await renderScreen();
    const reload = findButton(renderer, "Reload current policy").props.onPress;

    act(() => editFirstRuleName(renderer, "Queued load draft"));
    await act(async () => {
      findButton(renderer, "Save as new version").props.onPress();
      reload();
      await flushPromises();
    });
    expect(mockedGetMyPayPolicy).toHaveBeenCalledTimes(1);

    mockedGetMyPayPolicy.mockReturnValueOnce(postSavePolicy.promise);
    mockedGetMyCompany.mockReturnValueOnce(postSaveSettings.promise);
    await act(async () => {
      savedPolicy.resolve(policyFixture({ version: 8 }));
      await flushPromises();
    });
    expect(mockedGetMyPayPolicy).toHaveBeenCalledTimes(2);

    await act(async () => {
      postSavePolicy.resolve(policyFixture({ version: 9, rules: [{ id: 9, name: "Post-save", type: "DAILY_OVERTIME", enabled: true, premiumPercent: 25, condition: { thresholdMinutes: 492 } }] }));
      postSaveSettings.resolve(companySettingsFixture({ currencyLabel: "POST_SAVE", defaultWorkerHourlyRate: 77 }));
      await flushPromises();
    });
    expect(renderedOutput(renderer)).toContain("Version 9");
    expect(renderedOutput(renderer)).toContain("POST_SAVE");
    expect(renderedOutput(renderer)).not.toContain("Pay rules saved");
    expect(findFields(renderer, "Threshold hours")[0]?.props.value).toBe("8.2");
  });

  it("keeps a save-success message consistent when a queued refresh returns the same version", async () => {
    const savedPolicy = deferred<PayPolicy>();
    const queuedPolicy = deferred<PayPolicy>();
    const queuedSettings = deferred<CompanySettingsResponse>();
    mockedGetMyPayPolicy.mockResolvedValueOnce(policyFixture({ version: 3 }));
    mockedGetMyCompany.mockResolvedValueOnce(companySettingsFixture());
    mockedUpdateMyPayPolicy.mockReturnValueOnce(savedPolicy.promise);
    const renderer = await renderScreen();
    const reload = findButton(renderer, "Reload current policy").props.onPress;
    mockedGetMyPayPolicy.mockReturnValueOnce(queuedPolicy.promise);
    mockedGetMyCompany.mockReturnValueOnce(queuedSettings.promise);

    act(() => editFirstRuleName(renderer, "Same version draft"));
    await act(async () => {
      findButton(renderer, "Save as new version").props.onPress();
      reload();
      savedPolicy.resolve(policyFixture({ version: 8 }));
      await flushPromises();
      await flushPromises();
    });
    expect(renderedOutput(renderer)).toContain("Version 8");
    expect(renderedOutput(renderer)).toContain("Pay rules saved");

    await act(async () => {
      queuedPolicy.resolve(policyFixture({ version: 8 }));
      queuedSettings.resolve(companySettingsFixture({ currencyLabel: "SAME_VERSION" }));
      await flushPromises();
    });
    expect(renderedOutput(renderer)).toContain("Version 8");
    expect(renderedOutput(renderer)).toContain("Pay rules saved");
    expect(renderedOutput(renderer)).toContain("Version 8 is now current");
  });

  it("keeps the saved policy and success message visible while a queued refresh is pending", async () => {
    const savedPolicy = deferred<PayPolicy>();
    const queuedPolicy = deferred<PayPolicy>();
    const queuedSettings = deferred<CompanySettingsResponse>();
    mockedGetMyPayPolicy.mockResolvedValueOnce(policyFixture({ version: 3 }));
    mockedGetMyCompany.mockResolvedValueOnce(companySettingsFixture({ currencyLabel: "BEFORE" }));
    mockedUpdateMyPayPolicy.mockReturnValueOnce(savedPolicy.promise);
    const renderer = await renderScreen();
    const reload = findButton(renderer, "Reload current policy").props.onPress;
    mockedGetMyPayPolicy.mockReturnValueOnce(queuedPolicy.promise);
    mockedGetMyCompany.mockReturnValueOnce(queuedSettings.promise);

    act(() => editFirstRuleName(renderer, "Pending refresh draft"));
    await act(async () => {
      findButton(renderer, "Save as new version").props.onPress();
      reload();
      savedPolicy.resolve(policyFixture({ version: 8, rules: [{ id: 8, name: "Saved", type: "DAILY_OVERTIME", enabled: true, premiumPercent: 25, condition: { thresholdMinutes: 492 } }] }));
      await flushPromises();
      await flushPromises();
    });

    expect(mockedGetMyPayPolicy).toHaveBeenCalledTimes(2);
    expect(mockedGetMyCompany).toHaveBeenCalledTimes(2);
    expect(renderedOutput(renderer)).toContain("Version 8");
    expect(renderedOutput(renderer)).toContain("Pay rules saved");
    expect(renderedOutput(renderer)).toContain("Refreshing pay rules");
    expect(renderedOutput(renderer)).not.toContain("Loading pay rules");
    expect(findFields(renderer, "Threshold hours")[0]?.props.value).toBe("8.2");
  });

  it("keeps Save clean after a foreground confirmed save and failed queued refresh", async () => {
    const savedPolicy = deferred<PayPolicy>();
    const queuedPolicy = deferred<PayPolicy>();
    mockedGetMyPayPolicy.mockResolvedValueOnce(policyFixture({ version: 3 }));
    mockedUpdateMyPayPolicy.mockReturnValueOnce(savedPolicy.promise);
    const renderer = await renderScreen();
    const reload = findButton(renderer, "Reload current policy").props.onPress;
    mockedGetMyPayPolicy.mockReturnValueOnce(queuedPolicy.promise);

    act(() => editFirstRuleName(renderer, "Failed queued refresh draft"));
    await act(async () => {
      findButton(renderer, "Save as new version").props.onPress();
      reload();
      savedPolicy.resolve(policyFixture({ version: 8 }));
      await flushPromises();
      await flushPromises();
    });
    await act(async () => {
      queuedPolicy.reject(new Error("refresh offline"));
      await flushPromises();
      await flushPromises();
    });

    expect(renderedOutput(renderer)).toContain("Version 8");
    expect(renderedOutput(renderer)).toContain("Pay rules saved");
    expect(renderedOutput(renderer)).toContain("Could not refresh pay rules");
    expect(renderedOutput(renderer)).not.toContain("Loading pay rules");
    expect(findButton(renderer, "Save as new version").props.loading).toBe(false);
    expect(findButton(renderer, "Save as new version").props.disabled).toBe(true);
    expect(findButton(renderer, "Reload current policy").props.disabled).toBe(false);
    const cleanSave = findButton(renderer, "Save as new version").props.onPress;
    act(() => void cleanSave());
    expect(mockedUpdateMyPayPolicy).toHaveBeenCalledTimes(1);

    mockedGetMyPayPolicy.mockResolvedValueOnce(policyFixture({ version: 9 }));
    mockedGetMyCompany.mockResolvedValueOnce(companySettingsFixture({ currencyLabel: "RETRIED" }));
    await act(async () => {
      findButton(renderer, "Reload current policy").props.onPress();
      await flushPromises();
    });
    expect(mockedGetMyPayPolicy).toHaveBeenCalledTimes(3);
    expect(renderedOutput(renderer)).toContain("Version 9");
    expect(renderedOutput(renderer)).not.toContain("Pay rules saved");
  });

  it("coalesces multiple reload and focus requests during one save into one post-save load", async () => {
    const savedPolicy = deferred<PayPolicy>();
    const queuedPolicy = deferred<PayPolicy>();
    const queuedSettings = deferred<CompanySettingsResponse>();
    mockedGetMyPayPolicy.mockResolvedValueOnce(policyFixture({ version: 3 }));
    mockedGetMyCompany.mockResolvedValueOnce(companySettingsFixture());
    mockedUpdateMyPayPolicy.mockReturnValueOnce(savedPolicy.promise);
    const renderer = await renderScreen();
    const reload = findButton(renderer, "Reload current policy").props.onPress;

    act(() => editFirstRuleName(renderer, "Coalesced draft"));
    await act(async () => {
      findButton(renderer, "Save as new version").props.onPress();
      reload();
      reload();
      await flushPromises();
    });
    const refocusedRequest = jest.fn((request: (token: string) => Promise<unknown>) => request("refocused"));
    mockedUseAuth.mockReturnValue(authResult(refocusedRequest));
    await act(async () => {
      renderer.update(<ForemanPayRulesScreen {...screenProps} />);
      await flushPromises();
    });
    expect(mockedGetMyPayPolicy).toHaveBeenCalledTimes(1);

    mockedGetMyPayPolicy.mockReturnValueOnce(queuedPolicy.promise);
    mockedGetMyCompany.mockReturnValueOnce(queuedSettings.promise);
    await act(async () => {
      savedPolicy.resolve(policyFixture({ version: 8 }));
      await flushPromises();
      await flushPromises();
    });
    expect(mockedGetMyPayPolicy).toHaveBeenCalledTimes(2);
    expect(mockedGetMyCompany).toHaveBeenCalledTimes(2);

    await act(async () => {
      queuedPolicy.resolve(policyFixture({ version: 9 }));
      queuedSettings.resolve(companySettingsFixture({ currencyLabel: "COALESCED" }));
      await flushPromises();
    });
    expect(renderedOutput(renderer)).toContain("Version 9");
    expect(renderedOutput(renderer)).toContain("COALESCED");
    expect(findButton(renderer, "Save as new version").props.loading).toBe(false);
  });

  it("keeps a blurred confirmed save clean after refocus reconciliation", async () => {
    const blurredSave = deferred<PayPolicy>();
    const refocusedPolicy = deferred<PayPolicy>();
    const refocusedSettings = deferred<CompanySettingsResponse>();
    mockedGetMyPayPolicy.mockResolvedValueOnce(policyFixture({ version: 3 }));
    mockedGetMyCompany.mockResolvedValueOnce(companySettingsFixture({ currencyLabel: "INITIAL" }));
    mockedUpdateMyPayPolicy.mockReturnValueOnce(blurredSave.promise);
    const renderer = await renderScreen();

    act(() => editFirstRuleName(renderer, "Blurred draft"));
    await act(async () => {
      findButton(renderer, "Save as new version").props.onPress();
      findButton(renderer, "Reload current policy").props.onPress();
      blurPayRulesScreen();
      await flushPromises();
    });

    await act(async () => {
      blurredSave.resolve(policyFixture({ version: 8 }));
      await flushPromises();
      await flushPromises();
    });
    expect(mockedGetMyPayPolicy).toHaveBeenCalledTimes(1);
    expect(mockedGetMyCompany).toHaveBeenCalledTimes(1);

    mockedGetMyPayPolicy.mockReturnValueOnce(refocusedPolicy.promise);
    mockedGetMyCompany.mockReturnValueOnce(refocusedSettings.promise);
    await act(async () => {
      refocusPayRulesScreen();
      await flushPromises();
    });
    expect(mockedGetMyPayPolicy).toHaveBeenCalledTimes(2);
    expect(mockedGetMyCompany).toHaveBeenCalledTimes(2);

    await act(async () => {
      refocusedPolicy.resolve(policyFixture({ version: 9 }));
      refocusedSettings.resolve(companySettingsFixture({ currencyLabel: "REFOCUSED" }));
      await flushPromises();
    });
    expect(renderedOutput(renderer)).toContain("Version 9");
    expect(renderedOutput(renderer)).not.toContain("Unsaved pay-rule changes");
    expect(findButton(renderer, "Save as new version").props.disabled).toBe(true);

    const cleanSave = findButton(renderer, "Save as new version").props.onPress;
    await act(async () => {
      cleanSave();
      await flushPromises();
    });
    expect(mockedUpdateMyPayPolicy).toHaveBeenCalledTimes(1);
    expect(mockedGetMyPayPolicy).toHaveBeenCalledTimes(2);
    expect(mockedGetMyCompany).toHaveBeenCalledTimes(2);
  });

  it("keeps a blurred confirmed save clean through failed reconciliation and GET-only Retry", async () => {
    const blurredSave = deferred<PayPolicy>();
    const failedReconciliation = deferred<PayPolicy>();
    const saved = policyFixture({
      version: 8,
      rules: [
        {
          id: 8001,
          name: "Confirmed while blurred",
          type: "TIME_OF_DAY",
          enabled: true,
          premiumPercent: 30,
          condition: { startTime: "21:00", endTime: "05:00" }
        }
      ]
    });
    mockedGetMyPayPolicy.mockResolvedValueOnce(policyFixture({ version: 3 }));
    mockedUpdateMyPayPolicy.mockReturnValueOnce(blurredSave.promise);
    const renderer = await renderScreen();

    act(() => editFirstRuleName(renderer, "Submitted while blurred"));
    act(() => {
      findButton(renderer, "Save as new version").props.onPress();
      blurPayRulesScreen();
    });
    await act(async () => {
      blurredSave.resolve(saved);
      await flushPromises();
    });

    mockedGetMyPayPolicy.mockReturnValueOnce(failedReconciliation.promise);
    await act(async () => {
      refocusPayRulesScreen();
      await flushPromises();
    });
    expect(renderedOutput(renderer)).toContain("Version 8");
    expect(findFields(renderer, "Rule name")[0]?.props.value).toBe(
      "Confirmed while blurred"
    );
    await act(async () => {
      failedReconciliation.reject(new Error("reconciliation offline"));
      await flushPromises();
      await flushPromises();
    });

    expect(renderedOutput(renderer)).toContain("Could not refresh pay rules");
    expect(renderedOutput(renderer)).not.toContain("Unsaved pay-rule changes");
    expect(findButton(renderer, "Save as new version").props.disabled).toBe(true);
    const cleanSave = findButton(renderer, "Save as new version").props.onPress;
    act(() => void cleanSave());
    expect(mockedUpdateMyPayPolicy).toHaveBeenCalledTimes(1);

    mockedGetMyPayPolicy.mockResolvedValueOnce(saved);
    mockedGetMyCompany.mockResolvedValueOnce(
      companySettingsFixture({ currencyLabel: "RECONCILED" })
    );
    await act(async () => {
      findButton(renderer, "Retry refresh").props.onPress();
      await flushPromises();
    });
    expect(mockedUpdateMyPayPolicy).toHaveBeenCalledTimes(1);
    expect(mockedGetMyPayPolicy).toHaveBeenCalledTimes(3);
    expect(renderedOutput(renderer)).toContain("RECONCILED");
    expect(renderedOutput(renderer)).not.toContain("Unsaved pay-rule changes");
    expect(findButton(renderer, "Save as new version").props.disabled).toBe(true);
  });

  it("runs one queued refresh after a save failure without losing the actionable save error", async () => {
    const saveFailure = deferred<PayPolicy>();
    const queuedPolicy = deferred<PayPolicy>();
    const queuedSettings = deferred<CompanySettingsResponse>();
    mockedGetMyPayPolicy.mockResolvedValueOnce(policyFixture({ version: 3 }));
    mockedGetMyCompany.mockResolvedValueOnce(companySettingsFixture());
    mockedUpdateMyPayPolicy
      .mockReturnValueOnce(saveFailure.promise)
      .mockResolvedValueOnce(policyFixture({ version: 10 }));
    const renderer = await renderScreen();
    const reload = findButton(renderer, "Reload current policy").props.onPress;

    act(() => editFirstRuleName(renderer, "Failed save draft"));
    await act(async () => {
      findButton(renderer, "Save as new version").props.onPress();
      reload();
      reload();
      await flushPromises();
    });
    mockedGetMyPayPolicy.mockReturnValueOnce(queuedPolicy.promise);
    mockedGetMyCompany.mockReturnValueOnce(queuedSettings.promise);
    await act(async () => {
      saveFailure.reject(new Error("save offline"));
      await flushPromises();
      await flushPromises();
    });
    expect(mockedGetMyPayPolicy).toHaveBeenCalledTimes(2);
    await act(async () => {
      queuedPolicy.resolve(policyFixture({ version: 9 }));
      queuedSettings.resolve(companySettingsFixture({ currencyLabel: "AFTER_FAILURE" }));
      await flushPromises();
    });
    expect(renderedOutput(renderer)).toContain("Could not save pay rules");
    expect(renderedOutput(renderer)).toContain("Version 9");
    expect(findButton(renderer, "Save as new version").props.loading).toBe(false);

    act(() => editFirstRuleName(renderer, "Edited after failed save refresh"));
    await act(async () => {
      findButton(renderer, "Save as new version").props.onPress();
      await flushPromises();
      await flushPromises();
    });
    expect(mockedUpdateMyPayPolicy).toHaveBeenCalledTimes(2);
    expect(renderedOutput(renderer)).toContain("Version 10 is now current");
  });

  it("keeps mapped save validation detail actionable after a queued refresh clears stale field highlights", async () => {
    const saveFailure = deferred<PayPolicy>();
    const queuedPolicy = deferred<PayPolicy>();
    const queuedSettings = deferred<CompanySettingsResponse>();
    mockedGetMyPayPolicy.mockResolvedValueOnce(policyFixture({ version: 3 }));
    mockedGetMyCompany.mockResolvedValueOnce(companySettingsFixture());
    mockedUpdateMyPayPolicy
      .mockReturnValueOnce(saveFailure.promise)
      .mockResolvedValueOnce(policyFixture({ version: 10 }));
    const renderer = await renderScreen();
    const reload = findButton(renderer, "Reload current policy").props.onPress;

    act(() => editFirstRuleName(renderer, "Mapped error draft"));
    await act(async () => {
      findButton(renderer, "Save as new version").props.onPress();
      reload();
      await flushPromises();
    });
    mockedGetMyPayPolicy.mockReturnValueOnce(queuedPolicy.promise);
    mockedGetMyCompany.mockReturnValueOnce(queuedSettings.promise);
    await act(async () => {
      saveFailure.reject(
        new ApiError("rules[0].condition.endTime: must be different from startTime", 400)
      );
      await flushPromises();
      await flushPromises();
    });
    expect(findFields(renderer, "End local time")[0]?.props.error).toBe(
      "must be different from startTime"
    );

    await act(async () => {
      queuedPolicy.resolve(policyFixture({ version: 9 }));
      queuedSettings.resolve(companySettingsFixture({ currencyLabel: "VALIDATION_REFRESH" }));
      await flushPromises();
    });
    expect(findFields(renderer, "End local time")[0]?.props.error).toBeUndefined();
    expect(renderedOutput(renderer)).toContain(
      "Could not save pay rules: rules[0].condition.endTime: must be different from startTime"
    );

    act(() => void findFields(renderer, "End local time")[0]?.props.onChangeText("05:00"));
    expect(renderedOutput(renderer)).not.toContain("Could not save pay rules:");
    await act(async () => {
      findButton(renderer, "Save as new version").props.onPress();
      await flushPromises();
      await flushPromises();
    });
    expect(mockedUpdateMyPayPolicy).toHaveBeenCalledTimes(2);
    expect(renderedOutput(renderer)).not.toContain("Could not save pay rules");
    expect(renderedOutput(renderer)).toContain("Version 10 is now current");
  });

  it("does not let a save completing after blur/refocus overwrite the newer focused load", async () => {
    const savedPolicy = deferred<PayPolicy>();
    const focusedPolicy = deferred<PayPolicy>();
    const focusedSettings = deferred<CompanySettingsResponse>();
    mockedGetMyPayPolicy.mockResolvedValueOnce(policyFixture({ version: 3 }));
    mockedGetMyCompany.mockResolvedValueOnce(companySettingsFixture({ currencyLabel: "BEFORE" }));
    mockedUpdateMyPayPolicy.mockReturnValueOnce(savedPolicy.promise);
    const renderer = await renderScreen();

    act(() => editFirstRuleName(renderer, "Refocused authoritative draft"));
    await act(async () => {
      findButton(renderer, "Save as new version").props.onPress();
      await flushPromises();
      await flushPromises();
    });

    mockedGetMyPayPolicy.mockReturnValueOnce(focusedPolicy.promise);
    mockedGetMyCompany.mockReturnValueOnce(focusedSettings.promise);
    const refocusedRequest = jest.fn((request: (token: string) => Promise<unknown>) => request("refocused"));
    mockedUseAuth.mockReturnValue(authResult(refocusedRequest));
    await act(async () => {
      renderer.update(<ForemanPayRulesScreen {...screenProps} />);
      await flushPromises();
    });

    await act(async () => {
      savedPolicy.resolve(policyFixture({ version: 8 }));
      await flushPromises();
    });
    await act(async () => {
      focusedPolicy.resolve(policyFixture({ version: 10, rules: [{ id: 10, name: "Refocused", type: "WEEKLY_OVERTIME", enabled: true, premiumPercent: 25, condition: { thresholdMinutes: 123 } }] }));
      focusedSettings.resolve(companySettingsFixture({ currencyLabel: "REFOCUSED", defaultWorkerHourlyRate: 88 }));
      await flushPromises();
    });
    expect(renderedOutput(renderer)).toContain("Version 10");
    expect(renderedOutput(renderer)).toContain("REFOCUSED");
    expect(renderedOutput(renderer)).not.toContain("Version 8");
    expect(findFields(renderer, "Threshold hours")[0]?.props.value).toBe("2.05");
  });

  it("does not preserve a queued reload or update the unmounted screen when a save settles", async () => {
    const savedPolicy = deferred<PayPolicy>();
    mockedGetMyPayPolicy.mockResolvedValueOnce(policyFixture());
    mockedUpdateMyPayPolicy.mockReturnValueOnce(savedPolicy.promise);
    const renderer = await renderScreen();
    const goBack = screenProps.navigation.goBack as jest.Mock;

    act(() => editFirstRuleName(renderer, "Unmounted draft"));
    await act(async () => {
      findButton(renderer, "Save as new version").props.onPress();
      findButton(renderer, "Reload current policy").props.onPress();
      renderer.unmount();
      await flushPromises();
    });
    await act(async () => {
      savedPolicy.resolve(policyFixture({ version: 8 }));
      await flushPromises();
    });
    expect(goBack).not.toHaveBeenCalled();
    expect(mockedUpdateMyPayPolicy).toHaveBeenCalledTimes(1);
    expect(mockedGetMyPayPolicy).toHaveBeenCalledTimes(1);
    expect(mockedGetMyCompany).toHaveBeenCalledTimes(1);
    mountedRenderers.pop();
  });

  it("keeps a current focused save failure visible and allows another save", async () => {
    mockedGetMyPayPolicy.mockResolvedValueOnce(policyFixture());
    mockedUpdateMyPayPolicy
      .mockRejectedValueOnce(new Error("offline"))
      .mockResolvedValueOnce(policyFixture({ version: 8 }));
    const renderer = await renderScreen();

    act(() => editFirstRuleName(renderer, "Retryable draft"));
    await act(async () => {
      findButton(renderer, "Save as new version").props.onPress();
      await flushPromises();
      await flushPromises();
    });
    expect(renderedOutput(renderer)).toContain("Could not save pay rules");

    await act(async () => {
      findButton(renderer, "Save as new version").props.onPress();
      await flushPromises();
    });
    expect(mockedUpdateMyPayPolicy).toHaveBeenCalledTimes(2);
    expect(renderedOutput(renderer)).toContain("Version 8 is now current");
  });

  it("requires an authoritative reload after a backend version conflict", async () => {
    mockedGetMyPayPolicy
      .mockResolvedValueOnce(policyFixture({ version: 3 }))
      .mockRejectedValueOnce(new Error("conflict reload offline"));
    mockedUpdateMyPayPolicy.mockRejectedValueOnce(
      new ApiError("Pay policy version conflict. Reload current policy.", 409)
    );
    const renderer = await renderScreen();

    act(() => editFirstRuleName(renderer, "Conflict draft retained"));
    await act(async () => {
      findButton(renderer, "Save as new version").props.onPress();
      await flushPromises();
      await flushPromises();
    });

    expect(mockedUpdateMyPayPolicy).toHaveBeenCalledTimes(1);
    expect(mockedGetMyPayPolicy).toHaveBeenCalledTimes(2);
    expect(renderedOutput(renderer)).toContain(
      "Pay policy version conflict. Reload current policy."
    );
    expect(renderedOutput(renderer)).toContain("Could not refresh pay rules");
    expect(findButton(renderer, "Retry refresh")).toBeDefined();
    expect(findButton(renderer, "Save as new version").props.disabled).toBe(true);

    mockedGetMyPayPolicy.mockResolvedValueOnce(policyFixture({ version: 4 }));
    mockedGetMyCompany.mockResolvedValueOnce(
      companySettingsFixture({ currencyLabel: "CONFLICT_RELOADED" })
    );
    await act(async () => {
      findButton(renderer, "Retry refresh").props.onPress();
      await flushPromises();
    });

    expect(mockedUpdateMyPayPolicy).toHaveBeenCalledTimes(1);
    expect(renderedOutput(renderer)).toContain("Version 4");
    expect(renderedOutput(renderer)).toContain("CONFLICT_RELOADED");
    expect(findFields(renderer, "Rule name")[0]?.props.value).toBe(
      "Conflict draft retained"
    );
    expect(renderedOutput(renderer)).toContain("Unsaved pay-rule changes");
    expect(findButton(renderer, "Save as new version").props.disabled).toBe(false);
  });

  it("blocks rapid duplicate saves and a stored callback after authoritative success", async () => {
    const savedPolicy = deferred<PayPolicy>();
    mockedGetMyPayPolicy.mockResolvedValueOnce(policyFixture());
    mockedUpdateMyPayPolicy.mockReturnValueOnce(savedPolicy.promise);
    const renderer = await renderScreen();
    act(() => editFirstRuleName(renderer, "Duplicate-locked draft"));
    const staleSave = findButton(renderer, "Save as new version").props.onPress;

    act(() => {
      staleSave();
      staleSave();
    });
    expect(mockedUpdateMyPayPolicy).toHaveBeenCalledTimes(1);

    await act(async () => {
      savedPolicy.resolve(policyFixture({ version: 8 }));
      await flushPromises();
    });
    act(() => {
      staleSave();
    });

    expect(mockedUpdateMyPayPolicy).toHaveBeenCalledTimes(1);
    expect(renderedOutput(renderer)).toContain("Version 8 is now current");
  });

  it("shows a load failure and retries the focused GET successfully", async () => {
    mockedGetMyPayPolicy
      .mockRejectedValueOnce(new Error("offline"))
      .mockResolvedValueOnce(policyFixture({ version: 4, timeZone: "Europe/Paris" }));
    const renderer = await renderScreen();

    expect(renderedOutput(renderer)).toContain("Could not load pay rules");
    expect(findButton(renderer, "Retry")).toBeDefined();

    await act(async () => {
      findButton(renderer, "Retry").props.onPress();
      await flushPromises();
    });

    expect(authenticatedRequest).toHaveBeenCalledTimes(2);
    expect(mockedGetMyPayPolicy).toHaveBeenCalledTimes(2);
    expect(renderedOutput(renderer)).toContain("Europe/Paris");
    expect(renderedOutput(renderer)).toContain("Version 4");
  });

  it("hydrates the returned policy and new immutable version after a successful save", async () => {
    mockedGetMyPayPolicy.mockResolvedValueOnce(policyFixture());
    const returnedPolicy = policyFixture({
      id: 2001,
      version: 8,
      timeZone: "America/Toronto",
      weekStartsOn: "FRIDAY",
      stackingStrategy: "HIGHEST_ONLY",
      rules: [
        {
          id: 4001,
          name: "Backend-returned night rule",
          type: "TIME_OF_DAY",
          enabled: true,
          premiumPercent: 37.5,
          condition: {
            startTime: "23:00",
            endTime: "05:00"
          }
        }
      ]
    });
    mockedUpdateMyPayPolicy.mockResolvedValueOnce(returnedPolicy);
    const renderer = await renderScreen();

    act(() => {
      findFields(renderer, "Rule name")[0]?.props.onChangeText("Local rule name");
    });

    await act(async () => {
      findButton(renderer, "Save as new version").props.onPress();
      await flushPromises();
    });

    expect(mockedUpdateMyPayPolicy).toHaveBeenCalledWith(
      "foreman-token",
      expect.objectContaining({
        rules: expect.arrayContaining([
          expect.objectContaining({ name: "Local rule name" })
        ])
      })
    );
    expect(findFields(renderer, "Rule name")[0]?.props.value).toBe(
      "Backend-returned night rule"
    );
    expect(findSegmentedControl(renderer, "Week starts on").props.value).toBe("FRIDAY");
    expect(findSegmentedControl(renderer, "Stacking strategy").props.value).toBe(
      "HIGHEST_ONLY"
    );

    const output = renderedOutput(renderer);
    expect(output).toContain("America/Toronto");
    expect(output).toContain("Version 8");
    expect(output).toContain("Pay rules saved");
    expect(output).toContain("Earlier versions remain unchanged");
  });

  it("edits every canonical rule type and sends the exact PUT contract", async () => {
    mockedGetMyPayPolicy.mockResolvedValueOnce(
      policyFixture({
        weekStartsOn: "SUNDAY",
        stackingStrategy: "HIGHEST_ONLY",
        rules: [
          {
            id: 1,
            name: "Night",
            type: "TIME_OF_DAY",
            enabled: true,
            premiumPercent: 25,
            condition: { startTime: "22:00", endTime: "06:00" }
          },
          {
            id: 2,
            name: "Daily",
            type: "DAILY_OVERTIME",
            enabled: true,
            premiumPercent: 50,
            condition: { thresholdMinutes: 510 }
          },
          {
            id: 3,
            name: "Weekly",
            type: "WEEKLY_OVERTIME",
            enabled: false,
            premiumPercent: 75.125,
            condition: { thresholdMinutes: 2400 }
          },
          {
            id: 4,
            name: "Weekend",
            type: "DAY_OF_WEEK",
            enabled: true,
            premiumPercent: 37.5,
            condition: { weekdays: ["SATURDAY", "SUNDAY"] }
          },
          {
            id: 5,
            name: "Manual holidays",
            type: "HOLIDAY",
            enabled: true,
            premiumPercent: 100,
            condition: {
              dates: [
                { date: "2026-12-25", label: "Company holiday" },
                { date: "2026-12-31" }
              ]
            }
          }
        ]
      })
    );
    mockedUpdateMyPayPolicy.mockResolvedValueOnce(policyFixture({ version: 4 }));
    const renderer = await renderScreen();

    expect(findFields(renderer, "Start local time")).toHaveLength(1);
    expect(findFields(renderer, "End local time")).toHaveLength(1);
    expect(findFields(renderer, "Threshold hours").map((field) => field.props.value)).toEqual([
      "8.5",
      "40"
    ]);
    expect(findFields(renderer, "Date (YYYY-MM-DD)")).toHaveLength(2);
    expect(findFields(renderer, "Label (optional)")).toHaveLength(2);
    expect(renderedOutput(renderer)).toContain("Choose every company-local weekday");
    expect(renderedOutput(renderer)).toContain("no automatic legal or country calendar");

    act(() => {
      findSegmentedControl(renderer, "Week starts on").props.onChange("THURSDAY");
      findSegmentedControl(renderer, "Stacking strategy").props.onChange("ADD");
      const switches = renderer.root.findAllByType(Switch);
      switches[0]?.props.onValueChange(false);
      switches[2]?.props.onValueChange(true);
    });
    act(() => {
      const percentages = findFields(renderer, "Premium percent");
      percentages[0]?.props.onChangeText("26.5");
      percentages[1]?.props.onChangeText("51.25");
      percentages[2]?.props.onChangeText("76");
      percentages[3]?.props.onChangeText("38.125");
      percentages[4]?.props.onChangeText("110");
    });
    act(() => {
      findFields(renderer, "Start local time")[0]?.props.onChangeText("21:30");
      const thresholds = findFields(renderer, "Threshold hours");
      thresholds[0]?.props.onChangeText("9");
      thresholds[1]?.props.onChangeText("42.5");
      renderer.root.findByProps({ accessibilityLabel: "Mon weekday" }).props.onPress();
      findFields(renderer, "Date (YYYY-MM-DD)")[0]?.props.onChangeText("2027-01-01");
    });
    act(() => {
      findFields(renderer, "End local time")[0]?.props.onChangeText("05:15");
      renderer.root.findByProps({ accessibilityLabel: "Sun weekday" }).props.onPress();
      findFields(renderer, "Label (optional)")[0]?.props.onChangeText("New Year");
    });
    act(() => {
      const removeDates = renderer.root
        .findAllByType(Button)
        .filter((button) => button.props.label === "Remove date");
      removeDates[1]?.props.onPress();
    });
    act(() => {
      findButton(renderer, "Add holiday date").props.onPress();
    });
    act(() => {
      findFields(renderer, "Date (YYYY-MM-DD)")[1]?.props.onChangeText("2027-05-01");
    });
    act(() => {
      findFields(renderer, "Label (optional)")[1]?.props.onChangeText("Labour Day");
    });

    await act(async () => {
      findButton(renderer, "Save as new version").props.onPress();
      await flushPromises();
    });

    expect(mockedUpdateMyPayPolicy).toHaveBeenCalledWith("foreman-token", {
      weekStartsOn: "THURSDAY",
      stackingStrategy: "ADD",
      rules: [
        {
          name: "Night",
          type: "TIME_OF_DAY",
          enabled: false,
          premiumPercent: 26.5,
          condition: { startTime: "21:30", endTime: "05:15" }
        },
        {
          name: "Daily",
          type: "DAILY_OVERTIME",
          enabled: true,
          premiumPercent: 51.25,
          condition: { thresholdMinutes: 540 }
        },
        {
          name: "Weekly",
          type: "WEEKLY_OVERTIME",
          enabled: true,
          premiumPercent: 76,
          condition: { thresholdMinutes: 2550 }
        },
        {
          name: "Weekend",
          type: "DAY_OF_WEEK",
          enabled: true,
          premiumPercent: 38.125,
          condition: { weekdays: ["MONDAY", "SATURDAY"] }
        },
        {
          name: "Manual holidays",
          type: "HOLIDAY",
          enabled: true,
          premiumPercent: 110,
          condition: {
            dates: [
              { date: "2027-01-01", label: "New Year" },
              { date: "2027-05-01", label: "Labour Day" }
            ]
          }
        }
      ]
    });
  });

  it("clears only a corrected field error and preserves an unrelated validation error", async () => {
    mockedGetMyPayPolicy.mockResolvedValueOnce(policyFixture());
    const renderer = await renderScreen();

    act(() => {
      findFields(renderer, "Premium percent")[0]?.props.onChangeText("10.12345");
    });
    act(() => {
      findFields(renderer, "Premium percent")[1]?.props.onChangeText("1000.0001");
    });
    act(() => {
      findButton(renderer, "Save as new version").props.onPress();
    });

    let premiumFields = findFields(renderer, "Premium percent");
    expect(premiumFields[0]?.props.error).toBe(
      "Enter 0 through 1000 with no more than 4 decimal places."
    );
    expect(premiumFields[1]?.props.error).toBe(
      "Enter 0 through 1000 with no more than 4 decimal places."
    );

    act(() => {
      premiumFields[0]?.props.onChangeText("37.5");
    });

    premiumFields = findFields(renderer, "Premium percent");
    expect(premiumFields[0]?.props.error).toBeUndefined();
    expect(premiumFields[1]?.props.error).toBe(
      "Enter 0 through 1000 with no more than 4 decimal places."
    );
    expect(mockedUpdateMyPayPolicy).not.toHaveBeenCalled();
  });

  it("keeps a backend holiday condition error when only enabled is toggled", async () => {
    mockedGetMyPayPolicy.mockResolvedValueOnce(
      policyFixture({
        rules: [
          {
            id: 3003,
            name: "Company holidays",
            type: "HOLIDAY",
            enabled: true,
            premiumPercent: 100,
            condition: {
              dates: [
                { date: "2026-12-25", label: "First" },
                { date: "2026-12-25", label: "Duplicate" }
              ]
            }
          }
        ]
      })
    );
    mockedUpdateMyPayPolicy.mockRejectedValueOnce(
      new ApiError(
        "rules[0].condition.dates: must not contain duplicate dates",
        400
      )
    );
    const renderer = await renderScreen();

    act(() => editFirstRuleName(renderer, "Holiday validation draft"));
    await act(async () => {
      findButton(renderer, "Save as new version").props.onPress();
      await flushPromises();
    });

    expect(renderedOutput(renderer)).toContain("must not contain duplicate dates");
    expect(mockedUpdateMyPayPolicy).toHaveBeenCalledTimes(1);

    act(() => {
      renderer.root.findByType(Switch).props.onValueChange(false);
    });

    expect(renderer.root.findByType(Switch).props.value).toBe(false);
    expect(renderedOutput(renderer)).toContain("must not contain duplicate dates");
  });

  it("keeps partial overtime hours editable and saves 8.5 hours as 510 whole minutes", async () => {
    mockedGetMyPayPolicy.mockResolvedValueOnce(policyFixture());
    mockedUpdateMyPayPolicy.mockResolvedValueOnce(policyFixture());
    const renderer = await renderScreen();
    let threshold = findFields(renderer, "Threshold hours")[0]!;

    act(() => void threshold.props.onChangeText("8."));
    expect(findFields(renderer, "Threshold hours")[0]?.props.value).toBe("8.");
    act(() => {
      threshold = findFields(renderer, "Threshold hours")[0]!;
    });
    act(() => void threshold.props.onChangeText("8.5"));
    expect(findFields(renderer, "Threshold hours")[0]?.props.value).toBe("8.5");

    await act(async () => {
      findButton(renderer, "Save as new version").props.onPress();
      await flushPromises();
    });
    expect(mockedUpdateMyPayPolicy).toHaveBeenCalledWith(
      "foreman-token",
      expect.objectContaining({
        rules: expect.arrayContaining([
          expect.objectContaining({ condition: { thresholdMinutes: 510 } })
        ])
      })
    );
  });

  it.each(["", "0", "-1", "8.", "abc", "8.333"]) (
    "blocks incomplete or fractional-minute overtime hours %s",
    async (value) => {
      mockedGetMyPayPolicy.mockResolvedValueOnce(policyFixture());
      const renderer = await renderScreen();
      act(() => void findFields(renderer, "Threshold hours")[0]?.props.onChangeText(value));
      act(() => void findButton(renderer, "Save as new version").props.onPress());
      expect(findFields(renderer, "Threshold hours")[0]?.props.error).toBe(
        "Enter hours from 1 through 2147483647 minutes with no fractional minutes."
      );
      expect(mockedUpdateMyPayPolicy).not.toHaveBeenCalled();
    }
  );

  it("hydrates both overtime editor types from backend minute thresholds", async () => {
    mockedGetMyPayPolicy.mockResolvedValueOnce(
      policyFixture({
        rules: [
          { id: 1, name: "Daily", type: "DAILY_OVERTIME", enabled: true, premiumPercent: 25, condition: { thresholdMinutes: 510 } },
          { id: 2, name: "Weekly", type: "WEEKLY_OVERTIME", enabled: true, premiumPercent: 25, condition: { thresholdMinutes: 2400 } }
        ]
      })
    );
    const renderer = await renderScreen();
    expect(findFields(renderer, "Threshold hours").map((input) => input.props.value)).toEqual(["8.5", "40"]);
  });

  it("round-trips exact decimal hours for daily and weekly thresholds", async () => {
    mockedGetMyPayPolicy.mockResolvedValueOnce(
      policyFixture({
        rules: [
          { id: 1, name: "Daily", type: "DAILY_OVERTIME", enabled: true, premiumPercent: 25, condition: { thresholdMinutes: 492 } },
          { id: 2, name: "Weekly", type: "WEEKLY_OVERTIME", enabled: true, premiumPercent: 25, condition: { thresholdMinutes: 123 } }
        ]
      })
    );
    mockedUpdateMyPayPolicy.mockResolvedValueOnce(policyFixture());
    const renderer = await renderScreen();
    expect(findFields(renderer, "Threshold hours").map((input) => input.props.value)).toEqual(["8.2", "2.05"]);

    act(() => void findFields(renderer, "Threshold hours")[0]?.props.onChangeText("8.2"));
    act(() => void findFields(renderer, "Threshold hours")[1]?.props.onChangeText("2.05"));
    await act(async () => {
      void findButton(renderer, "Save as new version").props.onPress();
      await flushPromises();
    });
    expect(mockedUpdateMyPayPolicy).toHaveBeenCalledWith(
      "foreman-token",
      expect.objectContaining({
        rules: expect.arrayContaining([
          expect.objectContaining({ condition: { thresholdMinutes: 492 } }),
          expect.objectContaining({ condition: { thresholdMinutes: 123 } })
        ])
      })
    );
  });

  it("accepts in-range Java Integer thresholds and blocks out-of-range edits for both overtime types", async () => {
    mockedGetMyPayPolicy.mockResolvedValueOnce(
      policyFixture({
        rules: [
          { id: 1, name: "Daily", type: "DAILY_OVERTIME", enabled: true, premiumPercent: 25, condition: { thresholdMinutes: 1 } },
          { id: 2, name: "Weekly", type: "WEEKLY_OVERTIME", enabled: true, premiumPercent: 25, condition: { thresholdMinutes: 1 } }
        ]
      })
    );
    const renderer = await renderScreen();
    act(() => void findFields(renderer, "Threshold hours")[0]?.props.onChangeText("35791394.1"));
    act(() => void findFields(renderer, "Threshold hours")[1]?.props.onChangeText("35791395"));
    act(() => void findButton(renderer, "Save as new version").props.onPress());
    expect(findFields(renderer, "Threshold hours")[0]?.props.error).toBeUndefined();
    expect(findFields(renderer, "Threshold hours")[1]?.props.error).toBe(
      "Enter hours from 1 through 2147483647 minutes with no fractional minutes."
    );
    expect(mockedUpdateMyPayPolicy).not.toHaveBeenCalled();
  });

  it("applies the positive threshold bound to both daily and weekly overtime edits", async () => {
    mockedGetMyPayPolicy.mockResolvedValueOnce(
      policyFixture({
        rules: [
          { id: 1, name: "Daily", type: "DAILY_OVERTIME", enabled: true, premiumPercent: 25, condition: { thresholdMinutes: 1 } },
          { id: 2, name: "Weekly", type: "WEEKLY_OVERTIME", enabled: true, premiumPercent: 25, condition: { thresholdMinutes: 1 } }
        ]
      })
    );
    const renderer = await renderScreen();
    const thresholds = findFields(renderer, "Threshold hours");
    act(() => void thresholds[0]?.props.onChangeText("0"));
    act(() => void thresholds[1]?.props.onChangeText("0"));
    act(() => void findButton(renderer, "Save as new version").props.onPress());

    expect(findFields(renderer, "Threshold hours").map((field) => field.props.error)).toEqual([
      "Enter hours from 1 through 2147483647 minutes with no fractional minutes.",
      "Enter hours from 1 through 2147483647 minutes with no fractional minutes."
    ]);
    expect(mockedUpdateMyPayPolicy).not.toHaveBeenCalled();
  });

  it("saves an unchanged loaded 31-minute threshold without reparsing its non-terminating display", async () => {
    mockedGetMyPayPolicy.mockResolvedValueOnce(
      policyFixture({
        rules: [{ id: 1, name: "Daily", type: "DAILY_OVERTIME", enabled: true, premiumPercent: 25, condition: { thresholdMinutes: 31 } }]
      })
    );
    mockedUpdateMyPayPolicy.mockResolvedValueOnce(policyFixture());
    const renderer = await renderScreen();
    expect(findFields(renderer, "Threshold hours")[0]?.props.value).toBe(String(31 / 60));
    act(() => editFirstRuleName(renderer, "Keep loaded threshold"));
    await act(async () => {
      void findButton(renderer, "Save as new version").props.onPress();
      await flushPromises();
    });
    expect(mockedUpdateMyPayPolicy).toHaveBeenCalledWith(
      "foreman-token",
      expect.objectContaining({ rules: [expect.objectContaining({ condition: { thresholdMinutes: 31 } })] })
    );
  });

  it("replaces an externally reloaded overtime rule draft with its new authoritative minutes", async () => {
    mockedGetMyPayPolicy
      .mockResolvedValueOnce(
        policyFixture({
          rules: [{ id: 1, name: "Daily", type: "DAILY_OVERTIME", enabled: true, premiumPercent: 25, condition: { thresholdMinutes: 31 } }]
        })
      )
      .mockResolvedValueOnce(
        policyFixture({
          version: 4,
          rules: [{ id: 2, name: "Weekly", type: "WEEKLY_OVERTIME", enabled: true, premiumPercent: 25, condition: { thresholdMinutes: 492 } }]
        })
      );
    mockedUpdateMyPayPolicy.mockResolvedValueOnce(policyFixture());
    const renderer = await renderScreen();
    expect(findFields(renderer, "Threshold hours")[0]?.props.value).toBe(String(31 / 60));
    await act(async () => {
      void findButton(renderer, "Reload current policy").props.onPress();
      await flushPromises();
    });
    expect(findFields(renderer, "Threshold hours")[0]?.props.value).toBe("8.2");
    act(() => editFirstRuleName(renderer, "Save reloaded threshold"));
    await act(async () => {
      void findButton(renderer, "Save as new version").props.onPress();
      await flushPromises();
    });
    expect(mockedUpdateMyPayPolicy).toHaveBeenCalledWith(
      "foreman-token",
      expect.objectContaining({ rules: [expect.objectContaining({ condition: { thresholdMinutes: 492 } })] })
    );
  });

  it.each([
    ["0", true], ["1000.0000", true], ["-1", false], ["1000.0001", false], ["10.12345", false], [".", false]
  ])("renders the preview only for a contract-valid percentage %s", async (percent, visible) => {
    mockedGetMyPayPolicy.mockResolvedValueOnce(policyFixture());
    const renderer = await renderScreen();
    act(() => void findFields(renderer, "Premium percent")[0]?.props.onChangeText(percent));
    const previews = renderer.root.findAll(
      (candidate) => candidate.children.includes("Illustrative single-rule example")
    );
    expect(previews).toHaveLength(visible ? 2 : 1);
  });

  it("hides the preview without a usable label or worker default, including worker default zero as valid", async () => {
    mockedGetMyPayPolicy.mockResolvedValueOnce(policyFixture());
    mockedGetMyCompany.mockResolvedValueOnce(companySettingsFixture({ currencyLabel: null }));
    let renderer = await renderScreen();
    expect(renderedOutput(renderer)).not.toContain("Illustrative single-rule example");
    act(() => renderer.unmount());
    mountedRenderers.pop();

    mockedGetMyPayPolicy.mockResolvedValueOnce(policyFixture());
    mockedGetMyCompany.mockResolvedValueOnce(companySettingsFixture({ defaultWorkerHourlyRate: 0, defaultForemanHourlyRate: 500 }));
    renderer = await renderScreen();
    expect(renderedOutput(renderer)).toContain("Illustrative single-rule example");
  });

  it("keeps a non-canonical-boundary U+FEFF currency label usable for the worker-rate preview", async () => {
    mockedGetMyPayPolicy.mockResolvedValueOnce(policyFixture());
    mockedGetMyCompany.mockResolvedValueOnce(companySettingsFixture({ currencyLabel: "\uFEFF" }));
    const renderer = await renderScreen();
    expect(renderedOutput(renderer)).toContain("Illustrative single-rule example");
    expect(
      renderer.root.findAll((candidate) => candidate.children.includes("\uFEFF")).length
    ).toBeGreaterThan(0);
  });

  it("renders exact worker-default preview arithmetic and ignores the foreman default", async () => {
    mockedGetMyPayPolicy.mockResolvedValueOnce(policyFixture());
    mockedGetMyCompany.mockResolvedValueOnce(
      companySettingsFixture({ defaultWorkerHourlyRate: 20, defaultForemanHourlyRate: 100, currencyLabel: "EUR" })
    );
    const renderer = await renderScreen();
    const renderedText = renderer.root
      .findAll((candidate) => candidate.children.length > 0)
      .map((candidate) => candidate.children.join(""));
    expect(renderedText).toContain("Premium: +5.00 EUR/hour");
    expect(renderedText).toContain("Rate with this rule only: 25.00 EUR/hour");
    expect(renderedText).not.toContain("Premium: +25.00 EUR/hour");
    expect(renderedText).not.toContain("Rate with this rule only: 125.00 EUR/hour");
  });
});
