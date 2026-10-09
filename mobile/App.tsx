import Ionicons from "@expo/vector-icons/Ionicons";
import { useFonts } from "expo-font";
import { StatusBar } from "expo-status-bar";
import { useEffect } from "react";
import { AuthProvider } from "./src/context/AuthContext";
import { AppNavigator } from "./src/navigation/AppNavigator";
import { RestoreSessionScreen } from "./src/screens/RestoreSessionScreen";

export default function App() {
  const [fontsLoaded, fontError] = useFonts(Ionicons.font);

  useEffect(() => {
    if (fontError) {
      console.warn("Failed to preload Ionicons font.", fontError);
    }
  }, [fontError]);

  const fontsReady = fontsLoaded || fontError !== null;

  return (
    <AuthProvider>
      {fontsReady ? <AppNavigator /> : <RestoreSessionScreen />}
      <StatusBar style="dark" />
    </AuthProvider>
  );
}
