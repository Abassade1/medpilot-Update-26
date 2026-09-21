import React from "react";
import { FlatList, RefreshControl, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import ScreenContainer from "../../components/ScreenContainer";
import AppHeader from "../../components/AppHeader";
import ListStateView from "../../components/ListStateView";
import { useMarkNotificationsRead, useNotifications } from "../../api/queries";
import { formatDate, formatTime, toHHMM, toIso } from "../../utils/dates";
import { colors, radii, spacing } from "../../theme";
import { RootScreenProps } from "../../navigation/types";

type Item = NonNullable<ReturnType<typeof useNotifications>["data"]>["items"][number];

const ICON: Record<string, React.ComponentProps<typeof Ionicons>["name"]> = {
  appointment: "calendar-outline",
  transport: "airplane-outline",
  request: "paw-outline",
  billing: "card-outline",
  system: "information-circle-outline",
};

function when(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const diff = Date.now() - d.getTime();
  if (diff < 60_000) return "Just now";
  if (diff < 3_600_000) return `${Math.floor(diff / 60_000)} min ago`;
  if (toIso(d) === toIso(new Date())) return `Today, ${formatTime(toHHMM(d))}`;
  return formatDate(toIso(d));
}

/** Deep links are `medpilot://<kind>/<id>`; anything unrecognised has no destination. */
function destination(url?: string): { screen: "TransportBookingDetail"; params: { transportId: string } } | { screen: "AppointmentDetail"; params: { appointmentId: string } } | { screen: "ServiceRequestDetail"; params: { requestId: string } } | null {
  const m = url ? /^medpilot:\/\/(appointments|requests|transport)\/([\w-]+)$/.exec(url) : null;
  if (!m) return null;
  if (m[1] === "transport") return { screen: "TransportBookingDetail", params: { transportId: m[2]! } };
  return m[1] === "appointments"
    ? { screen: "AppointmentDetail", params: { appointmentId: m[2]! } }
    : { screen: "ServiceRequestDetail", params: { requestId: m[2]! } };
}

export default function NotificationsScreen({ navigation }: RootScreenProps<"Notifications">) {
  const query = useNotifications();
  const markRead = useMarkNotificationsRead();
  const items = query.data?.items ?? [];
  const unread = query.data?.unreadCount ?? 0;

  const open = (n: Item) => {
    if (!n.read) markRead.mutate([n.id]);
    const dest = destination(n.data?.url);
    if (!dest) return;
    if (dest.screen === "TransportBookingDetail") navigation.navigate("TransportBookingDetail", dest.params);
    else if (dest.screen === "AppointmentDetail") navigation.navigate("AppointmentDetail", dest.params);
    else navigation.navigate("ServiceRequestDetail", dest.params);
  };

  return (
    <ScreenContainer>
      <AppHeader
        title="Notifications"
        right={
          unread > 0 ? (
            <TouchableOpacity
              onPress={() => markRead.mutate("all")}
              disabled={markRead.isPending}
              accessibilityRole="button"
              accessibilityLabel="Mark all notifications as read"
            >
              <Text style={styles.markAll} numberOfLines={1}>Read all</Text>
            </TouchableOpacity>
          ) : undefined
        }
      />
      {query.isPending ? (
        <ListStateView kind="loading" message="Loading notifications…" />
      ) : query.isError ? (
        <ListStateView kind="error" onRetry={() => void query.refetch()} />
      ) : (
        <FlatList
          data={items}
          keyExtractor={(n) => n.id}
          contentContainerStyle={items.length ? styles.list : { flexGrow: 1 }}
          refreshControl={<RefreshControl refreshing={query.isRefetching} onRefresh={() => void query.refetch()} />}
          ListEmptyComponent={
            <ListStateView kind="empty" title="You're all caught up" message="Updates about your bookings will appear here." />
          }
          ItemSeparatorComponent={() => <View style={{ height: 10 }} />}
          renderItem={({ item }) => {
            const dest = destination(item.data?.url);
            const Wrapper: React.ElementType = dest || !item.read ? TouchableOpacity : View;
            return (
              <Wrapper
                onPress={() => open(item)}
                activeOpacity={0.8}
                style={[styles.card, !item.read && styles.unread]}
                accessibilityRole={dest || !item.read ? "button" : undefined}
                accessibilityLabel={`${item.read ? "" : "Unread. "}${item.title}. ${item.body}`}
              >
                <View style={styles.iconWrap}>
                  <Ionicons name={ICON[item.type] ?? "notifications-outline"} size={18} color={colors.primary} />
                </View>
                <View style={{ flex: 1, marginLeft: 12 }}>
                  <Text style={[styles.title, !item.read && { fontWeight: "700" }]}>{item.title}</Text>
                  <Text style={styles.body}>{item.body}</Text>
                  <Text style={styles.time}>{when(item.createdAt)}</Text>
                </View>
                {!item.read ? <View style={styles.dot} /> : null}
                {dest ? <Ionicons name="chevron-forward" size={16} color={colors.tertiaryText} style={{ marginLeft: 6 }} /> : null}
              </Wrapper>
            );
          }}
        />
      )}
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  list: { paddingHorizontal: spacing.lg, paddingTop: 8, paddingBottom: 24 },
  markAll: { fontSize: 12.5, fontWeight: "600", color: colors.primary },
  card: {
    flexDirection: "row", alignItems: "center", backgroundColor: "#fff", borderRadius: radii.md,
    borderWidth: 1, borderColor: colors.borderLight, padding: 14,
  },
  unread: { backgroundColor: colors.primaryLight, borderColor: colors.primary },
  iconWrap: { width: 36, height: 36, borderRadius: 18, backgroundColor: "#fff", alignItems: "center", justifyContent: "center" },
  title: { fontSize: 14, fontWeight: "600", color: colors.text },
  body: { fontSize: 13, color: colors.secondaryText, marginTop: 2, lineHeight: 18 },
  time: { fontSize: 11.5, color: colors.tertiaryText, marginTop: 4 },
  dot: { width: 9, height: 9, borderRadius: 5, backgroundColor: colors.primary, marginLeft: 8 },
});
