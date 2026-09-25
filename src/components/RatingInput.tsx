import React from "react";
import { View, Text, TouchableOpacity, StyleSheet } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { colors } from "../theme";

interface Props {
  value: number;
  onChange: (value: number) => void;
  size?: number;
}

const LABELS = ["Tap a star to rate", "Poor", "Fair", "Good", "Very good", "Excellent"];

/** Tap-to-select 1-5 star rating, styled to match the read-only Rating component. */
export default function RatingInput({ value, onChange, size = 36 }: Props) {
  return (
    <View>
      <View style={styles.row}>
        {[1, 2, 3, 4, 5].map((n) => (
          <TouchableOpacity
            key={n}
            onPress={() => onChange(n)}
            hitSlop={{ top: 8, bottom: 8, left: 6, right: 6 }}
            accessibilityRole="button"
            accessibilityLabel={`Rate ${n} out of 5 stars`}
            accessibilityState={{ selected: value === n }}
          >
            <Ionicons name={n <= value ? "star" : "star-outline"} size={size} color={colors.warning} style={styles.star} />
          </TouchableOpacity>
        ))}
      </View>
      <Text style={styles.label}>{LABELS[value] ?? LABELS[0]}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: "row", justifyContent: "center" },
  star: { marginHorizontal: 4 },
  label: { textAlign: "center", fontSize: 13.5, color: colors.secondaryText, marginTop: 10, fontWeight: "600" },
});
