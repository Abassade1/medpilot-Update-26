import React from "react";
import { Alert, RefreshControl, ScrollView, StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import ScreenContainer from "../../components/ScreenContainer";
import AppHeader from "../../components/AppHeader";
import Button from "../../components/Button";
import LogoBox from "../../components/LogoBox";
import ListStateView from "../../components/ListStateView";
import StatusPill from "../../components/StatusPill";
import { useCancelTransport, useTransportBooking } from "../../api/queries";
import { assetSource } from "../../api/assets";
import { ApiError } from "../../api/errors";
import { formatDate, formatInstant, formatTime } from "../../utils/dates";
import { colors, radii, spacing } from "../../theme";
import { RootScreenProps } from "../../navigation/types";

const NOTE: Record<string, { icon: React.ComponentProps<typeof Ionicons>["name"]; text: string; tone: "info" | "ok" | "bad" }> = {
  pending: { icon: "time-outline", text: "Waiting for the dispatch team to confirm. We'll notify you as soon as they do.", tone: "info" },
  confirmed: { icon: "checkmark-circle-outline", text: "Confirmed by the dispatch team.", tone: "ok" },
  in_transit: { icon: "airplane-outline", text: "Your transport is under way.", tone: "info" },
  completed: { icon: "checkmark-done-outline", text: "This transport has been completed.", tone: "info" },
  cancelled: { icon: "close-circle-outline", text: "This transport was cancelled.", tone: "bad" },
};
const place = (p: { city?: string | null; region: string | null; country: string }) =>
  [p.city, p.region, p.country].filter(Boolean).join(", ");
const site = (type: string, code: string | null) => `${type === "airport" ? "Airport" : "Helipad"}${code ? ` · ${code}` : ""}`;

export default function TransportBookingDetailScreen({ navigation, route }: RootScreenProps<"TransportBookingDetail">) {
  const { transportId } = route.params;
  const query = useTransportBooking(transportId);
  const cancel = useCancelTransport(transportId);
  const t = query.data;

  if (!t) {
    const notFound = (query.error as ApiError | null)?.status === 404;
    return (
      <ScreenContainer>
        <AppHeader title="Transport" />
        {query.isError ? (
          <ListStateView
            kind="error"
            title={notFound ? "Transport not found" : undefined}
            message={notFound ? "It may have been removed." : "We couldn't load this transport booking."}
            onRetry={notFound ? undefined : () => void query.refetch()}
          />
        ) : (
          <ListStateView kind="loading" message="Loading transport…" />
        )}
      </ScreenContainer>
    );
  }

  const note = NOTE[t.status] ?? NOTE.pending!;
  const tone = note.tone === "ok" ? "#1B7A46" : note.tone === "bad" ? colors.error : colors.primary;

  const confirmCancel = () =>
    Alert.alert(
      "Cancel this transport?",
      t.status === "confirmed"
        ? "The dispatch team has already confirmed this transport. Cancelling releases the aircraft or vehicle and can't be undone."
        : "This withdraws your request. You can request transport again at any time.",
      [
        { text: "Keep transport", style: "cancel" },
        {
          text: "Cancel transport",
          style: "destructive",
          onPress: () =>
            cancel.mutate(undefined, {
              onError: (err) =>
                Alert.alert(
                  "Couldn't cancel",
                  (err as ApiError).isOffline
                    ? "You appear to be offline. Check your connection and try again."
                    : (err as ApiError).message || "Something went wrong. Please try again.",
                ),
            }),
        },
      ],
    );

  return (
    <ScreenContainer>
      <AppHeader title="Transport" />
      <ScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={query.isRefetching} onRefresh={() => void query.refetch()} />}
      >
        <View style={styles.card}>
          <View style={styles.row0}>
            <LogoBox text={t.provider.name.slice(0, 2).toUpperCase()} color={colors.surfaceAlt} size={44} image={assetSource(t.provider.logoAsset)} />
            <View style={{ flex: 1, marginLeft: 12 }}>
              <Text style={styles.title}>{t.provider.name}</Text>
              <Text style={styles.sub}>{t.provider.tags}</Text>
            </View>
          </View>
          <View style={styles.statusRow}>
            <StatusPill status={t.status === "in_transit" ? "confirmed" : t.status} />
            <Text style={styles.ref} selectable accessibilityLabel={`Booking ID ${t.reference}`}>{t.reference}</Text>
          </View>
        </View>

        <View style={[styles.note, { backgroundColor: note.tone === "ok" ? colors.successBg : note.tone === "bad" ? colors.errorBg : colors.primaryLight }]} accessibilityLiveRegion="polite">
          <Ionicons name={note.icon} size={18} color={tone} />
          <Text style={[styles.noteText, { color: tone }]}>
            {t.status === "cancelled" && t.cancelledReason ? `${note.text} ${t.cancelledReason}.` : note.text}
          </Text>
        </View>

        <Text style={styles.section}>Route</Text>
        <View style={styles.card}>
          <Row label="Pickup" value={place(t.pickup)} hint={site(t.pickup.siteType, t.pickup.siteCode)} />
          {t.pickup.address ? <Row label="Address" value={t.pickup.address} /> : null}
          <Row label="Pickup date" value={formatDate(t.pickup.date)} hint={t.pickup.time ? formatTime(t.pickup.time) : "Time to be arranged"} />
          <Row label="Drop-off" value={place(t.dropoff)} hint={site(t.dropoff.siteType, t.dropoff.siteCode)} />
          <Row label="Return trip" value={t.returnTrip ? "Yes" : "No"} />
          {t.aircraft ? <Row label="Aircraft" value={t.aircraft} /> : null}
          {t.flightNumber ? <Row label="Flight number" value={t.flightNumber} /> : null}
          {t.departAt ? <Row label="Departure" value={formatInstant(t.departAt)} /> : null}
        </View>

        {t.purposes.length ? (
          <>
            <Text style={styles.section}>Purpose</Text>
            <View style={styles.card}><Text style={styles.list}>{t.purposes.join(" · ")}</Text></View>
          </>
        ) : null}
        {t.needs.length ? (
          <>
            <Text style={styles.section}>Special medical needs</Text>
            <View style={styles.card}><Text style={styles.list}>{t.needs.join(" · ")}</Text></View>
          </>
        ) : null}
        {t.emergencyContact ? (
          <>
            <Text style={styles.section}>Emergency contact</Text>
            <View style={styles.card}>
              <Row label="Name" value={t.emergencyContact.name} hint={t.emergencyContact.relationship.charAt(0).toUpperCase() + t.emergencyContact.relationship.slice(1)} />
              <Row label="Phone" value={t.emergencyContact.phone} />
              <Row label="Accompanying you" value={t.emergencyContact.accompanies ? "Yes" : "No"} />
            </View>
          </>
        ) : null}

        <View style={{ marginTop: 22 }}>
          {t.canCancel ? (
            <Button label="Cancel transport" variant="outlinePill" tone="danger" onPress={confirmCancel} loading={cancel.isPending} disabled={cancel.isPending} />
          ) : null}
          {t.status === "cancelled" ? (
            <Button label="Request transport again" variant="pill" onPress={() => navigation.navigate("MedicalTransport")} />
          ) : null}
          <Button
            label="Back to appointments"
            variant="outlinePill"
            onPress={() => navigation.navigate("MainTabs", { screen: "AppointmentsTab" } as never)}
            style={{ marginTop: 10 }}
          />
        </View>
      </ScrollView>
    </ScreenContainer>
  );
}

