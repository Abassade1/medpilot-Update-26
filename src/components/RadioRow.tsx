import React from "react";
import { Text, StyleSheet, TouchableOpacity, View, ViewStyle } from "react-native";
import { colors, radii } from "../theme";

interface Props {
  label: string;
  sublabel?: string;
  selected: boolean;
  onPress: () => void;
  /** bordered row (aircraft picker) vs bare inline radio (Yes/No) */
  bordered?: boolean;
  style?: ViewStyle;
}

export default function RadioRow({ label, sublabel, selected, onPress, bordered = false, style }: Props) {
  const dot = (
    <View style={[styles.circle, selected && { borderColor: colors.primary }]}>
      {selected && <View style={styles.dot} />}
    </View>
  );

  if (!bordered) {
    return (
      <TouchableOpacity
        style={[styles.inline, style]}
        onPress={onPress}
        activeOpacity={0.7}
        accessibilityRole="radio"
        accessibilityLabel={label}
        accessibilityState={{ selected }}
        hitSlop={{ top: 10, bottom: 10, left: 6, right: 10 }}
      >
        {dot}
        <Text style={styles.inlineLabel}>{label}</Text>
      </TouchableOpacity>
    );
  }

  return (
    <TouchableOpacity
      style={[styles.row, selected && { borderColor: colors.primary }, style]}
      onPress={onPress}
      activeOpacity={0.75}
      accessibilityRole="radio"
      accessibilityLabel={sublabel ? `${label}. ${sublabel}` : label}
      accessibilityState={{ selected }}
    >
      {dot}
      <View style={{ flex: 1 }}>
        <Text style={styles.label}>{label}</Text>
        {sublabel ? <Text style={styles.sublabel}>{sublabel}</Text> : null}
      </View>
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
    paddingVertical: 10,
    marginBottom: 12,
    backgroundColor: colors.background,
  },
  inline: { flexDirection: "row", alignItems: "center" },
  inlineLabel: { fontSize: 14, color: colors.text, marginLeft: 8 },
  circle: {
    width: 18,
    height: 18,
    borderRadius: 9,
    borderWidth: 1.5,
    borderColor: colors.tertiaryText,
    alignItems: "center",
    justifyContent: "center",
    marginRight: 10,
  },
  dot: { width: 9, height: 9, borderRadius: 5, backgroundColor: colors.primary },
  label: { fontSize: 14, color: colors.text },
  sublabel: { fontSize: 12, color: colors.secondaryText, marginTop: 2 },
});
