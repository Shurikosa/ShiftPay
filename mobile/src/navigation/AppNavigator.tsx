import {
  createBottomTabNavigator,
  type BottomTabNavigationOptions
} from "@react-navigation/bottom-tabs";
import {
  NavigationContainer,
  type InitialState,
  type NavigationContainerRefWithCurrent,
  type ParamListBase
} from "@react-navigation/native";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { AppIcon, type AppIconName } from "../components/AppIcon";
import { useAuth } from "../context/AuthContext";
import { ForemanManagedShiftsProvider } from "../context/ForemanManagedShiftsContext";
import { WorkerShiftHistoryProvider } from "../context/WorkerShiftHistoryContext";
import { CreateCompanyScreen } from "../screens/CreateCompanyScreen";
import { CreateShiftScreen } from "../screens/CreateShiftScreen";
import { ForemanDashboardScreen } from "../screens/ForemanDashboardScreen";
import { ForemanCompanySettingsScreen } from "../screens/ForemanCompanySettingsScreen";
import { ForemanPayRulesScreen } from "../screens/ForemanPayRulesScreen";
import { ForemanPayrollRequestsScreen } from "../screens/ForemanPayrollRequestsScreen";
import { ForemanShiftDetailsScreen } from "../screens/ForemanShiftDetailsScreen";
import { ForemanShiftsScreen } from "../screens/ForemanShiftsScreen";
import { JoinCompanyScreen } from "../screens/JoinCompanyScreen";
import { JoinShiftScreen } from "../screens/JoinShiftScreen";
import { LoginScreen } from "../screens/LoginScreen";
import { MoreScreen } from "../screens/MoreScreen";
import { MyShiftHistoryScreen } from "../screens/MyShiftHistoryScreen";
import { OwnSettingsScreen } from "../screens/OwnSettingsScreen";
import { RegisterScreen } from "../screens/RegisterScreen";
import { RestoreSessionScreen } from "../screens/RestoreSessionScreen";
import { ShiftSummaryScreen } from "../screens/ShiftSummaryScreen";
import { UnsupportedRoleScreen } from "../screens/UnsupportedRoleScreen";
import { WorkerDashboardScreen } from "../screens/WorkerDashboardScreen";
import { WorkerPayrollScreen } from "../screens/WorkerPayrollScreen";
import { WorkerShiftDetailsScreen } from "../screens/WorkerShiftDetailsScreen";
import type {
  AuthStackParamList,
  ForemanGateStackParamList,
  ForemanStackParamList,
  ForemanTabParamList,
  WorkerGateStackParamList,
  WorkerStackParamList,
  WorkerTabParamList
} from "../types/navigation";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import { theme } from "../utils/theme";

const AuthStack = createNativeStackNavigator<AuthStackParamList>();
const WorkerStack = createNativeStackNavigator<WorkerStackParamList>();
const ForemanStack = createNativeStackNavigator<ForemanStackParamList>();
const WorkerTabs = createBottomTabNavigator<WorkerTabParamList>();
const ForemanTabs = createBottomTabNavigator<ForemanTabParamList>();
const WorkerGateStack = createNativeStackNavigator<WorkerGateStackParamList>();
const ForemanGateStack = createNativeStackNavigator<ForemanGateStackParamList>();

function AuthNavigator() {
  return (
    <AuthStack.Navigator screenOptions={{ headerShown: false }}>
      <AuthStack.Screen component={LoginScreen} name="Login" />
      <AuthStack.Screen component={RegisterScreen} name="Register" />
    </AuthStack.Navigator>
  );
}

type RoleTabRouteName = keyof WorkerTabParamList | keyof ForemanTabParamList;

function getTabIconName(routeName: RoleTabRouteName): AppIconName {
  switch (routeName) {
    case "WorkerDashboard":
    case "ForemanDashboard":
      return "dashboard";
    case "MyShiftHistory":
    case "ForemanShifts":
      return "date";
    case "WorkerPayroll":
    case "ForemanPayrollRequests":
      return "payroll";
    case "More":
      return "more";
  }
}

