import React, { useEffect } from "react";
import { StyleSheet, View } from "react-native";
import ScreenContainer from "../../components/ScreenContainer";
import LogoMark from "../../components/LogoMark";
import { RootScreenProps } from "../../navigation/types";

export default function SplashScreen({ navigation }: RootScreenProps<"Splash">) {
  useEffect(() => {
    const t = setTimeout(() => navigation.replace("Onboarding"), 1600);
    return () => clearTimeout(t);
  }, [navigation]);

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
