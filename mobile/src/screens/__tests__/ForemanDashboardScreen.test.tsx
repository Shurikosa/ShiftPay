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

  it("opens own Settings and does not expose Company Settings or Pay Rules directly", () => {
    act(() => {
      renderer = create(<ForemanDashboardScreen {...props} />);
    });
    expect(findButton(renderer!, "Settings")).toBeDefined();
    expect(renderer!.root.findAllByType(Button).some((button) => button.props.label === "Company settings")).toBe(false);
    expect(renderer!.root.findAllByType(Button).some((button) => button.props.label === "Pay rules")).toBe(false);
    act(() => void findButton(renderer!, "Settings").props.onPress());
    expect(navigation.navigate).toHaveBeenCalledWith("OwnSettings");
  });

  it("opens the separate managed-shift history without changing the detail route", () => {
    act(() => {
      renderer = create(<ForemanDashboardScreen {...props} />);
    });

    act(() => void findButton(renderer!, "My shift history").props.onPress());

    expect(navigation.navigate).toHaveBeenCalledWith("ForemanShifts");
  });

  it("keeps logout on-screen and retryable when safe logout fails", async () => {
    const signOut = jest.fn()
      .mockRejectedValueOnce(new Error("marker write failed"))
      .mockResolvedValueOnce(undefined);
    mockedUseAuth.mockReturnValue({
      user: { id: 5, firstName: "Frank", lastName: "Foreman", role: "FOREMAN", company: { id: 10, name: "Acme" } },
      signOut
    } as unknown as ReturnType<typeof useAuth>);
    await act(async () => {
      renderer = create(<ForemanDashboardScreen {...props} />);
    });

    await act(async () => {
      findButton(renderer!, "Log out").props.onPress();
      await Promise.resolve();
      await Promise.resolve();
    });
    expect(renderer!.root.findByProps({ testID: "foreman-logout-error" })).toBeDefined();
    expect(JSON.stringify(renderer!.toJSON())).toContain("Your session is still active");
    expect(findButton(renderer!, "Log out").props.loading).toBe(false);

    await act(async () => {
      findButton(renderer!, "Log out").props.onPress();
      await Promise.resolve();
    });
    expect(signOut).toHaveBeenCalledTimes(2);
  });
});
