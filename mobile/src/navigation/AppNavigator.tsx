import { NavigationContainer } from "@react-navigation/native";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { useAuth } from "../context/AuthContext";
import { ForemanDashboardScreen } from "../screens/ForemanDashboardScreen";
import { LoginScreen } from "../screens/LoginScreen";
import { RegisterScreen } from "../screens/RegisterScreen";
import { RestoreSessionScreen } from "../screens/RestoreSessionScreen";
import { UnsupportedRoleScreen } from "../screens/UnsupportedRoleScreen";
import { WorkerDashboardScreen } from "../screens/WorkerDashboardScreen";
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
    <WorkerStack.Navigator screenOptions={{ headerShown: false }}>
      <WorkerStack.Screen component={WorkerDashboardScreen} name="WorkerDashboard" />
    </WorkerStack.Navigator>
  );
}

function ForemanNavigator() {
  return (
    <ForemanStack.Navigator screenOptions={{ headerShown: false }}>
      <ForemanStack.Screen component={ForemanDashboardScreen} name="ForemanDashboard" />
    </ForemanStack.Navigator>
  );
}

function RoleNavigator() {
  const { user } = useAuth();

  if (user?.role === "WORKER") {
    return <WorkerNavigator />;
  }

  if (user?.role === "FOREMAN") {
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
