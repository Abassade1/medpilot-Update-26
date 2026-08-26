import React from "react";
import { View, Text, StyleSheet, TouchableOpacity } from "react-native";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import type { ActivityDto, ActivityTypeDto } from "../api/types";
import { colors, radii } from "../theme";

interface Props {
  activity: ActivityDto;
  onPress?: () => void;
}

type IconName = React.ComponentProps<typeof MaterialCommunityIcons>["name"];

/** Icon + tile colour per activity type, drawn from the service card palette. */
const typeStyle: Record<ActivityTypeDto, { icon: IconName; tint: string; bg: string }> = {
  appointment: { icon: "calendar-check", tint: "#2C5E9E", bg: colors.serviceBlue },
  transport: { icon: "airplane", tint: "#D33A2C", bg: colors.servicePink },
  diagnosis: { icon: "stethoscope", tint: "#3F7D2C", bg: colors.serviceGreen },
  meal: { icon: "food-apple-outline", tint: "#B07C1C", bg: colors.serviceYellow },
  record: { icon: "file-document-outline", tint: "#5B4BB7", bg: colors.servicePurple },
  plan: { icon: "shield-star-outline", tint: colors.primary, bg: colors.primaryLight },
};

type StatusCode = NonNullable<ActivityDto["status"]>;

const statusStyle: Record<StatusCode, { label: string; color: string; bg: string }> = {
  completed: { label: "Completed", color: "#1B7A46", bg: colors.successBg },
  booked: { label: "Booked", color: colors.primary, bg: colors.primaryLight },
  cancelled: { label: "Cancelled", color: colors.error, bg: colors.errorBg },
  pending: { label: "Pending", color: colors.secondaryText, bg: colors.surfaceAlt },
};

export default function ActivityRow({ activity, onPress }: Props) {
  const t = typeStyle[activity.type];
  const s = activity.status ? statusStyle[activity.status] : null;

  return (
    <TouchableOpacity
      style={styles.row}
      activeOpacity={0.7}
      onPress={onPress}
      disabled={!onPress}
      accessibilityRole="button"
      accessibilityLabel={`${activity.title}. ${activity.subtitle}. ${activity.time}${
        s ? `. ${s.label}` : ""
      }`}
    >
      <View style={[styles.tile, { backgroundColor: t.bg }]}>
        <MaterialCommunityIcons name={t.icon} size={20} color={t.tint} />
      </View>

      <View style={styles.body}>
        <Text style={styles.title} numberOfLines={1}>
          {activity.title}
        </Text>
        <Text style={styles.subtitle} numberOfLines={1}>
          {activity.subtitle}
        </Text>
      </View>

      <View style={styles.meta}>
        <Text style={styles.time}>{activity.time}</Text>
        {s && (
          <View style={[styles.pill, { backgroundColor: s.bg }]}>
            <Text style={[styles.pillLabel, { color: s.color }]}>{s.label}</Text>
          </View>
        )}
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: colors.borderLight,
  },
  tile: {
    width: 42,
    height: 42,
    borderRadius: radii.md,
    alignItems: "center",
    justifyContent: "center",
  },
  body: { flex: 1, marginHorizontal: 12 },
  title: { fontSize: 14, fontWeight: "600", color: colors.text },
  subtitle: { fontSize: 12, color: colors.secondaryText, marginTop: 3 },
  meta: { alignItems: "flex-end" },
  time: { fontSize: 11.5, color: colors.secondaryText },
  pill: {
    borderRadius: radii.pill,
    paddingHorizontal: 8,
    paddingVertical: 3,
    marginTop: 6,
  },
  pillLabel: { fontSize: 10.5, fontWeight: "600" },
});
