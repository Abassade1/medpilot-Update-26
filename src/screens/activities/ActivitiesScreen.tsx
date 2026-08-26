import React, { useMemo, useState } from "react";
import { View, Text, StyleSheet, SectionList, ScrollView, Image, TouchableOpacity } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useNavigation } from "@react-navigation/native";
import ScreenContainer from "../../components/ScreenContainer";
import AppHeader from "../../components/AppHeader";
import Chip from "../../components/Chip";
import ActivityRow from "../../components/ActivityRow";
import {
  ActivityItem,
  ActivityType,
  activities,
  activityFilters,
  images,
} from "../../data/mock";
import { colors, spacing } from "../../theme";

type Filter = ActivityType | "all";

/**
 * Activities tab — a chronological record of everything the user has done
 * across the app (bookings, AUX sessions, uploads, plan changes). Each row
 * opens the screen that owns that activity.
 */
export default function ActivitiesScreen() {
  const navigation = useNavigation();
  const [filter, setFilter] = useState<Filter>("all");

  const sections = useMemo(() => {
    const visible =
      filter === "all" ? activities : activities.filter((a) => a.type === filter);

    // Preserve the order days first appear in the source data.
    const byDay = new Map<string, ActivityItem[]>();
    visible.forEach((a) => {
      const list = byDay.get(a.day);
      if (list) list.push(a);
      else byDay.set(a.day, [a]);
    });
    return [...byDay.entries()].map(([title, data]) => ({ title, data }));
  }, [filter]);

  const open = (activity: ActivityItem) => {
    switch (activity.type) {
      case "appointment":
        if (activity.targetId)
          navigation.navigate("HospitalDetail", { hospitalId: activity.targetId });
        break;
      case "transport":
        if (activity.targetId)
          navigation.navigate("TransportDetail", { providerId: activity.targetId });
        break;
      case "diagnosis":
        navigation.navigate("DiagnosisResult");
        break;
      case "meal":
        navigation.navigate("MealReport");
        break;
      case "record":
        navigation.navigate("UploadRecords");
        break;
      case "plan":
        navigation.navigate("Upgrade");
        break;
    }
  };

  return (
    <ScreenContainer>
      <AppHeader
        title="Activities"
        showBack={false}
        right={
          <TouchableOpacity hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
            <Ionicons name="options-outline" size={20} color={colors.text} />
          </TouchableOpacity>
        }
      />

      <View style={styles.filters}>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.filterRow}
        >
          {activityFilters.map((f) => (
            <Chip
              key={f.id}
              label={f.label}
              selected={filter === f.id}
              onPress={() => setFilter(f.id)}
              style={styles.filterChip}
            />
          ))}
        </ScrollView>
      </View>

      <SectionList
        sections={sections}
        keyExtractor={(item) => item.id}
        showsVerticalScrollIndicator={false}
        stickySectionHeadersEnabled={false}
        contentContainerStyle={styles.list}
        renderSectionHeader={({ section }) => (
          <Text style={styles.dayHeader}>{section.title}</Text>
        )}
        renderItem={({ item }) => <ActivityRow activity={item} onPress={() => open(item)} />}
        ListEmptyComponent={
          <View style={styles.empty}>
            <Image source={images.tabActivities} style={styles.emptyIcon} resizeMode="contain" />
            <Text style={styles.emptyTitle}>Nothing here yet</Text>
            <Text style={styles.emptySubtitle}>
              Activities of this type will show up here once you start using MedPilot services.
            </Text>
          </View>
        }
      />
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  filters: { borderBottomWidth: 1, borderBottomColor: colors.borderLight, paddingBottom: 12 },
  filterRow: { paddingHorizontal: spacing.lg },
  filterChip: { marginRight: 8 },
  list: { paddingHorizontal: spacing.lg, paddingBottom: 28, flexGrow: 1 },
  dayHeader: {
    fontSize: 13,
    fontWeight: "600",
    color: colors.secondaryText,
    marginTop: 20,
    marginBottom: 2,
  },
  empty: { flex: 1, alignItems: "center", justifyContent: "center", paddingHorizontal: 40 },
  emptyIcon: { width: 46, height: 46, tintColor: colors.disabled },
  emptyTitle: { fontSize: 16, fontWeight: "700", color: colors.text, marginTop: 16 },
  emptySubtitle: {
    fontSize: 13,
    color: colors.secondaryText,
    textAlign: "center",
    lineHeight: 19,
    marginTop: 8,
  },
});
