import {
  NavigationContainer,
  createNavigationContainerRef,
  type InitialState
} from "@react-navigation/native";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { View } from "react-native";
import { act, create, type ReactTestRenderer } from "react-test-renderer";
import { MoreScreen } from "../../screens/MoreScreen";

type TestStackParamList = {
  Source: undefined;
  More: undefined;
};

const Stack = createNativeStackNavigator<TestStackParamList>();

function SourceScreen() {
  return <View testID="source-destination" />;
}

async function renderNavigator(
  navigationRef: ReturnType<typeof createNavigationContainerRef<TestStackParamList>>,
  initialState?: InitialState
): Promise<ReactTestRenderer> {
  let view!: ReactTestRenderer;
  await act(async () => {
    view = create(
      <NavigationContainer initialState={initialState} ref={navigationRef}>
        <Stack.Navigator
          initialRouteName="Source"
          screenOptions={{ headerShown: false }}
        >
          <Stack.Screen component={SourceScreen} name="Source" />
          <Stack.Screen component={MoreScreen} name="More" />
        </Stack.Navigator>
      </NavigationContainer>
    );
    await Promise.resolve();
  });
  return view;
}

describe("More native-stack navigation", () => {
  it("supports focus, state restoration, and native-stack Back without screen actions", async () => {
    const firstRef = createNavigationContainerRef<TestStackParamList>();
    const firstView = await renderNavigator(firstRef);

    expect(firstRef.isReady()).toBe(true);
    expect(firstRef.getCurrentRoute()?.name).toBe("Source");

    act(() => {
      firstRef.navigate("More");
    });
    expect(firstRef.getCurrentRoute()?.name).toBe("More");
    expect(firstView.root.findAllByType(MoreScreen)).toHaveLength(1);

    const restoredState = firstRef.getRootState() as InitialState;
    act(() => firstView.unmount());

    const restoredRef = createNavigationContainerRef<TestStackParamList>();
    const restoredView = await renderNavigator(restoredRef, restoredState);

    expect(restoredRef.getCurrentRoute()?.name).toBe("More");
    expect(restoredView.root.findAllByType(MoreScreen)).toHaveLength(1);

    act(() => {
      restoredRef.goBack();
    });
    expect(restoredRef.getCurrentRoute()?.name).toBe("Source");
    expect(restoredView.root.findAllByType(MoreScreen)).toHaveLength(0);

    act(() => restoredView.unmount());
  });
});
