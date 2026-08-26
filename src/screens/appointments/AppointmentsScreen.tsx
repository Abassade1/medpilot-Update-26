import React, { useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Image,
  RefreshControl,
} from "react-native";
import { Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";
import ScreenContainer from "../../components/ScreenContainer";
import AppHeader from "../../components/AppHeader";
import SegmentTabs from "../../components/SegmentTabs";
import LogoBox from "../../components/LogoBox";
import ListStateView from "../../components/ListStateView";
import { useAppointments, useTransportBookings } from "../../api/queries";
import { assetSource } from "../../api/assets";
import { colors, radii, shadows, spacing } from "../../theme";

export default function AppointmentsScreen() {
  const [tab, setTab] = useState(0);
  const appointmentsQuery = useAppointments();
  const transportQuery = useTransportBookings();
  const active = tab === 0 ? appointmentsQuery : transportQuery;
  const rows = active.data ?? [];

  return (
    <ScreenContainer>
      <AppHeader
        title="Appointments"
        showBack={false}
        right={
          <TouchableOpacity hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
            <Ionicons name="search" size={20} color={colors.primary} />
          </TouchableOpacity>
        }
      />
      <SegmentTabs
        tabs={["Medical Appointments", "Transportation booking"]}
        active={tab}
        onChange={setTab}
      />

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.list}
        refreshControl={
          <RefreshControl refreshing={active.isRefetching} onRefresh={() => void active.refetch()} />
        }
      >
        <View style={styles.sectionRow}>
          <Text style={styles.sectionTitle}>
            {tab === 0 ? "Medical Appointments" : "Transportation booking"}
          </Text>
          <TouchableOpacity style={styles.filterBtn}>
            <Ionicons name="options-outline" size={15} color={colors.primary} />
            <Text style={styles.filterText}>Filter</Text>
          </TouchableOpacity>
        </View>

        {active.isPending ? (
          <ListStateView kind="loading" message="Loading your bookings…" />
        ) : active.isError ? (
          <ListStateView kind="error" onRetry={() => void active.refetch()} />
        ) : rows.length === 0 ? (
          <ListStateView
            kind="empty"
            title={tab === 0 ? "No appointments yet" : "No transport booked"}
            message={
              tab === 0
                ? "Book a hospital appointment and it will appear here."
                : "Request medical transport and it will appear here."
            }
          />
        ) : tab === 0 ? (
          (appointmentsQuery.data ?? []).map((a) => (
            <View key={a.id} style={styles.card}>
              <View style={styles.cardTop}>
                <LogoBox
                  text={a.hospital.name.slice(0, 2).toUpperCase()}
                  color={colors.surfaceAlt}
                  size={38}
                  image={assetSource(a.hospital.logoAsset)}
                />
                <View style={{ flex: 1, marginLeft: 10 }}>
                  <Text style={styles.hospitalName} numberOfLines={1}>
                    {a.hospital.name}
                  </Text>
                  <Text style={styles.appointmentMeta} numberOfLines={1}>
                    {a.appointmentTypeLabel} | {a.hospital.location}
                  </Text>
                  <View style={styles.dateRow}>
                    <MaterialCommunityIcons
                      name="calendar-month-outline"
                      size={13}
                      color={colors.primary}
                    />
                    <Text style={styles.dateText}>{a.requestedDate}</Text>
                    <Text style={[styles.statusPill, statusStyle(a.status)]}>{a.status}</Text>
                  </View>
                </View>
              </View>
              <View style={styles.divider} />
              <View style={styles.cardBottom}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.smallLabel}>Contact Person</Text>
                  {a.contactPerson ? (
                    <View style={styles.contactRow}>
                      <Image
                        source={assetSource(a.contactPerson.photoAsset)}
                        style={styles.contactPhoto}
                      />
                      <View style={{ marginLeft: 8 }}>
                        <Text style={styles.contactName}>{a.contactPerson.name}</Text>
                        <Text style={styles.contactRole}>{a.contactPerson.role}</Text>
                      </View>
                    </View>
                  ) : (
                    <Text style={styles.contactRole}>Assigned once confirmed</Text>
                  )}
                </View>
                <View style={{ alignItems: "flex-end" }}>
                  <Text style={styles.smallLabel}>Booking ID</Text>
                  <Text style={styles.bookingId}>{a.reference}</Text>
                </View>
              </View>
            </View>
          ))
        ) : (
          (transportQuery.data ?? []).map((t) => (
            <View key={t.id} style={styles.card}>
              <View style={styles.flightRow}>
                <View style={styles.flightEnd}>
                  <Text style={styles.flightCode}>{t.pickup.siteCode ?? "—"}</Text>
                  <Text style={styles.flightCity}>{t.pickup.region ?? t.pickup.country}</Text>
                  <Text style={styles.flightTime}>{t.pickup.time ?? "—"}</Text>
                </View>
                <View style={styles.flightMiddle}>
                  <Text style={styles.flightDuration}>{t.returnTrip ? "Return" : "One way"}</Text>
                  <View style={styles.flightPathRow}>
                    <View style={styles.flightDot} />
                    <View style={styles.flightLine} />
                    <Ionicons name="airplane" size={15} color={colors.primary} />
                    <View style={styles.flightLine} />
                    <View style={styles.flightDot} />
                  </View>
                </View>
                <View style={[styles.flightEnd, { alignItems: "flex-end" }]}>
                  <Text style={styles.flightCode}>{t.dropoff.siteCode ?? "—"}</Text>
                  <Text style={styles.flightCity}>{t.dropoff.region ?? t.dropoff.country}</Text>
                  <Text style={styles.flightTime}>{t.status}</Text>
                </View>
              </View>
              <View style={styles.divider} />
              <View style={styles.cardBottom}>
                <View>
                  <Text style={styles.smallLabel}>Departure Date</Text>
                  <Text style={styles.bookingId}>{t.pickup.date}</Text>
                </View>
                <View style={{ alignItems: "flex-end" }}>
                  <Text style={styles.smallLabel}>Flight Number</Text>
                  <Text style={styles.bookingId}>{t.flightNumber ?? "Pending"}</Text>
                </View>
              </View>
              <View style={styles.divider} />
              <View style={styles.providerRow}>
                <LogoBox
                  text={t.provider.name.slice(0, 2).toUpperCase()}
                  color={colors.surfaceAlt}
                  size={32}
                  image={assetSource(t.provider.logoAsset)}
                />
                <View style={{ marginLeft: 10 }}>
                  <Text style={styles.contactName}>{t.provider.name}</Text>
                  <Text style={styles.providerTags}>{t.provider.tags}</Text>
                </View>
              </View>
            </View>
          ))
        )}
      </ScrollView>
    </ScreenContainer>
  );
}

