import React from "react";
import { View, Text, Image, StyleSheet, StyleProp, ViewStyle } from "react-native";
import { colors } from "../theme";
import { images } from "../data/mock";

interface Props {
  size?: number;
  showWordmark?: boolean;
  style?: StyleProp<ViewStyle>;
}

/** MedPilot logo mark (blue head with sound bars) exported from the Figma file. */
export default function LogoMark({ size = 48, showWordmark = false, style }: Props) {
  return (
    <View style={[{ alignItems: "center" }, style]}>
      <Image
        source={images.logoMark}
        style={{ width: size, height: size * 1.02 }}
        resizeMode="contain"
      />
      {showWordmark && (
        <Text style={[styles.wordmark, { fontSize: size * 0.38, marginTop: size * 0.18 }]}>
          MedPilot
        </Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  wordmark: {
    color: colors.primary,
    fontWeight: "700",
    letterSpacing: 0.3,
  },
});
