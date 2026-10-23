import { Pressable, Text } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { act, create, type ReactTestRenderer } from "react-test-renderer";
import { Button } from "../../components/Button";
import { MoreScreen } from "../MoreScreen";

describe("MoreScreen", () => {
  let view: ReactTestRenderer | null = null;
  const originalFetch = globalThis.fetch;

  beforeEach(() => {
    globalThis.fetch = jest.fn();
  });

  afterEach(() => {
    if (view) {
      act(() => view?.unmount());
      view = null;
    }
    globalThis.fetch = originalFetch;
  });

  function renderScreen() {
    act(() => {
      view = create(<MoreScreen />);
    });
    return view!;
  }

  it("renders only an unfocusable safe-area destination with no placeholder or action", () => {
    const renderer = renderScreen();
    const safeArea = renderer.root.findByType(SafeAreaView);

    expect(safeArea.props).toMatchObject({
      accessible: false,
      testID: "more-empty-destination"
    });
    expect(renderer.root.findAllByType(Text)).toHaveLength(0);
    expect(renderer.root.findAllByType(Button)).toHaveLength(0);
    expect(renderer.root.findAllByType(Pressable)).toHaveLength(0);
    expect(JSON.stringify(renderer.toJSON())).not.toMatch(/coming soon|feature|settings/i);
    expect(globalThis.fetch).not.toHaveBeenCalled();
  });

  it("remains empty and side-effect free after unmount and restoration", () => {
    const first = renderScreen();
    act(() => {
      first.unmount();
      view = null;
    });

    const restored = renderScreen();

    expect(restored.root.findAllByType(SafeAreaView)).toHaveLength(1);
    expect(restored.root.findAllByType(Text)).toHaveLength(0);
    expect(restored.root.findAllByType(Button)).toHaveLength(0);
    expect(globalThis.fetch).not.toHaveBeenCalled();
  });
});
