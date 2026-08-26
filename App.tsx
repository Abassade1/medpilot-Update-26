import React from "react";
import { SafeAreaProvider } from "react-native-safe-area-context";
import RootNavigator from "./src/navigation";
import { SetupProgressProvider } from "./src/state/SetupProgress";

export default function App() {
  return (
    <SafeAreaProvider>
      <SetupProgressProvider>
        <RootNavigator />
      </SetupProgressProvider>
    </SafeAreaProvider>
  );
}
