import React, { useEffect, useRef, useState } from "react";
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import ScreenContainer from "../../components/ScreenContainer";
import AppHeader from "../../components/AppHeader";
import Button from "../../components/Button";
import DateField from "../../components/DateField";
import RadioRow from "../../components/RadioRow";
import ListStateView from "../../components/ListStateView";
import { useAppointment, useReference, useRescheduleAppointment } from "../../api/queries";
import { ApiError } from "../../api/errors";
import { addDays, formatDate, formatTime, utcTodayIso } from "../../utils/dates";
import { BOOKING_WINDOW_DAYS } from "../../utils/validation";
import { colors, radii, spacing } from "../../theme";
import { RootScreenProps } from "../../navigation/types";

export default function RescheduleAppointmentScreen({ navigation, route }: RootScreenProps<"RescheduleAppointment">) {
  const { appointmentId } = route.params;
  const query = useAppointment(appointmentId);
  const reference = useReference();
  const save = useRescheduleAppointment(appointmentId);

  const [date, setDate] = useState<string | null>(null);
  const [time, setTime] = useState<string | null>(null);
  const [type, setType] = useState<string | null>(null);
  const [dateError, setDateError] = useState<string | null>(null);
  const [timeError, setTimeError] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const seeded = useRef(false);

  const a = query.data;

  // Pre-populate once from the saved appointment. Seeding only once means a
  // background refetch can't overwrite what the member is in the middle of typing.
  useEffect(() => {
    if (a && !seeded.current) {
      seeded.current = true;
      setDate(a.requestedDate);
      setTime(a.requestedTime);
      setType(a.appointmentType);
    }
  }, [a]);

  if (!a) {
    return (
      <ScreenContainer>
        <AppHeader title="Reschedule" />
        {query.isError ? (
          <ListStateView kind="error" message="We couldn't load this appointment." onRetry={() => void query.refetch()} />
        ) : (
          <ListStateView kind="loading" message="Loading appointment…" />
        )}
      </ScreenContainer>
    );
  }

  if (!a.canReschedule) {
    return (
      <ScreenContainer>
        <AppHeader title="Reschedule" />
        <View style={styles.blocked}>
          <Ionicons name="lock-closed-outline" size={40} color={colors.tertiaryText} />
          <Text style={styles.blockedTitle}>This appointment can't be changed</Text>
          <Text style={styles.blockedText}>
            {a.status === "cancelled"
              ? "It was cancelled. You can book a new appointment instead."
              : "It has already been completed."}
          </Text>
          <Button label="Back to appointment" variant="pill" onPress={() => navigation.goBack()} style={{ marginTop: 20 }} />
        </View>
      </ScreenContainer>
    );
  }

  const minDate = addDays(utcTodayIso(), 1);
  const maxDate = addDays(utcTodayIso(), BOOKING_WINDOW_DAYS);
  const changed =
    (date ?? "") !== a.requestedDate || (time ?? null) !== (a.requestedTime ?? null) || type !== a.appointmentType;
  const canSave = !!date && !!type && changed && !save.isPending;

  const submit = () => {
    if (!canSave || !date) return;
    setDateError(null);
    setTimeError(null);
    setFormError(null);
    save.mutate(
      {
        // Only what changed, so the server never sees (or re-validates) untouched fields.
        ...(date !== a.requestedDate ? { requestedDate: date } : {}),
        ...((time ?? null) !== (a.requestedTime ?? null) ? { requestedTime: time } : {}),
        ...(type !== a.appointmentType ? { appointmentType: type! } : {}),
      },
      {
        onSuccess: (updated) => {
          navigation.navigate("AppointmentDetail", {
            appointmentId,
            notice:
              a.status === "confirmed" && updated.status === "pending"
                ? "Sent for re-confirmation"
                : "Appointment updated",
          });
        },
        onError: (err) => {
          const e = err as ApiError;
          if (e.fields?.requestedDate) return setDateError(e.fields.requestedDate);
          if (e.fields?.requestedTime) return setTimeError(e.fields.requestedTime);
          setFormError(
            e.isOffline
              ? "You appear to be offline. Check your connection and try again."
              : e.message || "We couldn't save your changes. Please try again.",
          );
        },
      },
    );
  };

  return (
    <ScreenContainer>
      <AppHeader title="Reschedule" />
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : undefined}>
        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
          <Text style={styles.hospital}>{a.hospital.name}</Text>
          <Text style={styles.current}>
            Currently {formatDate(a.requestedDate)}
            {a.requestedTime ? ` at ${formatTime(a.requestedTime)}` : ""} · {a.appointmentTypeLabel}
          </Text>

          {a.status === "confirmed" ? (
            <View style={styles.warn}>
              <Ionicons name="information-circle-outline" size={18} color="#9A5B00" />
              <Text style={styles.warnText}>
                The hospital has confirmed your current slot. If you change it, your slot is released and the new time
                goes back to the hospital for confirmation.
              </Text>
            </View>
          ) : null}

          <Text style={styles.label}>Type of appointment</Text>
          {(reference.data?.appointmentTypes ?? []).map((t) => (
            <RadioRow key={t.code} label={t.label} selected={type === t.code} onPress={() => setType(t.code)} bordered />
          ))}

          <DateField
            label="New date"
            value={date}
            onChange={(v) => { setDate(v); setDateError(null); }}
            min={minDate}
            max={maxDate}
            minMessage="Choose a date after today"
            maxMessage="Choose a date within the next year"
            requiredMessage="Choose the appointment date"
            error={dateError ?? undefined}
            containerStyle={{ marginTop: 12 }}
          />
          <DateField
            label="Preferred time"
            optional
            mode="time"
            value={time}
            onChange={(v) => { setTime(v); setTimeError(null); }}
            clearable
            error={timeError ?? undefined}
          />

          {formError ? <Text style={styles.error} accessibilityLiveRegion="polite">{formError}</Text> : null}
          {!changed ? <Text style={styles.hint}>Change the date, time or type to save.</Text> : null}

          <Button
            label="Save changes"
            variant="pill"
            onPress={submit}
            disabled={!canSave}
            loading={save.isPending}
            style={{ marginTop: 22 }}
          />
          <Button label="Cancel" variant="outlinePill" onPress={() => navigation.goBack()} style={{ marginTop: 10 }} />
        </ScrollView>
      </KeyboardAvoidingView>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  content: { paddingHorizontal: spacing.lg, paddingTop: 8, paddingBottom: 32 },
  hospital: { fontSize: 18, fontWeight: "700", color: colors.text },
  current: { fontSize: 13, color: colors.secondaryText, marginTop: 4, marginBottom: 14, lineHeight: 18 },
  warn: { flexDirection: "row", backgroundColor: "#FFF1D6", borderRadius: radii.sm, padding: 12, marginBottom: 14 },
  warnText: { flex: 1, fontSize: 12.5, lineHeight: 18, color: "#7A4A00", marginLeft: 8 },
  label: { fontSize: 13, fontWeight: "500", color: colors.secondaryText, marginBottom: 10 },
  error: { fontSize: 12.5, color: colors.error, marginTop: 6, lineHeight: 18 },
  hint: { fontSize: 12, color: colors.secondaryText, marginTop: 6 },
  blocked: { flex: 1, alignItems: "center", justifyContent: "center", paddingHorizontal: 36 },
  blockedTitle: { fontSize: 17, fontWeight: "700", color: colors.text, marginTop: 14 },
  blockedText: { fontSize: 13.5, color: colors.secondaryText, textAlign: "center", marginTop: 8, lineHeight: 20 },
});
