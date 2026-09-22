import type { ComponentProps } from "react";
import { act, create, type ReactTestRenderer } from "react-test-renderer";
import { Button } from "../../components/Button";
import { useAuth } from "../../context/AuthContext";
import { useForemanManagedShifts } from "../../hooks/useForemanManagedShifts";
import { ForemanDashboardScreen } from "../ForemanDashboardScreen";

jest.mock("../../context/AuthContext", () => ({ useAuth: jest.fn() }));
jest.mock("../../hooks/useForemanManagedShifts", () => ({ useForemanManagedShifts: jest.fn() }));

const mockedUseAuth = jest.mocked(useAuth);
const mockedUseForemanManagedShifts = jest.mocked(useForemanManagedShifts);
const navigation = { navigate: jest.fn(), goBack: jest.fn() };
const props = {
  navigation,
  route: { key: "dashboard", name: "ForemanDashboard" }
} as unknown as ComponentProps<typeof ForemanDashboardScreen>;

function findButton(renderer: ReactTestRenderer, label: string) {
  const button = renderer.root.findAllByType(Button).find((candidate) => candidate.props.label === label);
  if (!button) throw new Error(`Button not found: ${label}`);
  return button;
}

describe("ForemanDashboardScreen settings path", () => {
  let renderer: ReactTestRenderer | null = null;

  beforeEach(() => {
    jest.clearAllMocks();
    mockedUseAuth.mockReturnValue({
      user: { id: 5, firstName: "Frank", lastName: "Foreman", role: "FOREMAN", company: { id: 10, name: "Acme" } },
      signOut: jest.fn()
    } as unknown as ReturnType<typeof useAuth>);
    mockedUseForemanManagedShifts.mockReturnValue({
      shifts: [], loading: false, error: null, refresh: jest.fn().mockResolvedValue(undefined)
    } as never);
  });

  afterEach(() => {
    act(() => renderer?.unmount());
    renderer = null;
  });

  it("opens Company Settings and does not offer Pay Rules as a direct dashboard action", () => {
    act(() => {
      renderer = create(<ForemanDashboardScreen {...props} />);
    });
    expect(findButton(renderer!, "Company settings")).toBeDefined();
    expect(renderer!.root.findAllByType(Button).some((button) => button.props.label === "Pay rules")).toBe(false);
    act(() => void findButton(renderer!, "Company settings").props.onPress());
    expect(navigation.navigate).toHaveBeenCalledWith("ForemanCompanySettings");
  });
});
