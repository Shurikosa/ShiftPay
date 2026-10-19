import type React from "react";
import { act, create, type ReactTestRenderer } from "react-test-renderer";
import { useAuth } from "../../context/AuthContext";
import { AppNavigator } from "../AppNavigator";

jest.mock("@react-navigation/native", () => ({
  NavigationContainer: ({ children }: { children: React.ReactNode }) => children
}));
jest.mock("@react-navigation/native-stack", () => ({
  createNativeStackNavigator: () => {
    const { Text } = jest.requireActual<typeof import("react-native")>("react-native");
    return {
      Navigator: ({ children }: { children: React.ReactNode }) => children,
      Screen: ({ name }: { name: string }) => <Text>{name}</Text>
    };
  }
}));
jest.mock("../../context/AuthContext", () => ({ useAuth: jest.fn() }));
jest.mock("../../context/ForemanManagedShiftsContext", () => ({
  ForemanManagedShiftsProvider: ({ children }: { children: React.ReactNode }) => children
}));
jest.mock("../../context/WorkerShiftHistoryContext", () => ({
  WorkerShiftHistoryProvider: ({ children }: { children: React.ReactNode }) => children
}));
jest.mock("../../screens/CreateCompanyScreen", () => {
  const React = jest.requireActual<typeof import("react")>("react");
  const { Text } = jest.requireActual<typeof import("react-native")>("react-native");

  return {
    CreateCompanyScreen: () => React.createElement(Text, null, "CreateCompanyGate")
  };
});
jest.mock("../../screens/RestoreSessionScreen", () => {
  const React = jest.requireActual<typeof import("react")>("react");
  const { Text } = jest.requireActual<typeof import("react-native")>("react-native");

  return {
    RestoreSessionScreen: () => React.createElement(Text, null, "RestoreSessionGate")
  };
});
jest.mock("../../screens/JoinCompanyScreen", () => {
  const React = jest.requireActual<typeof import("react")>("react");
  const { Text } = jest.requireActual<typeof import("react-native")>("react-native");

  return {
    JoinCompanyScreen: () => React.createElement(Text, null, "JoinCompanyGate")
  };
});
jest.mock("../../screens/UnsupportedRoleScreen", () => {
  const React = jest.requireActual<typeof import("react")>("react");
  const { Text } = jest.requireActual<typeof import("react-native")>("react-native");

  return {
    UnsupportedRoleScreen: () => React.createElement(Text, null, "UnsupportedRoleGate")
  };
});

const mockedUseAuth = jest.mocked(useAuth);

function output(): string {
  let renderer!: ReactTestRenderer;
  act(() => {
    renderer = create(<AppNavigator />);
  });
  const result = JSON.stringify(renderer.toJSON());
  act(() => renderer.unmount());
  return result;
}

describe("AppNavigator role behavior", () => {
  it("renders only the restore gate while auth status is restoring", () => {
    mockedUseAuth.mockReturnValue({
      status: "restoring",
      user: null
    } as ReturnType<typeof useAuth>);

    const rendered = output();
    expect(rendered).toContain("RestoreSessionGate");
    expect(rendered).not.toContain("Login");
    expect(rendered).not.toContain("Register");
    expect(rendered).not.toContain("UnsupportedRoleGate");
    expect(rendered).not.toContain("WorkerDashboard");
    expect(rendered).not.toContain("ForemanDashboard");
  });

  it("keeps the auth stack for unauthenticated state", () => {
    mockedUseAuth.mockReturnValue({
      status: "unauthenticated",
      user: null
    } as ReturnType<typeof useAuth>);

    const rendered = output();
    expect(rendered).toContain("Login");
    expect(rendered).toContain("Register");
    expect(rendered).not.toContain("RestoreSessionGate");
    expect(rendered).not.toContain("UnsupportedRoleGate");
    expect(rendered).not.toContain("WorkerDashboard");
    expect(rendered).not.toContain("ForemanDashboard");
  });

  it("keeps the worker stack for an authenticated worker with a company", () => {
    mockedUseAuth.mockReturnValue({
      status: "authenticated",
      user: { role: "WORKER", company: { id: 10, name: "Acme" } }
    } as ReturnType<typeof useAuth>);

    const rendered = output();
    expect(rendered).toContain("WorkerDashboard");
    expect(rendered).toContain("JoinShift");
    expect(rendered).not.toContain("JoinCompanyGate");
    expect(rendered).not.toContain("RestoreSessionGate");
    expect(rendered).not.toContain("UnsupportedRoleGate");
    expect(rendered).not.toContain("Login");
    expect(rendered).not.toContain("ForemanDashboard");
  });

  it("shows only the join-company gate for an authenticated worker without a company", () => {
    mockedUseAuth.mockReturnValue({
      status: "authenticated",
      user: { role: "WORKER", company: null }
    } as ReturnType<typeof useAuth>);

    const rendered = output();
    expect(rendered).toContain("JoinCompanyGate");
    expect(rendered).not.toContain("RestoreSessionGate");
    expect(rendered).not.toContain("UnsupportedRoleGate");
    expect(rendered).not.toContain("Login");
    expect(rendered).not.toContain("WorkerDashboard");
    expect(rendered).not.toContain("ForemanDashboard");
  });

  it("registers Company Settings and nested Pay Rules for a foreman only", () => {
    mockedUseAuth.mockReturnValue({
      status: "authenticated",
      user: { role: "FOREMAN", company: { id: 10, name: "Acme" } }
    } as ReturnType<typeof useAuth>);
    const rendered = output();
    expect(rendered).toContain("ForemanCompanySettings");
    expect(rendered).toContain("ForemanPayRules");
    expect(rendered).not.toContain("JoinCompanyGate");
    expect(rendered).not.toContain("UnsupportedRoleGate");
  });

  it("shows only the create-company gate for an authenticated foreman without a company", () => {
    mockedUseAuth.mockReturnValue({
      status: "authenticated",
      user: { role: "FOREMAN", company: null }
    } as ReturnType<typeof useAuth>);

    const rendered = output();
    expect(rendered).toContain("CreateCompanyGate");
    expect(rendered).not.toContain("JoinCompanyGate");
    expect(rendered).not.toContain("UnsupportedRoleGate");
    expect(rendered).not.toContain("WorkerDashboard");
    expect(rendered).not.toContain("ForemanDashboard");
    expect(rendered).not.toContain("Login");
    expect(rendered).not.toContain("Register");
    expect(rendered).not.toContain("RestoreSessionGate");
  });

  it("shows only the unsupported-role gate for an authenticated admin", () => {
    mockedUseAuth.mockReturnValue({
      status: "authenticated",
      user: { role: "ADMIN", company: null }
    } as ReturnType<typeof useAuth>);

    const rendered = output();
    expect(rendered).toContain("UnsupportedRoleGate");
    expect(rendered).not.toContain("JoinCompanyGate");
    expect(rendered).not.toContain("RestoreSessionGate");
    expect(rendered).not.toContain("Login");
    expect(rendered).not.toContain("Register");
    expect(rendered).not.toContain("WorkerDashboard");
    expect(rendered).not.toContain("ForemanDashboard");
  });

  it.each(["WORKER", "ADMIN"] as const)("does not expose foreman-only routes to %s", (role) => {
    mockedUseAuth.mockReturnValue({
      status: "authenticated",
      user: { role, company: { id: 10, name: "Acme" } }
    } as ReturnType<typeof useAuth>);
    expect(output()).not.toContain("ForemanCompanySettings");
    expect(output()).not.toContain("ForemanPayRules");
  });
});
