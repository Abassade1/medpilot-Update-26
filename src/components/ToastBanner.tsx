import React from "react";
import { View, Text, StyleSheet } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { colors } from "../theme";

interface Props {
  message: string;
  visible: boolean;
}

/** Green confirmation banner pinned to the very top of the screen (Figma style). */
export default function ToastBanner({ message, visible }: Props) {
  const insets = useSafeAreaInsets();
  if (!visible) return null;
  return (
    <View style={[styles.banner, { paddingTop: insets.top + 10 }]}>
      <Ionicons name="checkmark-circle" size={16} color={colors.success} />
      <Text style={styles.text}>{message}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  banner: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    zIndex: 10,
    backgroundColor: colors.successBg,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingBottom: 14,
  },
  text: { fontSize: 13, fontWeight: "600", color: "#1B7A46", marginLeft: 6 },
});