function getTabScreenOptions(routeName: RoleTabRouteName): BottomTabNavigationOptions {
  return {
    freezeOnBlur: false,
    headerShown: false,
    popToTopOnBlur: false,
    sceneStyle: {
      backgroundColor: theme.colors.canvas
    },
    tabBarActiveTintColor: theme.colors.brand.primary,
    tabBarAllowFontScaling: true,
    tabBarHideOnKeyboard: true,
    tabBarIcon: ({ focused }) => (
      <AppIcon
        name={getTabIconName(routeName)}
        tone={focused ? "brand" : "muted"}
      />
    ),
    tabBarInactiveTintColor: theme.colors.ink.muted,
    tabBarItemStyle: {
      minHeight: theme.target.min,
      minWidth: 0
    },
    tabBarLabelStyle: theme.typography.caption,
    tabBarStyle: {
      backgroundColor: theme.colors.surface.default,
      borderTopColor: theme.colors.border,
      borderTopWidth: theme.border.default,
      paddingTop: theme.space[1]
    }
  };
}

function WorkerTabNavigator() {
  return (
    <WorkerTabs.Navigator
      backBehavior="history"
      screenOptions={({ route }) => getTabScreenOptions(route.name)}
    >
      <WorkerTabs.Screen
        component={WorkerDashboardScreen}
        name="WorkerDashboard"
        options={{
          tabBarAccessibilityLabel: "Dashboard tab",
          tabBarButtonTestID: "worker-tab-dashboard",
          title: "Dashboard"
        }}
      />
      <WorkerTabs.Screen
        component={MyShiftHistoryScreen}
        name="MyShiftHistory"
        options={{
          tabBarAccessibilityLabel: "Shifts tab",
          tabBarButtonTestID: "worker-tab-shifts",
          title: "Shifts"
        }}
      />
      <WorkerTabs.Screen
        component={WorkerPayrollScreen}
        name="WorkerPayroll"
        options={{
          tabBarAccessibilityLabel: "Payroll tab",
          tabBarButtonTestID: "worker-tab-payroll",
          title: "Payroll"
        }}
      />
      <WorkerTabs.Screen
        component={MoreScreen}
        name="More"
        options={{
          tabBarAccessibilityLabel: "More tab",
          tabBarButtonTestID: "worker-tab-more",
          title: "More"
        }}
      />
    </WorkerTabs.Navigator>
  );
}

function ForemanTabNavigator() {
  return (
    <ForemanTabs.Navigator
      backBehavior="history"
      screenOptions={({ route }) => getTabScreenOptions(route.name)}
    >
      <ForemanTabs.Screen
        component={ForemanDashboardScreen}
        name="ForemanDashboard"
        options={{
          tabBarAccessibilityLabel: "Dashboard tab",
          tabBarButtonTestID: "foreman-tab-dashboard",
          title: "Dashboard"
        }}
      />
      <ForemanTabs.Screen
        component={ForemanShiftsScreen}
        name="ForemanShifts"
        options={{
          tabBarAccessibilityLabel: "Shifts tab",
          tabBarButtonTestID: "foreman-tab-shifts",
          title: "Shifts"
        }}
      />
      <ForemanTabs.Screen
        component={ForemanPayrollRequestsScreen}
        name="ForemanPayrollRequests"
        options={{
          tabBarAccessibilityLabel: "Payroll tab",
          tabBarButtonTestID: "foreman-tab-payroll",
          title: "Payroll"
        }}
      />
      <ForemanTabs.Screen
        component={MoreScreen}
        name="More"
        options={{
          tabBarAccessibilityLabel: "More tab",
          tabBarButtonTestID: "foreman-tab-more",
          title: "More"
        }}
      />
    </ForemanTabs.Navigator>
  );
}

