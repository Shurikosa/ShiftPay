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
jest.mock("../../screens/UnsupportedRoleScreen", () => ({
  UnsupportedRoleScreen: () => null
}));

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
  it("registers Company Settings and nested Pay Rules for a foreman only", () => {
    mockedUseAuth.mockReturnValue({
      status: "authenticated",
      user: { role: "FOREMAN", company: { id: 10, name: "Acme" } }
    } as ReturnType<typeof useAuth>);
    expect(output()).toContain("ForemanCompanySettings");
    expect(output()).toContain("ForemanPayRules");
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
