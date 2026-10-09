import Ionicons from "@expo/vector-icons/Ionicons";
import { StatusBar } from "expo-status-bar";
import { act, create, type ReactTestRenderer } from "react-test-renderer";
import App from "../../App";
import { AuthProvider } from "../context/AuthContext";
import { AppNavigator } from "../navigation/AppNavigator";
import { RestoreSessionScreen } from "../screens/RestoreSessionScreen";

const mockUseFonts = jest.fn();

jest.mock("expo-font", () => ({
  useFonts: (...args: unknown[]) => mockUseFonts(...args)
}));

jest.mock("@expo/vector-icons/Ionicons", () => {
  const MockIonicons = () => null;
  MockIonicons.font = { ionicons: "ionicons-font-source" };

  return { __esModule: true, default: MockIonicons };
});

jest.mock("../context/AuthContext", () => {
  const React = jest.requireActual<typeof import("react")>("react");
  const { View } = jest.requireActual<typeof import("react-native")>("react-native");

  return {
    AuthProvider: ({ children }: { children: React.ReactNode }) =>
      React.createElement(View, { testID: "auth-provider" }, children)
  };
});

jest.mock("../navigation/AppNavigator", () => {
  const React = jest.requireActual<typeof import("react")>("react");
  const { View } = jest.requireActual<typeof import("react-native")>("react-native");

  return {
    AppNavigator: () => React.createElement(View, { testID: "app-navigator" })
  };
});

jest.mock("../screens/RestoreSessionScreen", () => {
  const React = jest.requireActual<typeof import("react")>("react");
  const { View } = jest.requireActual<typeof import("react-native")>("react-native");

  return {
    RestoreSessionScreen: () => React.createElement(View, { testID: "restore-session" })
  };
});

jest.mock("expo-status-bar", () => {
  const React = jest.requireActual<typeof import("react")>("react");
  const { View } = jest.requireActual<typeof import("react-native")>("react-native");

  return {
    StatusBar: () => React.createElement(View, { testID: "status-bar" })
  };
});

async function renderApp(): Promise<ReactTestRenderer> {
  let view!: ReactTestRenderer;
  await act(async () => {
    view = create(<App />);
  });
  return view;
}

function expectPersistentShell(view: ReactTestRenderer) {
  const provider = view.root.findByType(AuthProvider);
  const statusBar = provider.findByType(StatusBar);

  expect(statusBar.props.style).toBe("dark");
}

describe("App font preload gate", () => {
  beforeEach(() => {
    mockUseFonts.mockReset();
  });

  it("preloads the exact Ionicons font and shows a non-blank restore state while pending", async () => {
    mockUseFonts.mockReturnValue([false, null]);

    const view = await renderApp();

    expect(mockUseFonts).toHaveBeenCalledWith(Ionicons.font);
    expect(view.root.findAllByType(RestoreSessionScreen)).toHaveLength(1);
    expect(view.root.findAllByType(AppNavigator)).toHaveLength(0);
    expectPersistentShell(view);
  });

  it("renders the navigator after the Ionicons font loads", async () => {
    mockUseFonts.mockReturnValue([true, null]);

    const view = await renderApp();

    expect(view.root.findAllByType(AppNavigator)).toHaveLength(1);
    expect(view.root.findAllByType(RestoreSessionScreen)).toHaveLength(0);
    expectPersistentShell(view);
  });

  it("warns and renders the navigator when font loading fails", async () => {
    const fontError = new Error("font load failed");
    const warn = jest.spyOn(console, "warn").mockImplementation(() => undefined);
    mockUseFonts.mockReturnValue([false, fontError]);

    try {
      const view = await renderApp();

      expect(warn).toHaveBeenCalledTimes(1);
      expect(warn).toHaveBeenCalledWith("Failed to preload Ionicons font.", fontError);
      expect(view.root.findAllByType(AppNavigator)).toHaveLength(1);
      expect(view.root.findAllByType(RestoreSessionScreen)).toHaveLength(0);
      expectPersistentShell(view);
    } finally {
      warn.mockRestore();
    }
  });
});
