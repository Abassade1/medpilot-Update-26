import React, { useState } from "react";
import { Alert, ScrollView, StyleSheet, Text, View } from "react-native";
import ScreenContainer from "../../components/ScreenContainer";
import AppHeader from "../../components/AppHeader";
import Button from "../../components/Button";
import TextField from "../../components/TextField";
import StatusPill from "../../components/StatusPill";
import ListStateView from "../../components/ListStateView";
import { useBookingAction, useProviderBooking } from "../../api/queries";
import { ApiError } from "../../api/errors";
import { formatDate, formatTime } from "../../utils/dates";
import { colors, radii, spacing } from "../../theme";
import { RootScreenProps } from "../../navigation/types";

export default function ProviderBookingDetailScreen({ route }: RootScreenProps<"ProviderBookingDetail">) {
  const { bookingId } = route.params;
  const q = useProviderBooking(bookingId);
  const act = useBookingAction(bookingId);
  const [reason, setReason] = useState("");
  const [asking, setAsking] = useState<"decline" | "cancel" | null>(null);
  const [error, setError] = useState<string | null>(null);
  const b = q.data;

  if (!b) {
    return (
      <ScreenContainer>
        <AppHeader title="Booking" />
        {q.isError ? <ListStateView kind="error" message="We couldn't load this booking." onRetry={() => void q.refetch()} /> : <ListStateView kind="loading" message="Loading…" />}
      </ScreenContainer>
    );
  }

  const run = (action: "confirm" | "decline" | "complete" | "cancel", why?: string) => {
    if (act.isPending) return;
    setError(null);
    act.mutate({ action, reason: why }, {
      onSuccess: () => { setAsking(null); setReason(""); },
      onError: (e) => { const x = e as ApiError; setError(x.isOffline ? "You appear to be offline." : x.message || "That didn't work."); },
    });
  };

  return (
    <ScreenContainer>
      <AppHeader title="Booking" />
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <View style={styles.head}>
          <Text style={styles.ref}>{b.reference}</Text>
          <StatusPill status={b.status} />
        </View>
        <Row label="Service" value={b.listing?.name ?? "—"} />
        <Row label="Date" value={b.date ? `${formatDate(b.date)}${b.time ? ` at ${formatTime(b.time)}` : ""}` : "—"} />
        <Row label="Price" value={b.priceLabel ?? "—"} />
        <Row label="Customer" value={b.customer.name} />
        <Row label="Phone" value={b.customer.phone ?? "Not provided"} />
        {b.notes ? <Row label="Notes" value={b.notes} /> : null}
        {b.cancelledReason ? <Row label="Reason" value={b.cancelledReason} /> : null}

        {error ? <Text style={styles.err} accessibilityLiveRegion="polite">{error}</Text> : null}
        {asking ? (
          <View style={styles.box}>
            <TextField label={asking === "decline" ? "Reason for declining" : "Reason for cancelling"} optional value={reason} onChangeText={setReason} multiline maxLength={300} />
            <Button label={asking === "decline" ? "Decline booking" : "Cancel booking"} tone="danger" variant="outlinePill" loading={act.isPending} disabled={act.isPending} onPress={() => run(asking, reason.trim() || undefined)} />
            <Button label="Back" variant="outlinePill" onPress={() => setAsking(null)} style={{ marginTop: 8 }} />
          </View>
        ) : (
          <View style={{ marginTop: 18 }}>
            {b.canConfirm ? <Button label="Accept booking" variant="pill" loading={act.isPending} disabled={act.isPending} onPress={() => run("confirm")} /> : null}
            {b.canComplete ? <Button label="Mark as completed" variant="pill" loading={act.isPending} disabled={act.isPending} onPress={() => run("complete")} /> : null}
            {b.canDecline ? <Button label="Decline" variant="outlinePill" tone="danger" onPress={() => setAsking("decline")} style={{ marginTop: 10 }} /> : null}
            {b.canCancel ? <Button label="Cancel booking" variant="outlinePill" tone="danger" onPress={() => Alert.alert("Cancel this booking?", "The member will be notified and the slot is freed.", [{ text: "Keep it", style: "cancel" }, { text: "Continue", style: "destructive", onPress: () => setAsking("cancel") }])} style={{ marginTop: 10 }} /> : null}
          </View>
        )}
        <Text style={styles.hint}>Rescheduling isn't supported yet. Decline or cancel, and the member can book a new time.</Text>
      </ScrollView>
    </ScreenContainer>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return <View style={styles.row}><Text style={styles.label}>{label}</Text><Text style={styles.value}>{value}</Text></View>;
}

const styles = StyleSheet.create({
  content: { paddingHorizontal: spacing.lg, paddingBottom: 40 },
  head: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 10 },
  ref: { fontSize: 17, fontWeight: "700", color: colors.text },
  row: { flexDirection: "row", paddingVertical: 10, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.border },
  label: { width: 90, fontSize: 13, color: colors.secondaryText },
  value: { flex: 1, fontSize: 14, color: colors.text },
  err: { fontSize: 12.5, color: colors.error, marginTop: 12 },
  box: { marginTop: 18, backgroundColor: colors.surfaceAlt, borderRadius: radii.md, padding: 14 },
  hint: { fontSize: 12, color: colors.secondaryText, marginTop: 18, lineHeight: 17 },
});
