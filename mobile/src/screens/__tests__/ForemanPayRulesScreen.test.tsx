import type { ComponentProps } from "react";
import {
  act,
  create,
  type ReactTestInstance,
  type ReactTestRenderer
} from "react-test-renderer";
import { Switch } from "react-native";
import { ApiError } from "../../api/errors";
import { getMyPayPolicy, updateMyPayPolicy } from "../../api/payPolicy";
import { Button } from "../../components/Button";
import { FormField } from "../../components/FormField";
import { SegmentedControl } from "../../components/SegmentedControl";
import { useAuth } from "../../context/AuthContext";
import type { PayPolicy } from "../../types/payPolicy";
import { ForemanPayRulesScreen } from "../ForemanPayRulesScreen";

jest.mock("@react-navigation/native", () => {
  const actualReact = jest.requireActual<typeof import("react")>("react");

  return {
    useFocusEffect: (effect: () => void | (() => void)) => {
      actualReact.useEffect(effect, [effect]);
    }
  };
});

jest.mock("../../api/payPolicy", () => ({
  getMyPayPolicy: jest.fn(),
  updateMyPayPolicy: jest.fn()
}));

jest.mock("../../context/AuthContext", () => ({
  useAuth: jest.fn()
}));

const mockedGetMyPayPolicy = jest.mocked(getMyPayPolicy);
const mockedUpdateMyPayPolicy = jest.mocked(updateMyPayPolicy);
const mockedUseAuth = jest.mocked(useAuth);

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

describe("ForemanPayRulesScreen", () => {
  const mountedRenderers: ReactTestRenderer[] = [];
  let authenticatedRequest: jest.Mock;

  beforeAll(() => {
    (
      globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }
    ).IS_REACT_ACT_ENVIRONMENT = true;
  });

  beforeEach(() => {
    jest.clearAllMocks();
    mockedGetMyPayPolicy.mockReset();
    mockedUpdateMyPayPolicy.mockReset();

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
});
