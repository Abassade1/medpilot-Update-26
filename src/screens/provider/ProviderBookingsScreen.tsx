import React, { useState } from "react";
import { FlatList, RefreshControl, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import ScreenContainer from "../../components/ScreenContainer";
import AppHeader from "../../components/AppHeader";
import StatusPill from "../../components/StatusPill";
import ListStateView from "../../components/ListStateView";
import { useProviderBookings } from "../../api/queries";
import { formatDate, formatTime } from "../../utils/dates";
import { colors, radii, spacing } from "../../theme";
import { RootScreenProps } from "../../navigation/types";

const TABS = [["", "All"], ["pending", "Pending"], ["confirmed", "Confirmed"], ["completed", "Completed"], ["cancelled", "Cancelled"]] as const;

export default function ProviderBookingsScreen({ navigation, route }: RootScreenProps<"ProviderBookings">) {
  const [status, setStatus] = useState<string>(route.params?.status ?? "");
  const q = useProviderBookings(status || undefined);
  return (
    <ScreenContainer>
      <AppHeader title="Bookings" />
      <View style={styles.chips}>
        {TABS.map(([v, label]) => (
          <TouchableOpacity key={v} style={[styles.chip, status === v && styles.chipOn]} onPress={() => setStatus(v)} accessibilityRole="button" accessibilityState={{ selected: status === v }}>
            <Text style={[styles.chipText, status === v && styles.chipTextOn]}>{label}</Text>
          </TouchableOpacity>
        ))}
      </View>
      {q.isLoading ? <ListStateView kind="loading" message="Loading bookings…" /> : q.isError ? (
        <ListStateView kind="error" message="We couldn't load bookings." onRetry={() => void q.refetch()} />
      ) : (
        <FlatList
          data={q.data}
          keyExtractor={(b) => b.id}
          contentContainerStyle={{ paddingHorizontal: spacing.lg, paddingBottom: 30, flexGrow: 1 }}
          refreshControl={<RefreshControl refreshing={q.isRefetching} onRefresh={() => void q.refetch()} />}
          ListEmptyComponent={<ListStateView kind="empty" title="No bookings here" message="When members book your services, they appear here." />}
          renderItem={({ item: b }) => (
            <TouchableOpacity style={styles.card} onPress={() => navigation.navigate("ProviderBookingDetail", { bookingId: b.id })} accessibilityRole="button" accessibilityLabel={`${b.customer.name}, ${b.listing?.name ?? "booking"}`}>
              <View style={{ flex: 1 }}>
                <Text style={styles.name}>{b.listing?.name ?? "Booking"}</Text>
                <Text style={styles.meta}>{b.customer.name}</Text>
                <Text style={styles.meta}>{formatDate(b.date)}{b.time ? ` at ${formatTime(b.time)}` : ""}</Text>
              </View>
              <StatusPill status={b.status} />
            </TouchableOpacity>
          )}
        />
      )}
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  chips: { flexDirection: "row", flexWrap: "wrap", paddingHorizontal: spacing.lg, marginBottom: 8 },
  chip: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 16, backgroundColor: colors.surfaceAlt, marginRight: 6, marginBottom: 6 },
  chipOn: { backgroundColor: colors.primary },
  chipText: { fontSize: 12.5, color: colors.secondaryText },
  chipTextOn: { color: "#fff", fontWeight: "600" },
  card: { flexDirection: "row", alignItems: "center", borderWidth: 1, borderColor: colors.border, borderRadius: radii.md, padding: 14, marginBottom: 10 },
  name: { fontSize: 15, fontWeight: "600", color: colors.text },
  meta: { fontSize: 12.5, color: colors.secondaryText, marginTop: 3 },
});
