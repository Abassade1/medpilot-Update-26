import React, { useEffect, useState } from "react";
import { Alert, RefreshControl, ScrollView, StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import ScreenContainer from "../../components/ScreenContainer";
import AppHeader from "../../components/AppHeader";
import Button from "../../components/Button";
import LogoBox from "../../components/LogoBox";
import ListStateView from "../../components/ListStateView";
import StatusPill from "../../components/StatusPill";
import ToastBanner from "../../components/ToastBanner";
import { useAppointment, useCancelAppointment } from "../../api/queries";
import { assetSource } from "../../api/assets";
import { ApiError } from "../../api/errors";
import { formatDate, formatInstant, formatTime } from "../../utils/dates";
import { colors, radii, shadows, spacing } from "../../theme";
import { RootScreenProps } from "../../navigation/types";

const STATUS_NOTE: Record<string, { icon: React.ComponentProps<typeof Ionicons>["name"]; text: string; tone: "info" | "ok" | "bad" }> = {
  pending: { icon: "time-outline", text: "Waiting for the hospital to confirm. We'll notify you as soon as they do.", tone: "info" },
  confirmed: { icon: "checkmark-circle-outline", text: "Confirmed by the hospital.", tone: "ok" },
  cancelled: { icon: "close-circle-outline", text: "This appointment was cancelled.", tone: "bad" },
  completed: { icon: "checkmark-done-outline", text: "This appointment has been completed.", tone: "info" },
};

export default function AppointmentDetailScreen({ navigation, route }: RootScreenProps<"AppointmentDetail">) {
  const { appointmentId, notice } = route.params;
  const query = useAppointment(appointmentId);
  const cancel = useCancelAppointment(appointmentId);
  const [toast, setToast] = useState<string | null>(notice ?? null);

  // Show a confirmation handed back by another screen (e.g. after rescheduling), then clear it
  // so it doesn't reappear when the member navigates away and returns.
  useEffect(() => {
    if (!notice) return;
    setToast(notice);
    navigation.setParams({ notice: undefined });
  }, [notice, navigation]);

  // Separate from the effect above: clearing `notice` re-runs that one, and its cleanup would cancel this timer.
  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 3200);
    return () => clearTimeout(t);
  }, [toast]);

  const a = query.data;

  if (!a) {
    return (
      <ScreenContainer>
        <AppHeader title="Appointment" />
        {query.isError ? (
          <ListStateView
            kind="error"
            title={(query.error as ApiError)?.status === 404 ? "Appointment not found" : undefined}
            message={(query.error as ApiError)?.status === 404 ? "It may have been removed." : "We couldn't load this appointment."}
            onRetry={(query.error as ApiError)?.status === 404 ? undefined : () => void query.refetch()}
          />
        ) : (
          <ListStateView kind="loading" message="Loading appointment…" />
        )}
      </ScreenContainer>
    );
  }

  const note = STATUS_NOTE[a.status] ?? STATUS_NOTE.pending!;
  const confirmedSlot = a.status === "confirmed" ? formatInstant(a.scheduledAt) : "";

  const confirmCancel = () => {
    Alert.alert(
      "Cancel this appointment?",
      a.status === "confirmed"
        ? "The hospital has already confirmed this appointment. Cancelling releases your slot and can't be undone."
        : "This will withdraw your request. You can book again at any time.",
      [
        { text: "Keep appointment", style: "cancel" },
        {
          text: "Cancel appointment",
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
  };

  return (
    <ScreenContainer>
      <AppHeader title="Appointment" />
      <ToastBanner visible={!!toast} message={toast ?? ""} />
      <ScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={query.isRefetching} onRefresh={() => void query.refetch()} />}
      >
        <View style={styles.card}>
          <View style={styles.hospitalRow}>
            <LogoBox
              text={a.hospital.name.slice(0, 2).toUpperCase()}
              color={colors.surfaceAlt}
              size={46}
              image={assetSource(a.hospital.logoAsset)}
            />
            <View style={{ flex: 1, marginLeft: 12 }}>
              <Text style={styles.hospital}>{a.hospital.name}</Text>
              <Text style={styles.sub}>{a.hospital.location}</Text>
            </View>
          </View>
          <View style={styles.statusRow}>
            <StatusPill status={a.status} />
            <Text style={styles.reference} selectable accessibilityLabel={`Booking ID ${a.reference}`}>
              {a.reference}
            </Text>
          </View>
        </View>

        <View style={[styles.note, styles[`note_${note.tone}`]]} accessibilityLiveRegion="polite">
          <Ionicons name={note.icon} size={18} color={noteColor(note.tone)} />
          <Text style={[styles.noteText, { color: noteColor(note.tone) }]}>
            {a.status === "confirmed" && confirmedSlot ? `${note.text} Your slot: ${confirmedSlot}.` : note.text}
          </Text>
        </View>

        <Text style={styles.section}>Appointment</Text>
        <View style={styles.card}>
          <Row label="Type" value={a.appointmentTypeLabel} />
          <Row label="Requested date" value={formatDate(a.requestedDate)} />
          <Row
            label="Preferred time"
            value={a.requestedTime ? formatTime(a.requestedTime) : "Not specified"}
            hint={!a.requestedTime ? "The hospital will propose a time." : undefined}
          />
          {a.contactPerson ? (
            <Row label="Contact person" value={a.contactPerson.name} hint={a.contactPerson.role} />
          ) : (
            <Row label="Contact person" value="Assigned once confirmed" muted />
          )}
        </View>

        <Text style={styles.section}>Medical information</Text>
        <View style={styles.card}>
          <Row label="Under treatment" value={a.underTreatment ? "Yes" : "No"} />
          {a.underTreatment && a.conditionNote ? <Row label="Condition" value={a.conditionNote} /> : null}
        </View>

        {a.emergencyContact ? (
          <>
            <Text style={styles.section}>Emergency contact</Text>
            <View style={styles.card}>
              <Row label="Name" value={a.emergencyContact.name} hint={cap(a.emergencyContact.relationship)} />
              <Row label="Phone" value={a.emergencyContact.phone} />
              <Row label="Accompanying you" value={a.emergencyContact.accompanies ? "Yes" : "No"} />
            </View>
          </>
        ) : null}

        <View style={styles.actions}>
          {a.canReschedule ? (
            <Button
              label="Reschedule"
              variant="pill"
              onPress={() => navigation.navigate("RescheduleAppointment", { appointmentId })}
              disabled={cancel.isPending}
            />
          ) : null}
          {a.canCancel ? (
            <Button
              label="Cancel appointment"
              variant="outlinePill"
              onPress={confirmCancel}
              loading={cancel.isPending}
              disabled={cancel.isPending}
              tone="danger"
              style={styles.cancelBtn}
            />
          ) : null}
          {a.status === "cancelled" ? (
            <Button
              label="Book again"
              variant="pill"
              onPress={() => navigation.navigate("BookAppointment", { hospitalId: a.hospital.id })}
            />
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

const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);
const noteColor = (tone: "info" | "ok" | "bad") =>
  tone === "ok" ? "#1B7A46" : tone === "bad" ? colors.error : colors.primary;

function Row({ label, value, hint, muted }: { label: string; value: string; hint?: string; muted?: boolean }) {
  return (
    <View style={styles.row}>
      <Text style={styles.rowLabel}>{label}</Text>
      <View style={{ flex: 1, alignItems: "flex-end" }}>
        <Text style={[styles.rowValue, muted && { color: colors.secondaryText, fontWeight: "500" }]}>{value}</Text>
        {hint ? <Text style={styles.rowHint}>{hint}</Text> : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  content: { paddingHorizontal: spacing.lg, paddingTop: 12, paddingBottom: 32 },
  card: {
    backgroundColor: "#fff", borderRadius: radii.md, borderWidth: 1, borderColor: colors.borderLight,
    padding: 14, marginBottom: 12, ...shadows.card,
  },
  hospitalRow: { flexDirection: "row", alignItems: "center" },
  hospital: { fontSize: 15.5, fontWeight: "700", color: colors.text },
  sub: { fontSize: 12.5, color: colors.secondaryText, marginTop: 2 },
  statusRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginTop: 12 },
  reference: { fontSize: 12.5, fontWeight: "600", color: colors.text },
  note: { flexDirection: "row", alignItems: "flex-start", borderRadius: radii.sm, padding: 12, marginBottom: 6 },
  note_info: { backgroundColor: colors.primaryLight },
  note_ok: { backgroundColor: colors.successBg },
  note_bad: { backgroundColor: colors.errorBg },
  noteText: { flex: 1, fontSize: 13, lineHeight: 18, marginLeft: 8, fontWeight: "500" },
  section: { fontSize: 13, fontWeight: "700", color: colors.secondaryText, marginTop: 14, marginBottom: 8, textTransform: "uppercase", letterSpacing: 0.4 },
  row: { flexDirection: "row", alignItems: "flex-start", justifyContent: "space-between", paddingVertical: 8 },
  rowLabel: { fontSize: 13, color: colors.secondaryText, width: 128 },
  rowValue: { fontSize: 13.5, fontWeight: "600", color: colors.text, textAlign: "right" },
  rowHint: { fontSize: 11.5, color: colors.secondaryText, marginTop: 1, textAlign: "right" },
  actions: { marginTop: 22 },
  cancelBtn: { marginTop: 10 },
});
