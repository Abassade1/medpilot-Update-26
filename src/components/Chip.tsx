import React from "react";
import { Text, StyleSheet, TouchableOpacity, ViewStyle } from "react-native";
import { colors, radii, shadows } from "../theme";

interface Props {
  label: string;
  icon?: React.ReactNode;
  onPress?: () => void;
  style?: ViewStyle;
  elevated?: boolean;
  /** Filled state for chips used as filters. */
  selected?: boolean;
}

export default function Chip({ label, icon, onPress, style, elevated = false, selected = false }: Props) {
  return (
    <TouchableOpacity
      activeOpacity={onPress ? 0.7 : 1}
      onPress={onPress}
      accessibilityRole={onPress ? "button" : "text"}
      accessibilityLabel={label}
      accessibilityState={onPress ? { selected } : undefined}
      style={[
        styles.chip,
        elevated && { borderWidth: 0, ...(shadows.card as object) },
        selected && styles.chipSelected,
        style,
      ]}
    >
      {icon}
      <Text style={[styles.label, selected && styles.labelSelected, icon ? { marginLeft: 6 } : null]}>
        {label}
      </Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  chip: {
    flexDirection: "row",
    alignItems: "center",
    borderRadius: radii.pill,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: "#fff",
    paddingHorizontal: 14,
    height: 38,
  },
  chipSelected: { backgroundColor: colors.primary, borderColor: colors.primary },
  label: { fontSize: 13, fontWeight: "500", color: colors.text },
  labelSelected: { color: "#fff", fontWeight: "600" },
});
