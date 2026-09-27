import type { ComponentProps } from "react";
import { act, create, type ReactTestRenderer } from "react-test-renderer";
import { getMyCompany } from "../../api/companies";
import { ApiError } from "../../api/errors";
import { createShift } from "../../api/shifts";
import { Button } from "../../components/Button";
import { FormField } from "../../components/FormField";
import { useAuth } from "../../context/AuthContext";
import { useForemanManagedShifts } from "../../hooks/useForemanManagedShifts";
import type { CompanySettingsResponse } from "../../types/company";
import { CreateShiftScreen } from "../CreateShiftScreen";

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

function settings(overrides: Partial<CompanySettingsResponse> = {}): CompanySettingsResponse {
  return {
    id: 10,
    name: "Acme",
    joinCode: "CMP123",
    currencyLabel: "EUR",
    defaultWorkerHourlyRate: 20,
    defaultForemanHourlyRate: 30,
    timeZone: "Europe/Berlin",
    ...overrides
  };
}

async function flush(): Promise<void> {
  await Promise.resolve();
  await Promise.resolve();
  await Promise.resolve();
}

function field(renderer: ReactTestRenderer, label: string) {
  const result = renderer.root.findAllByType(FormField).find((item) => item.props.label.startsWith(label));
  if (!result) throw new Error(`Missing ${label}`);
  return result;
}

function button(renderer: ReactTestRenderer, label: string) {
  const result = renderer.root.findAllByType(Button).find((item) => item.props.label === label);
  if (!result) throw new Error(`Missing ${label}`);
  return result;
}

describe("CreateShiftScreen rate overrides", () => {
  let renderer: ReactTestRenderer | null = null;

  beforeEach(() => {
    jest.clearAllMocks();
    mockedGetMyCompany.mockResolvedValue(settings());
    mockedCreateShift.mockResolvedValue({ id: 99 } as Awaited<ReturnType<typeof createShift>>);
    mockedUseForemanManagedShifts.mockReturnValue({ refresh: jest.fn().mockResolvedValue(undefined) } as never);
    mockedUseAuth.mockReturnValue({
      user: { id: 5, role: "FOREMAN", company: { id: 10, name: "Acme", currencyLabel: "EUR" } },
      authenticatedRequest: jest.fn((request: (token: string) => Promise<unknown>) => request("token"))
    } as unknown as ReturnType<typeof useAuth>);
  });

  afterEach(() => {
    act(() => renderer?.unmount());
    renderer = null;
  });

  async function renderScreen(): Promise<ReactTestRenderer> {
    await act(async () => {
      renderer = create(<CreateShiftScreen {...props} />);
      await flush();
    });
    return renderer!;
  }

  it("prefills defaults, omits deliberately blank overrides, and keeps worker and foreman fallbacks independent", async () => {
    mockedGetMyCompany.mockResolvedValue(settings({ defaultWorkerHourlyRate: 20, defaultForemanHourlyRate: null }));
    const view = await renderScreen();
    expect(field(view, "Default hourly rate").props.value).toBe("20");
    expect(field(view, "Foreman hourly rate").props.value).toBe("");

    act(() => {
      field(view, "Default hourly rate").props.onChangeText("");
      field(view, "Foreman hourly rate").props.onChangeText("25");
    });
    await act(async () => {
      void button(view, "Create shift").props.onPress();
      await flush();
    });
    expect(mockedCreateShift).toHaveBeenCalledWith("token", {
      location: "",
      foremanHourlyRate: 25
    });
  });

  it.each(["abc", ".", "-1", "10.123"]) ("blocks invalid worker override %s even with a company default", async (value) => {
    const view = await renderScreen();
    act(() => {
      field(view, "Default hourly rate").props.onChangeText(value);
    });
    act(() => {
      button(view, "Create shift").props.onPress();
    });
    expect(field(view, "Default hourly rate").props.error).toBe("Use a non-negative rate with up to two decimal places.");
    expect(mockedCreateShift).not.toHaveBeenCalled();
  });

  it("blocks an empty input when its matching company default is absent", async () => {
    mockedGetMyCompany.mockResolvedValue(settings({ defaultWorkerHourlyRate: null }));
    const view = await renderScreen();
    act(() => void button(view, "Create shift").props.onPress());
    expect(field(view, "Default hourly rate").props.error).toBe("Enter a worker rate or set a company default.");
    expect(mockedCreateShift).not.toHaveBeenCalled();
  });

  it("sends numeric zero as an explicit override", async () => {
    const view = await renderScreen();
    act(() => {
      field(view, "Default hourly rate").props.onChangeText("0");
      field(view, "Foreman hourly rate").props.onChangeText("0");
    });
    await act(async () => {
      button(view, "Create shift").props.onPress();
      await flush();
    });
    expect(mockedCreateShift).toHaveBeenCalledWith("token", expect.objectContaining({ defaultHourlyRate: 0, foremanHourlyRate: 0 }));
  });

  it("does not let a stale settings response overwrite a user edit", async () => {
    let resolve!: (value: CompanySettingsResponse) => void;
    mockedGetMyCompany.mockReturnValueOnce(new Promise((done) => { resolve = done; }));
    await act(async () => {
      renderer = create(<CreateShiftScreen {...props} />);
      await Promise.resolve();
    });
    act(() => void field(renderer!, "Default hourly rate").props.onChangeText("17"));
    await act(async () => {
      resolve(settings({ defaultWorkerHourlyRate: 20 }));
      await flush();
    });
    expect(field(renderer!, "Default hourly rate").props.value).toBe("17");
  });

  it("redirects a legacy null label and preserves the backend stale-label conflict as a notice", async () => {
    mockedGetMyCompany.mockResolvedValueOnce(settings({ currencyLabel: null }));
    await renderScreen();
    expect(navigation.replace).toHaveBeenCalledWith("ForemanCompanySettings", expect.objectContaining({ notice: expect.stringContaining("currency label") }));
    act(() => renderer?.unmount());
    renderer = null;
    navigation.replace.mockClear();

    mockedGetMyCompany.mockResolvedValueOnce(settings());
    mockedCreateShift.mockRejectedValueOnce(new ApiError("currency label must be configured", 409));
    const view = await renderScreen();
    await act(async () => {
      button(view, "Create shift").props.onPress();
      await flush();
    });
    expect(navigation.replace).toHaveBeenCalledWith("ForemanCompanySettings", { notice: "currency label must be configured" });
  });
});
