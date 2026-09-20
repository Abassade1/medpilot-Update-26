import React, { useMemo, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  SectionList,
  ScrollView,
  Image,
  TouchableOpacity,
  RefreshControl,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useNavigation } from "@react-navigation/native";
import ScreenContainer from "../../components/ScreenContainer";
import AppHeader from "../../components/AppHeader";
import Chip from "../../components/Chip";
import ActivityRow from "../../components/ActivityRow";
import ListStateView from "../../components/ListStateView";
import { images } from "../../data/assets";
import { useActivities } from "../../api/queries";
import type { ActivityDto, ActivityTypeDto } from "../../api/types";
import { RootNavigation } from "../../navigation/types";
import { colors, spacing } from "../../theme";

type Filter = ActivityTypeDto | "all";

const activityFilters: { id: Filter; label: string }[] = [
  { id: "all", label: "All" },
  { id: "appointment", label: "Appointments" },
  { id: "transport", label: "Transport" },
  { id: "service", label: "Services" },
  { id: "diagnosis", label: "Diagnosis" },
  { id: "meal", label: "Meal Analysis" },
  { id: "record", label: "Records" },
];

/**
 * Activities tab — a chronological record of everything the user has done
 * across the app (bookings, AUX sessions, uploads, plan changes). Each row
 * opens the screen that owns that activity.
 */
export default function ActivitiesScreen() {
  const navigation = useNavigation<RootNavigation>();
  const [filter, setFilter] = useState<Filter>("all");

  const query = useActivities(filter);
  const items = query.data?.items ?? [];

  const sections = useMemo(() => {
    // Preserve the order days first appear in the server's ordering.
    const byDay = new Map<string, ActivityDto[]>();
    items.forEach((a) => {
      const list = byDay.get(a.day);
      if (list) list.push(a);
      else byDay.set(a.day, [a]);
    });
    return [...byDay.entries()].map(([title, data]) => ({ title, data }));
  }, [items]);

  const open = (activity: ActivityDto) => {
    switch (activity.type) {
      // targetId here is the booking's own id, not a catalog id, so both of
      // these open the Appointments tab rather than a catalog detail screen.
      case "appointment":
        if (activity.targetId) navigation.navigate("AppointmentDetail", { appointmentId: activity.targetId });
        else navigation.navigate("MainTabs", { screen: "AppointmentsTab" } as never);
        break;
      case "transport":
        navigation.navigate("MainTabs", { screen: "AppointmentsTab" } as never);
        break;
      case "service":
        if (activity.targetId) navigation.navigate("ServiceRequestDetail", { requestId: activity.targetId });
        break;
      case "diagnosis":
        if (activity.targetId)
          navigation.navigate("DiagnosisResult", { sessionId: activity.targetId });
        break;
      case "meal":
        if (activity.targetId) navigation.navigate("MealReport", { mealId: activity.targetId });
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
        refreshControl={
          <RefreshControl refreshing={query.isRefetching} onRefresh={() => void query.refetch()} />
        }
        ListEmptyComponent={
          query.isPending ? (
            <ListStateView kind="loading" message="Loading your activity…" />
          ) : query.isError ? (
            <ListStateView kind="error" onRetry={() => void query.refetch()} />
          ) : (
          <View style={styles.empty}>
            <Image source={images.tabActivities} style={styles.emptyIcon} resizeMode="contain" />
            <Text style={styles.emptyTitle}>Nothing here yet</Text>
            <Text style={styles.emptySubtitle}>
              Activities of this type will show up here once you start using MedPilot services.
            </Text>
          </View>
          )
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
