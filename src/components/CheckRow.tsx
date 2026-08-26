import React from "react";
import { Text, StyleSheet, TouchableOpacity, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { colors, radii } from "../theme";

interface Props {
  label: string;
  checked: boolean;
  onPress: () => void;
  /** "filled" turns the entire row blue when selected (Figma medical-history style) */
  selectedStyle?: "filled" | "outline";
}

export default function CheckRow({ label, checked, onPress, selectedStyle = "outline" }: Props) {
  const filled = checked && selectedStyle === "filled";
  return (
    <TouchableOpacity
      activeOpacity={0.75}
      onPress={onPress}
      accessibilityRole="checkbox"
      accessibilityLabel={label}
      accessibilityState={{ checked }}
      style={[styles.row, filled && styles.rowFilled, checked && !filled && styles.rowChecked]}
    >
      <View style={[styles.box, checked ? styles.boxChecked : null, filled && styles.boxOnFilled]}>
        {checked && <Ionicons name="checkmark" size={13} color={filled ? colors.primary : "#fff"} />}
      </View>
      <Text style={[styles.label, filled && styles.labelFilled]}>{label}</Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
    alignItems: "center",
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radii.pill,
    paddingHorizontal: 14,
    height: 46,
    marginBottom: 12,
    backgroundColor: colors.background,
  },
  rowChecked: { borderColor: colors.primary },
  rowFilled: { backgroundColor: colors.primary, borderColor: colors.primary },
  box: {
    width: 18,
    height: 18,
    borderRadius: 4,
    borderWidth: 1.5,
    borderColor: colors.tertiaryText,
    alignItems: "center",
    justifyContent: "center",
    marginRight: 12,
  },
  boxChecked: { backgroundColor: colors.primary, borderColor: colors.primary },
  boxOnFilled: { backgroundColor: "#fff", borderColor: "#fff" },
  label: { fontSize: 14, color: colors.text },
  labelFilled: { color: "#fff", fontWeight: "600" },
});
