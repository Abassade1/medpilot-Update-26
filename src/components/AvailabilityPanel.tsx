import React from "react";
import { ActivityIndicator, StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { colors, radii } from "../theme";
import type { AvailabilityDto } from "../api/types";

interface Props {
  place: string;
  loading: boolean;
  error: boolean;
  data: AvailabilityDto | undefined;
  onRetry?: () => void;
}

/**
 * States the availability at a place in words a member can act on. It only ever calls a service
 * "available" when a provider really covers the chosen place, and says when more location detail
 * would change the answer.
 */
export default function AvailabilityPanel({ place, loading, error, data, onRetry }: Props) {
  if (loading) {
    return (
      <View style={[styles.box, styles.neutral]}>
        <ActivityIndicator size="small" color={colors.primary} />
        <Text style={styles.text}>Checking services near {place}…</Text>
      </View>
    );
  }
  if (error) {
    return (
      <View style={[styles.box, styles.bad]}>
        <Ionicons name="cloud-offline-outline" size={18} color={colors.error} />
        <Text style={[styles.text, { color: colors.error }]} onPress={onRetry}>
          Couldn't check availability. Tap to try again.
        </Text>
      </View>
    );
  }
  if (!data) return null;
  const partial = data.services.some((s) => s.available && s.coverage === "partial");
  return (
    <View style={styles.wrap} accessibilityLiveRegion="polite">
      <Text style={styles.heading}>Available at {place}</Text>
      {data.services.map((s) => (
        <View key={s.category} style={styles.row}>
          <Ionicons
            name={s.available ? (s.coverage === "partial" ? "alert-circle" : "checkmark-circle") : "close-circle"}
            size={18}
            color={s.available ? (s.coverage === "partial" ? "#C77700" : "#1B7A46") : colors.tertiaryText}
          />
          <Text style={[styles.label, !s.available && { color: colors.secondaryText }]}>{s.label}</Text>
          <Text style={[styles.state, { color: s.available ? (s.coverage === "partial" ? "#C77700" : "#1B7A46") : colors.secondaryText }]}>
            {!s.available ? "Not available" : s.coverage === "partial" ? "Part of this area" : "Available"}
          </Text>
        </View>
      ))}
      {!data.anyAvailable ? (
        <Text style={styles.foot}>No transport service covers this place yet. Try a nearby city or a different province/state.</Text>
      ) : partial ? (
        <Text style={styles.foot}>Some services only cover part of this area. Choose a city to confirm availability.</Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { backgroundColor: colors.surfaceAlt, borderRadius: radii.md, padding: 14, marginVertical: 8 },
  heading: { fontSize: 13, fontWeight: "700", color: colors.text, marginBottom: 6 },
  row: { flexDirection: "row", alignItems: "center", paddingVertical: 5 },
  label: { flex: 1, fontSize: 13.5, fontWeight: "500", color: colors.text, marginLeft: 8 },
  state: { fontSize: 12, fontWeight: "600" },
  foot: { fontSize: 12.5, color: colors.secondaryText, lineHeight: 18, marginTop: 6 },
  box: { flexDirection: "row", alignItems: "center", borderRadius: radii.sm, padding: 12, marginVertical: 8 },
  neutral: { backgroundColor: colors.surfaceAlt },
  bad: { backgroundColor: colors.errorBg },
  text: { flex: 1, fontSize: 13, color: colors.text, marginLeft: 10 },
});
