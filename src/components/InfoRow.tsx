import React from "react";
import { View, Text, StyleSheet } from "react-native";
import { colors } from "../theme";

interface Props {
  label: string;
  value: string;
  valueColor?: string;
  subValue?: string;
  subLabel?: string;
}

export default function InfoRow({ label, value, valueColor = colors.text, subValue, subLabel }: Props) {
  return (
    <View style={styles.row}>
      <View style={styles.top}>
        <Text style={styles.label}>{label}</Text>
        <Text style={[styles.value, { color: valueColor }]}>{value}</Text>
      </View>
      {(subValue || subLabel) && (
        <View style={styles.top}>
          <Text style={styles.subLabel}>{subLabel ?? ""}</Text>
          <Text style={styles.subValue}>{subValue ?? ""}</Text>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: colors.borderLight,
  },
  top: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  label: { fontSize: 13.5, fontWeight: "600", color: colors.text },
  value: { fontSize: 13.5, fontWeight: "600", textAlign: "right", flexShrink: 1, marginLeft: 12 },
  subLabel: { fontSize: 12, color: colors.secondaryText, marginTop: 3 },
  subValue: { fontSize: 12, color: colors.secondaryText, marginTop: 3, textAlign: "right" },
});