/** Status colour follows the same semantics as the rest of the app. */
function statusStyle(status: string) {
  if (status === "confirmed" || status === "completed") return { color: colors.success };
  if (status === "cancelled") return { color: colors.error };
  return { color: colors.warning };
}

const styles = StyleSheet.create({
  list: { paddingHorizontal: spacing.lg, paddingTop: 16, paddingBottom: 24 },
  sectionRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 14,
  },
  sectionTitle: { fontSize: 17, fontWeight: "700", color: colors.text },
  filterBtn: { flexDirection: "row", alignItems: "center" },
  filterText: { fontSize: 13, fontWeight: "600", color: colors.primary, marginLeft: 4 },
  card: {
    backgroundColor: "#fff",
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: colors.borderLight,
    padding: 12,
    marginBottom: 14,
    ...shadows.card,
  },
  cardTop: { flexDirection: "row" },
  hospitalName: { fontSize: 13.5, fontWeight: "700", color: colors.text },
  appointmentMeta: { fontSize: 11.5, color: colors.secondaryText, marginTop: 3 },
  dateRow: { flexDirection: "row", alignItems: "center", marginTop: 5 },
  dateText: { fontSize: 11.5, fontWeight: "600", color: colors.primary, marginLeft: 4 },
  divider: { height: 1, backgroundColor: colors.borderLight, marginVertical: 10 },
  cardBottom: { flexDirection: "row", justifyContent: "space-between" },
  smallLabel: { fontSize: 10.5, color: colors.secondaryText },
  contactRow: { flexDirection: "row", alignItems: "center", marginTop: 6 },
  contactPhoto: { width: 26, height: 26, borderRadius: 13 },
  contactName: { fontSize: 12, fontWeight: "600", color: colors.text },
  contactRole: { fontSize: 10.5, color: colors.secondaryText, marginTop: 1 },
  bookingId: { fontSize: 12, fontWeight: "600", color: colors.text, marginTop: 6 },
  flightRow: { flexDirection: "row", alignItems: "center" },
  flightEnd: { width: 76 },
  flightCode: { fontSize: 19, fontWeight: "700", color: colors.text },
  flightCity: { fontSize: 11, color: colors.secondaryText, marginTop: 2 },
  flightTime: { fontSize: 11, color: colors.secondaryText, marginTop: 2 },
  flightMiddle: { flex: 1, alignItems: "center" },
  flightDuration: { fontSize: 10.5, color: colors.secondaryText, marginBottom: 4 },
  flightPathRow: { flexDirection: "row", alignItems: "center" },
  flightDot: { width: 5, height: 5, borderRadius: 3, backgroundColor: colors.primary },
  flightLine: { width: 28, height: 1, backgroundColor: colors.border, marginHorizontal: 4 },
  providerRow: { flexDirection: "row", alignItems: "center" },
  providerTags: { fontSize: 10.5, color: colors.primary, marginTop: 2 },
  statusPill: { fontSize: 10.5, fontWeight: "700", marginLeft: 8, textTransform: "capitalize" },
});
