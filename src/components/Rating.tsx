import React from "react";
import { View, Text, StyleSheet } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { colors } from "../theme";

interface Props {
  value: number;
  size?: number;
}

export default function Rating({ value, size = 13 }: Props) {
  return (
    <View style={styles.row}>
      <Ionicons name="star" size={size} color={colors.warning} />
      <Text style={[styles.text, { fontSize: size - 1 }]}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: "row", alignItems: "center" },
  text: { fontWeight: "600", color: colors.text, marginLeft: 3 },
});
