import type { ComponentProps } from "react";
import { act, create, type ReactTestRenderer } from "react-test-renderer";
import {
  approveManagedPayoutRequest,
  getManagedPayoutRequests
} from "../../api/payroll";
import { Button } from "../../components/Button";
import { useAuth } from "../../context/AuthContext";
import { ForemanPayrollRequestsScreen } from "../ForemanPayrollRequestsScreen";

jest.mock("@react-navigation/native", () => {
  const React = jest.requireActual<typeof import("react")>("react");
  return {
    useFocusEffect: (effect: () => void | (() => void)) =>
      React.useEffect(effect, [effect])
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
const navigation = { goBack: jest.fn(), navigate: jest.fn() };
const props = {
  navigation,
  route: { key: "foreman-payroll", name: "ForemanPayrollRequests" }
} as unknown as ComponentProps<typeof ForemanPayrollRequestsScreen>;

async function flushPromises() {
  await Promise.resolve();
  await Promise.resolve();
}

function findButton(view: ReactTestRenderer, label: string) {
  const button = view.root
    .findAllByType(Button)
    .find((candidate) => candidate.props.label === label);
  if (!button) {
    throw new Error(`Button not found: ${label}`);
  }
  return button;
}

describe("ForemanPayrollRequestsScreen navigation", () => {
  let view: ReactTestRenderer | null = null;

  beforeEach(() => {
    jest.clearAllMocks();
    mockedApprove.mockResolvedValue({} as never);
    mockedGetRequests.mockResolvedValue([]);
    mockedUseAuth.mockReturnValue({
      authenticatedRequest: jest.fn((request: (token: string) => Promise<unknown>) =>
        request("foreman-token")
      ),
      user: { role: "FOREMAN", company: { id: 10, name: "Acme" } }
    } as unknown as ReturnType<typeof useAuth>);
  });

  afterEach(() => {
    act(() => view?.unmount());
  });

  it("selects the foreman Dashboard tab from the explicit Back to dashboard action", async () => {
    await act(async () => {
      view = create(<ForemanPayrollRequestsScreen {...props} />);
      await flushPromises();
    });

    act(() => {
      findButton(view!, "Back to dashboard").props.onPress();
    });

    expect(navigation.navigate).toHaveBeenCalledWith("ForemanDashboard");
    expect(navigation.goBack).not.toHaveBeenCalled();
  });
});
