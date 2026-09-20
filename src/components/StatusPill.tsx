import React from "react";
import { Text, StyleSheet, View } from "react-native";
import { colors } from "../theme";

type Status = "pending" | "confirmed" | "cancelled" | "completed";

const STYLE: Record<Status, { label: string; fg: string; bg: string }> = {
  pending: { label: "Pending", fg: "#9A5B00", bg: "#FFF1D6" },
  confirmed: { label: "Confirmed", fg: "#1B7A46", bg: colors.successBg },
  cancelled: { label: "Cancelled", fg: colors.error, bg: colors.errorBg },
  completed: { label: "Completed", fg: colors.secondaryText, bg: colors.surfaceAlt },
};

/** One status treatment for appointments, transport and service requests alike. */
export default function StatusPill({ status }: { status: string }) {
  const s = STYLE[(status as Status) in STYLE ? (status as Status) : "pending"];
  return (
    <View style={[styles.pill, { backgroundColor: s.bg }]} accessibilityLabel={`Status: ${s.label}`}>
      <Text style={[styles.text, { color: s.fg }]}>{s.label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  pill: { alignSelf: "flex-start", paddingHorizontal: 9, paddingVertical: 3, borderRadius: 10 },
  text: { fontSize: 11.5, fontWeight: "700" },
});
