import React, { useEffect } from "react";
import { StyleSheet, View } from "react-native";
import ScreenContainer from "../../components/ScreenContainer";
import LogoMark from "../../components/LogoMark";
import { useSession } from "../../state/Session";
import { RootScreenProps } from "../../navigation/types";

/**
 * Cold start. Routes once the session provider has finished restoring a
 * stored session (which may prompt for Face ID), rather than on a timer.
 */
export default function SplashScreen({ navigation }: RootScreenProps<"Splash">) {
  const { status, setup } = useSession();

  useEffect(() => {
    if (status === "restoring") return;
    if (status === "anonymous") {
      navigation.replace("Onboarding");
      return;
    }
    const incomplete = setup && (!setup.passwordSet || !setup.historyComplete);
    navigation.replace(incomplete ? "SetupChecklist" : "MainTabs");
  }, [status, setup, navigation]);

  return (
    <ScreenContainer>
      <View style={styles.center}>
        <LogoMark size={64} showWordmark />
      </View>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: "center", justifyContent: "center" },
});
