import React from "react";
import { View, Text, StyleSheet } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { colors } from "../theme";

interface Props {
  /** The review average, or null when nobody has reviewed this yet. */
  value: number | null;
  size?: number;
}

export default function Rating({ value, size = 13 }: Props) {
  if (value == null) {
    return (
      <View style={styles.row} accessibilityLabel="No reviews yet">
        <Ionicons name="star-outline" size={size} color={colors.tertiaryText} />
        <Text style={[styles.none, { fontSize: size - 1 }]}>No reviews yet</Text>
      </View>
    );
  }
  return (
    <View style={styles.row} accessibilityLabel={`Rated ${value.toFixed(1)} out of 5`}>
      <Ionicons name="star" size={size} color={colors.warning} />
      <Text style={[styles.text, { fontSize: size - 1 }]}>{value.toFixed(1)}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: "row", alignItems: "center" },
  text: { fontWeight: "600", color: colors.text, marginLeft: 3 },
  none: { fontWeight: "500", color: colors.secondaryText, marginLeft: 3 },
});
