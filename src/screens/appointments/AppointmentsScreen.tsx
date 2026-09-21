import React, { useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Image,
  RefreshControl,
  TextInput,
} from "react-native";
import { useNavigation } from "@react-navigation/native";
import StatusPill from "../../components/StatusPill";
import { formatDate, formatTime } from "../../utils/dates";
import { Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";
import ScreenContainer from "../../components/ScreenContainer";
import AppHeader from "../../components/AppHeader";
import SegmentTabs from "../../components/SegmentTabs";
import LogoBox from "../../components/LogoBox";
import ListStateView from "../../components/ListStateView";
import { useAppointments, useServiceRequests, useTransportBookings } from "../../api/queries";
import { assetSource } from "../../api/assets";
import { colors, radii, shadows, spacing } from "../../theme";

const FILTERS = ["all", "pending", "confirmed", "completed", "cancelled"] as const;

export default function AppointmentsScreen() {
  const navigation = useNavigation<any>();
  const [tab, setTab] = useState(0);
  const [status, setStatus] = useState<(typeof FILTERS)[number]>("all");
  const [showFilter, setShowFilter] = useState(false);
  const [showSearch, setShowSearch] = useState(false);
  const [search, setSearch] = useState("");
  const appointmentsQuery = useAppointments();
  const transportQuery = useTransportBookings();
  const requestsQuery = useServiceRequests();
  const active = tab === 0 ? appointmentsQuery : tab === 1 ? transportQuery : requestsQuery;
  const rows = active.data ?? [];
  const q = search.trim().toLowerCase();
  const visible = (appointmentsQuery.data ?? []).filter(
    (a) =>
      (status === "all" || a.status === status) &&
      (!q ||
        `${a.hospital.name} ${a.appointmentTypeLabel} ${a.reference} ${a.hospital.location}`
          .toLowerCase()
          .includes(q)),
  );

  return (
    <ScreenContainer>
      <AppHeader
        title="Appointments"
        showBack={false}
        right={
          tab !== 0 ? undefined : (
          <TouchableOpacity
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            onPress={() => { setShowSearch((v) => !v); if (showSearch) setSearch(""); }}
            accessibilityRole="button"
            accessibilityLabel={showSearch ? "Close search" : "Search appointments"}
          >
            <Ionicons name={showSearch ? "close" : "search"} size={20} color={colors.primary} />
          </TouchableOpacity>
          )
        }
      />
      <SegmentTabs
        tabs={["Appointments", "Transport", "Requests"]}
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
            {tab === 0 ? "Medical Appointments" : tab === 1 ? "Transportation booking" : "Pet & specialist requests"}
          </Text>
          {tab === 0 ? (
          <TouchableOpacity style={styles.filterBtn} onPress={() => setShowFilter((v) => !v)} accessibilityRole="button" accessibilityLabel="Filter by status">
            <Ionicons name="options-outline" size={15} color={colors.primary} />
            <Text style={styles.filterText}>{status === "all" ? "Filter" : status}</Text>
          </TouchableOpacity>
          ) : null}
        </View>
        {tab === 0 && showSearch ? (
          <TextInput
            value={search}
            onChangeText={setSearch}
            placeholder="Search hospital, type or booking ID"
            autoFocus
            style={{ borderWidth: 1, borderColor: colors.borderLight, borderRadius: radii.sm, paddingHorizontal: 12, paddingVertical: 10, marginBottom: 10, fontSize: 14 }}
          />
        ) : null}
        {tab === 0 && showFilter ? (
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 10 }}>
            {FILTERS.map((f) => (
              <TouchableOpacity
                key={f}
                onPress={() => setStatus(f)}
                accessibilityRole="radio"
                accessibilityState={{ selected: status === f }}
                style={{ paddingHorizontal: 14, paddingVertical: 7, borderRadius: 18, marginRight: 8, borderWidth: 1, borderColor: status === f ? colors.primary : colors.borderLight, backgroundColor: status === f ? colors.primaryLight : "#fff" }}
              >
                <Text style={{ fontSize: 12.5, fontWeight: "600", color: status === f ? colors.primary : colors.secondaryText, textTransform: "capitalize" }}>{f}</Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        ) : null}

        {active.isPending ? (
          <ListStateView kind="loading" message="Loading your bookings…" />
        ) : active.isError ? (
          <ListStateView kind="error" onRetry={() => void active.refetch()} />
        ) : rows.length === 0 ? (
          <ListStateView
            kind="empty"
            title={tab === 0 ? "No appointments yet" : tab === 1 ? "No transport booked" : "No requests yet"}
            message={
              tab === 0
                ? "Book a hospital appointment and it will appear here."
                : tab === 1
                ? "Request medical transport and it will appear here."
                : "Pet and independent-specialist requests will appear here."
            }
            actionLabel={tab === 0 ? "Find a hospital" : tab === 1 ? "Request transport" : "Browse services"}
            onAction={() => navigation.navigate(tab === 0 ? "Hospitals" : tab === 1 ? "MedicalTransport" : "Services")}
          />
        ) : tab === 0 && visible.length === 0 ? (
          <ListStateView
            kind="empty"
            title="No matching appointments"
            message="Try a different search or status filter."
          />
        ) : tab === 0 ? (
          visible.map((a) => (
            <TouchableOpacity
              key={a.id}
              activeOpacity={0.85}
              style={styles.card}
              onPress={() => navigation.navigate("AppointmentDetail", { appointmentId: a.id })}
              accessibilityRole="button"
              accessibilityLabel={`Appointment at ${a.hospital.name}, ${a.status}. View details`}
            >
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
                    <Text style={styles.dateText}>
                      {formatDate(a.requestedDate)}{a.requestedTime ? ` · ${formatTime(a.requestedTime)}` : ""}
                    </Text>
                    <View style={{ marginLeft: "auto" }}><StatusPill status={a.status} /></View>
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
            </TouchableOpacity>
          ))
        ) : tab === 2 ? (
          (requestsQuery.data ?? []).map((r) => (
            <TouchableOpacity
              key={r.id}
              activeOpacity={0.85}
              style={styles.card}
              onPress={() => navigation.navigate("ServiceRequestDetail", { requestId: r.id })}
              accessibilityRole="button"
              accessibilityLabel={`${r.kindLabel} with ${r.target.name}, ${r.status}. View details`}
            >
              <View style={styles.cardTop}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.hospitalName} numberOfLines={1}>{r.target.name}</Text>
                  <Text style={styles.appointmentMeta} numberOfLines={1}>{r.kindLabel}{r.service ? ` | ${r.service.name}` : ""}</Text>
                  <View style={styles.dateRow}>
                    <MaterialCommunityIcons name="calendar-month-outline" size={13} color={colors.primary} />
                    <Text style={styles.dateText}>{r.preferredDate ? formatDate(r.preferredDate) : "Flexible"}</Text>
                    <View style={{ marginLeft: "auto" }}><StatusPill status={r.status} /></View>
                  </View>
                </View>
              </View>
              <View style={styles.divider} />
              <Text style={styles.bookingId}>{r.reference}</Text>
            </TouchableOpacity>
          ))
        ) : (
          (transportQuery.data ?? []).map((t) => (
            <TouchableOpacity
              key={t.id}
              activeOpacity={0.85}
              style={styles.card}
              onPress={() => navigation.navigate("TransportBookingDetail", { transportId: t.id })}
              accessibilityRole="button"
              accessibilityLabel={`Transport from ${t.pickup.region ?? t.pickup.country} to ${t.dropoff.region ?? t.dropoff.country}, ${t.status}. View details`}
            >
              <View style={styles.flightRow}>
                <View style={styles.flightEnd}>
                  <Text style={styles.flightCode} numberOfLines={1}>{t.pickup.city ?? t.pickup.region ?? t.pickup.country}</Text>
                  <Text style={styles.flightCity} numberOfLines={1}>{t.pickup.city || t.pickup.region ? t.pickup.country : t.pickup.siteType === "airport" ? "Airport" : "Helipad"}</Text>
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
                  <Text style={styles.flightCode} numberOfLines={1}>{t.dropoff.city ?? t.dropoff.region ?? t.dropoff.country}</Text>
                  <Text style={styles.flightCity} numberOfLines={1}>{t.dropoff.city || t.dropoff.region ? t.dropoff.country : t.dropoff.siteType === "airport" ? "Airport" : "Helipad"}</Text>
                </View>
              </View>
              <View style={styles.divider} />
              <View style={styles.cardBottom}>
                <View>
                  <Text style={styles.smallLabel}>Departure Date</Text>
                  <Text style={styles.bookingId}>{formatDate(t.pickup.date)}</Text>
                </View>
                <View style={{ alignItems: "flex-end" }}>
                  <Text style={styles.smallLabel}>Flight Number</Text>
                  <Text style={styles.bookingId}>{t.flightNumber ?? "Not assigned yet"}</Text>
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
                <View style={{ marginLeft: "auto" }}><StatusPill status={t.status} /></View>
              </View>
            </TouchableOpacity>
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
