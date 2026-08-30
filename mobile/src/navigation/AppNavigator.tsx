import { NavigationContainer } from "@react-navigation/native";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { useAuth } from "../context/AuthContext";
import { ForemanManagedShiftsProvider } from "../context/ForemanManagedShiftsContext";
import { WorkerShiftHistoryProvider } from "../context/WorkerShiftHistoryContext";
import { CreateCompanyScreen } from "../screens/CreateCompanyScreen";
import { CreateShiftScreen } from "../screens/CreateShiftScreen";
import { ForemanDashboardScreen } from "../screens/ForemanDashboardScreen";
import { ForemanPayrollRequestsScreen } from "../screens/ForemanPayrollRequestsScreen";
import { ForemanShiftDetailsScreen } from "../screens/ForemanShiftDetailsScreen";
import { JoinCompanyScreen } from "../screens/JoinCompanyScreen";
import { JoinShiftScreen } from "../screens/JoinShiftScreen";
import { LoginScreen } from "../screens/LoginScreen";
import { MyShiftHistoryScreen } from "../screens/MyShiftHistoryScreen";
import { RegisterScreen } from "../screens/RegisterScreen";
import { RestoreSessionScreen } from "../screens/RestoreSessionScreen";
import { ShiftSummaryScreen } from "../screens/ShiftSummaryScreen";
import { UnsupportedRoleScreen } from "../screens/UnsupportedRoleScreen";
import { WorkerDashboardScreen } from "../screens/WorkerDashboardScreen";
import { WorkerPayrollScreen } from "../screens/WorkerPayrollScreen";
import { WorkerShiftDetailsScreen } from "../screens/WorkerShiftDetailsScreen";
import type {
  AuthStackParamList,
  ForemanStackParamList,
  WorkerStackParamList
} from "../types/navigation";

const AuthStack = createNativeStackNavigator<AuthStackParamList>();
const WorkerStack = createNativeStackNavigator<WorkerStackParamList>();
const ForemanStack = createNativeStackNavigator<ForemanStackParamList>();

function AuthNavigator() {
  return (
    <AuthStack.Navigator screenOptions={{ headerShown: false }}>
      <AuthStack.Screen component={LoginScreen} name="Login" />
      <AuthStack.Screen component={RegisterScreen} name="Register" />
    </AuthStack.Navigator>
  );
}

function WorkerNavigator() {
  return (
    <WorkerShiftHistoryProvider>
      <WorkerStack.Navigator screenOptions={{ headerShown: false }}>
        <WorkerStack.Screen component={WorkerDashboardScreen} name="WorkerDashboard" />
        <WorkerStack.Screen component={JoinShiftScreen} name="JoinShift" />
        <WorkerStack.Screen component={MyShiftHistoryScreen} name="MyShiftHistory" />
        <WorkerStack.Screen component={WorkerPayrollScreen} name="WorkerPayroll" />
        <WorkerStack.Screen component={WorkerShiftDetailsScreen} name="WorkerShiftDetails" />
      </WorkerStack.Navigator>
    </WorkerShiftHistoryProvider>
  );
}

function ForemanNavigator() {
  return (
    <ForemanManagedShiftsProvider>
      <ForemanStack.Navigator screenOptions={{ headerShown: false }}>
        <ForemanStack.Screen component={ForemanDashboardScreen} name="ForemanDashboard" />
        <ForemanStack.Screen component={CreateShiftScreen} name="CreateShift" />
        <ForemanStack.Screen
          component={ForemanPayrollRequestsScreen}
          name="ForemanPayrollRequests"
        />
        <ForemanStack.Screen
          component={ForemanShiftDetailsScreen}
          name="ForemanShiftDetails"
        />
        <ForemanStack.Screen component={ShiftSummaryScreen} name="ShiftSummary" />
      </ForemanStack.Navigator>
    </ForemanManagedShiftsProvider>
  );
}

function RoleNavigator() {
  const { user } = useAuth();

  if (user?.role === "WORKER") {
    if (!user.company) {
      return <JoinCompanyScreen />;
    }

    return <WorkerNavigator />;
  }

  if (user?.role === "FOREMAN") {
    if (!user.company) {
      return <CreateCompanyScreen />;
    }

    return <ForemanNavigator />;
  }

  return <UnsupportedRoleScreen />;
}

export function AppNavigator() {
  const { status } = useAuth();

  return (
    <NavigationContainer>
      {status === "restoring" ? (
        <RestoreSessionScreen />
      ) : status === "authenticated" ? (
        <RoleNavigator />
      ) : (
        <AuthNavigator />
      )}
    </NavigationContainer>
  );
}
