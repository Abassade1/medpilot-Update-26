import React from "react";
import { View, Text, StyleSheet } from "react-native";
import { colors } from "../theme";

/** Country prefix shown inside phone inputs (design uses a CA flag). */
export default function PhonePrefix({ flag = "🇨🇦" }: { flag?: string }) {
  return (
    <View style={styles.wrap} importantForAccessibility="no-hide-descendants">
      <Text style={styles.flag}>{flag}</Text>
      <View style={styles.divider} />
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { flexDirection: "row", alignItems: "center", marginRight: 10 },
  flag: { fontSize: 16 },
  divider: { width: 1, height: 20, backgroundColor: colors.border, marginLeft: 10 },
});
