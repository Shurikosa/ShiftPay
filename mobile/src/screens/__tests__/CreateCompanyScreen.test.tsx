import { act, create, type ReactTestRenderer } from "react-test-renderer";
import { createCompany } from "../../api/companies";
import { ApiError } from "../../api/errors";
import { Button } from "../../components/Button";
import { FormField } from "../../components/FormField";
import { useAuth } from "../../context/AuthContext";
import { CreateCompanyScreen } from "../CreateCompanyScreen";

jest.mock("../../api/companies", () => ({ createCompany: jest.fn() }));
jest.mock("../../context/AuthContext", () => ({ useAuth: jest.fn() }));
const mockedCreateCompany = jest.mocked(createCompany);
const mockedUseAuth = jest.mocked(useAuth);

async function flush() { await Promise.resolve(); await Promise.resolve(); await Promise.resolve(); }
function field(view: ReactTestRenderer, label: string) {
  const result = view.root.findAllByType(FormField).find((item) => item.props.label === label);
  if (!result) throw new Error(`Missing ${label}`);
  return result;
}
function button(view: ReactTestRenderer, label: string) {
  const result = view.root.findAllByType(Button).find((item) => item.props.label === label);
  if (!result) throw new Error(`Missing ${label}`);
  return result;
}

describe("CreateCompanyScreen", () => {
  let renderer: ReactTestRenderer | null = null;
  beforeEach(() => {
    jest.clearAllMocks();
    mockedCreateCompany.mockResolvedValue({ id: 10, name: "Acme", joinCode: "CMP123", currencyLabel: "EUR", defaultWorkerHourlyRate: null, defaultForemanHourlyRate: null, timeZone: "Europe/Berlin" });
    mockedUseAuth.mockReturnValue({ authenticatedRequest: jest.fn((request: (token: string) => Promise<unknown>) => request("token")), applyCompany: jest.fn().mockResolvedValue(undefined), refreshCurrentUser: jest.fn().mockResolvedValue(undefined), signOut: jest.fn() } as unknown as ReturnType<typeof useAuth>);
  });
  afterEach(() => { act(() => renderer?.unmount()); });

  async function render() {
    await act(async () => {
      renderer = create(<CreateCompanyScreen />);
      await flush();
    });
    return renderer!;
  }

  it("requires a currency label before creating a company", async () => {
    const view = await render();
    act(() => void button(view, "Create company").props.onPress());
    expect(field(view, "Currency label").props.error).toBe("Enter a currency label.");
    expect(mockedCreateCompany).not.toHaveBeenCalled();
  });

  it("preserves a Unicode label and independently submits optional zero defaults", async () => {
    const view = await render();
    act(() => {
      field(view, "Company name").props.onChangeText("Acme");
      field(view, "Currency label").props.onChangeText("грн");
      field(view, "Default worker hourly rate").props.onChangeText("0");
      field(view, "Default foreman hourly rate").props.onChangeText("");
    });
    await act(async () => { void button(view, "Create company").props.onPress(); await flush(); });
    expect(mockedCreateCompany).toHaveBeenCalledWith("token", { name: "Acme", currencyLabel: "грн", defaultWorkerHourlyRate: 0, defaultForemanHourlyRate: undefined });
  });

  it("shows a backend field validation error beside the affected rate", async () => {
    mockedCreateCompany.mockRejectedValueOnce(new ApiError("defaultForemanHourlyRate: must be non-negative", 400));
    const view = await render();
    act(() => {
      field(view, "Company name").props.onChangeText("Acme");
      field(view, "Currency label").props.onChangeText("EUR");
    });
    await act(async () => { void button(view, "Create company").props.onPress(); await flush(); });
    expect(field(view, "Default foreman hourly rate").props.error).toBe("must be non-negative");
  });
});