function Row({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <View style={styles.row}>
      <Text style={styles.rowLabel}>{label}</Text>
      <View style={{ flex: 1, alignItems: "flex-end" }}>
        <Text style={styles.rowValue}>{value}</Text>
        {hint ? <Text style={styles.hint}>{hint}</Text> : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  content: { paddingHorizontal: spacing.lg, paddingTop: 12, paddingBottom: 32 },
  card: { backgroundColor: "#fff", borderRadius: radii.md, borderWidth: 1, borderColor: colors.borderLight, padding: 14, marginBottom: 12 },
  row0: { flexDirection: "row", alignItems: "center" },
  title: { fontSize: 15.5, fontWeight: "700", color: colors.text },
  sub: { fontSize: 12.5, color: colors.secondaryText, marginTop: 2 },
  statusRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginTop: 12 },
  ref: { fontSize: 12.5, fontWeight: "600", color: colors.text },
  note: { flexDirection: "row", alignItems: "flex-start", borderRadius: radii.sm, padding: 12, marginBottom: 6 },
  noteText: { flex: 1, fontSize: 13, lineHeight: 18, marginLeft: 8, fontWeight: "500" },
  section: { fontSize: 13, fontWeight: "700", color: colors.secondaryText, marginTop: 14, marginBottom: 8, textTransform: "uppercase", letterSpacing: 0.4 },
  row: { flexDirection: "row", alignItems: "flex-start", justifyContent: "space-between", paddingVertical: 8 },
  rowLabel: { fontSize: 13, color: colors.secondaryText, width: 118 },
  rowValue: { fontSize: 13.5, fontWeight: "600", color: colors.text, textAlign: "right" },
  hint: { fontSize: 11.5, color: colors.secondaryText, marginTop: 1, textAlign: "right" },
  list: { fontSize: 13.5, color: colors.text, lineHeight: 20 },
});