function WorkerNavigator({ navigationKey }: { navigationKey: string }) {
  return (
    <WorkerShiftHistoryProvider>
      <WorkerStack.Navigator screenOptions={{ headerShown: false }}>
        <WorkerStack.Group navigationKey={navigationKey}>
          <WorkerStack.Screen component={WorkerTabNavigator} name="WorkerTabs" />
          <WorkerStack.Screen component={JoinShiftScreen} name="JoinShift" />
          <WorkerStack.Screen
            component={WorkerShiftDetailsScreen}
            name="WorkerShiftDetails"
          />
          <WorkerStack.Screen component={OwnSettingsScreen} name="OwnSettings" />
        </WorkerStack.Group>
      </WorkerStack.Navigator>
    </WorkerShiftHistoryProvider>
  );
}

function ForemanNavigator({ navigationKey }: { navigationKey: string }) {
  return (
    <ForemanManagedShiftsProvider>
      <ForemanStack.Navigator screenOptions={{ headerShown: false }}>
        <ForemanStack.Group navigationKey={navigationKey}>
          <ForemanStack.Screen component={ForemanTabNavigator} name="ForemanTabs" />
          <ForemanStack.Screen
            component={ForemanCompanySettingsScreen}
            name="ForemanCompanySettings"
          />
          <ForemanStack.Screen
            component={ForemanPayRulesScreen}
            name="ForemanPayRules"
          />
          <ForemanStack.Screen component={CreateShiftScreen} name="CreateShift" />
          <ForemanStack.Screen
            component={ForemanShiftDetailsScreen}
            name="ForemanShiftDetails"
          />
          <ForemanStack.Screen component={ShiftSummaryScreen} name="ShiftSummary" />
          <ForemanStack.Screen component={OwnSettingsScreen} name="OwnSettings" />
        </ForemanStack.Group>
      </ForemanStack.Navigator>
    </ForemanManagedShiftsProvider>
  );
}

function JoinCompanyGateScreen({ navigation }: NativeStackScreenProps<WorkerGateStackParamList, "JoinCompany">) {
  return (
    <JoinCompanyScreen
      onOpenSettings={() => navigation.navigate("OwnSettings")}
    />
  );
}

function WorkerGateNavigator() {
  return (
    <WorkerGateStack.Navigator screenOptions={{ headerShown: false }}>
      <WorkerGateStack.Screen component={JoinCompanyGateScreen} name="JoinCompany" />
      <WorkerGateStack.Screen component={OwnSettingsScreen} name="OwnSettings" />
    </WorkerGateStack.Navigator>
  );
}

function CreateCompanyGateScreen({ navigation }: NativeStackScreenProps<ForemanGateStackParamList, "CreateCompany">) {
  return (
    <CreateCompanyScreen
      onOpenSettings={() => navigation.navigate("OwnSettings")}
    />
  );
}

function ForemanGateNavigator() {
  return (
    <ForemanGateStack.Navigator screenOptions={{ headerShown: false }}>
      <ForemanGateStack.Screen component={CreateCompanyGateScreen} name="CreateCompany" />
      <ForemanGateStack.Screen component={OwnSettingsScreen} name="OwnSettings" />
    </ForemanGateStack.Navigator>
  );
}

function RoleNavigator() {
  const { user } = useAuth();

  if (user?.role === "WORKER") {
    if (!user.company) {
      return <WorkerGateNavigator />;
    }

    return <WorkerNavigator navigationKey={`worker-${user.id}`} />;
  }

  if (user?.role === "FOREMAN") {
    if (!user.company) {
      return <ForemanGateNavigator />;
    }

    return <ForemanNavigator navigationKey={`foreman-${user.id}`} />;
  }

  return <UnsupportedRoleScreen />;
}

type AppNavigatorProps = {
  initialState?: InitialState;
  navigationRef?: NavigationContainerRefWithCurrent<ParamListBase>;
};

export function AppNavigator({ initialState, navigationRef }: AppNavigatorProps = {}) {
  const { status } = useAuth();

  return (
    <NavigationContainer initialState={initialState} ref={navigationRef}>
      {status === "restoring" || status === "recovering" ? (
        <RestoreSessionScreen />
      ) : status === "authenticated" ? (
        <RoleNavigator />
      ) : (
        <AuthNavigator />
      )}
    </NavigationContainer>
  );
}
