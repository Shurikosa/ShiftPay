import type { ComponentProps } from "react";
import { act, create, type ReactTestRenderer } from "react-test-renderer";
import { getMyCompany, updateMyCompany } from "../../api/companies";
import { Button } from "../../components/Button";
import { FormField } from "../../components/FormField";
import { useAuth } from "../../context/AuthContext";
import type { CompanySettingsResponse } from "../../types/company";
import { ForemanCompanySettingsScreen } from "../ForemanCompanySettingsScreen";

jest.mock("@react-navigation/native", () => {
  const React = jest.requireActual<typeof import("react")>("react");
  return { useFocusEffect: (effect: () => void | (() => void)) => React.useEffect(effect, [effect]) };
});
jest.mock("../../api/companies", () => ({ getMyCompany: jest.fn(), updateMyCompany: jest.fn() }));
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

type Props = ComponentProps<typeof ForemanCompanySettingsScreen>;
const props = {
  navigation: { goBack: jest.fn(), navigate: jest.fn() },
  route: { key: "settings", name: "ForemanCompanySettings", params: undefined }
} as unknown as Props;

async function flush(): Promise<void> {
  await Promise.resolve();
  await Promise.resolve();
  await Promise.resolve();
}

describe("ForemanCompanySettingsScreen", () => {
  let renderer: ReactTestRenderer | null = null;
  const authenticatedRequest = jest.fn((request: (token: string) => Promise<unknown>) => request("token"));
  const applyCompany = jest.fn().mockResolvedValue(undefined);
  const refreshCurrentUser = jest.fn().mockResolvedValue(undefined);

  beforeEach(() => {
    jest.clearAllMocks();
    mockedGetMyCompany.mockResolvedValue(settings);
    mockedUpdateMyCompany.mockResolvedValue(settings);
    mockedUseAuth.mockReturnValue({
      authenticatedRequest,
      applyCompany,
      refreshCurrentUser,
      user: { id: 5, role: "FOREMAN", company: settings }
    } as unknown as ReturnType<typeof useAuth>);
  });

  afterEach(() => {
    act(() => {
      renderer?.unmount();
    });
    renderer = null;
  });

  it("loads read-only metadata and saves independently cleared defaults", async () => {
    await act(async () => {
      renderer = create(<ForemanCompanySettingsScreen {...props} />);
      await flush();
    });
    expect(mockedGetMyCompany).toHaveBeenCalledWith("token");
    expect(JSON.stringify(renderer?.toJSON())).toContain("CMP123");
    expect(JSON.stringify(renderer?.toJSON())).toContain("Europe/Berlin");

    const fields = renderer!.root.findAllByType(FormField);
    await act(async () => {
      fields.find((field) => field.props.label === "Currency label")!.props.onChangeText("грн");
      fields.find((field) => field.props.label === "Default worker hourly rate")!.props.onChangeText("");
      await flush();
    });
    await act(async () => {
      renderer!.root.findAllByType(Button).find((button) => button.props.label === "Save company settings")!.props.onPress();
      await flush();
    });

    expect(mockedUpdateMyCompany).toHaveBeenCalledWith("token", {
      name: "Acme Construction",
      currencyLabel: "грн",
      defaultWorkerHourlyRate: null,
      defaultForemanHourlyRate: 30
    });
  });

  it("keeps a navigation notice, including the stale-label conflict, after loading and saving", async () => {
    const noticeProps = {
      ...props,
      route: {
        key: "settings-notice",
        name: "ForemanCompanySettings",
        params: { notice: "Company currency label must be configured before creating a shift." }
      }
    } as unknown as Props;
    await act(async () => {
      renderer = create(<ForemanCompanySettingsScreen {...noticeProps} />);
      await flush();
    });
    expect(JSON.stringify(renderer?.toJSON())).toContain("Company currency label must be configured before creating a shift.");

    await act(async () => {
      renderer!.root.findAllByType(Button).find((item) => item.props.label === "Save company settings")!.props.onPress();
      await flush();
    });
    expect(JSON.stringify(renderer?.toJSON())).toContain("Company currency label must be configured before creating a shift.");
  });

  it("offers Reload after an initial GET failure and renders the form after retry", async () => {
    mockedGetMyCompany.mockRejectedValueOnce(new Error("offline")).mockResolvedValueOnce(settings);
    await act(async () => {
      renderer = create(<ForemanCompanySettingsScreen {...props} />);
      await flush();
    });
    expect(JSON.stringify(renderer?.toJSON())).toContain("Could not load company settings");
    const reload = renderer!.root.findAllByType(Button).find((item) => item.props.label === "Reload");
    expect(reload).toBeDefined();
    await act(async () => {
      reload!.props.onPress();
      await flush();
    });
    expect(renderer!.root.findAllByType(FormField).find((item) => item.props.label === "Company name")?.props.value).toBe("Acme Construction");
  });

  it("opens Pay Rules from Company Settings", async () => {
    await act(async () => {
      renderer = create(<ForemanCompanySettingsScreen {...props} />);
      await flush();
    });
    await act(async () => {
      void renderer!.root.findAllByType(Button).find((item) => item.props.label === "Pay rules")!.props.onPress();
      await flush();
    });
    expect(props.navigation.navigate).toHaveBeenCalledWith("ForemanPayRules");
  });
});
