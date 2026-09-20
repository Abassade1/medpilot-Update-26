import React, { useState } from "react";
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text } from "react-native";
import ScreenContainer from "../../components/ScreenContainer";
import AppHeader from "../../components/AppHeader";
import Button from "../../components/Button";
import DateField from "../../components/DateField";
import RadioRow from "../../components/RadioRow";
import TextField from "../../components/TextField";
import ListStateView from "../../components/ListStateView";
import { useRequestSpecialist, useSpecialistProfile } from "../../api/queries";
import { ApiError } from "../../api/errors";
import { addDays, utcTodayIso } from "../../utils/dates";
import { newIdempotencyKey } from "../../utils/device";
import { BOOKING_WINDOW_DAYS } from "../../utils/validation";
import { colors, spacing } from "../../theme";
import { RootScreenProps } from "../../navigation/types";

export default function SpecialistRequestScreen({ navigation, route }: RootScreenProps<"SpecialistRequest">) {
  const { specialistId, kind } = route.params;
  const profile = useSpecialistProfile(specialistId);
  const send = useRequestSpecialist(specialistId);
  const [idempotencyKey] = useState(newIdempotencyKey);
  const booking = kind === "booking";

  const [serviceId, setServiceId] = useState<string | null>(route.params.serviceId ?? null);
  const [date, setDate] = useState<string | null>(null);
  const [time, setTime] = useState<string | null>(null);
  const [message, setMessage] = useState("");
  const [touched, setTouched] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(null);

  const s = profile.data;
  if (!s) {
    return (
      <ScreenContainer>
        <AppHeader title={booking ? "Book specialist" : "Connect"} />
        {profile.isError ? <ListStateView kind="error" onRetry={() => void profile.refetch()} /> : <ListStateView kind="loading" />}
      </ScreenContainer>
    );
  }

  const errors = {
    serviceId: booking && !serviceId ? "Choose a service" : undefined,
    preferredDate: booking && !date ? "Choose a date" : undefined,
    message: !booking && !message.trim() ? "Tell the specialist what you need" : undefined,
  };
  const show = (k: keyof typeof errors) => fieldErrors[k] || (touched ? errors[k] : undefined);

  const submit = () => {
    setTouched(true);
    setFormError(null);
    setFieldErrors({});
    if (Object.values(errors).some(Boolean)) return;
    send.mutate(
      {
        idempotencyKey,
        body: {
          kind,
          serviceId: booking ? serviceId : undefined,
          preferredDate: booking ? date : undefined,
          preferredTime: booking ? time ?? undefined : undefined,
          message: message.trim() || undefined,
        },
      },
      {
        onSuccess: (r) =>
          navigation.replace("BookingSuccess", {
            reference: r.reference,
            kind: "specialist",
            headline: booking ? "Booking Requested" : "Request Sent",
            message: `${s.name} will respond to your ${booking ? "booking request" : "message"} shortly.`,
            detail: { route: "ServiceRequestDetail", requestId: r.id },
          }),
        onError: (err) => {
          const e = err as ApiError;
          if (e.fields && Object.keys(e.fields).length) setFieldErrors(e.fields);
          else setFormError(e.isOffline ? e.message : e.message || "We couldn't send your request. Please try again.");
        },
      },
    );
  };

  return (
    <ScreenContainer>
      <AppHeader title={booking ? "Book specialist" : "Connect"} />
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : undefined}>
        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
          <Text style={styles.name}>{s.name}</Text>
          <Text style={styles.role}>{s.role}</Text>
          {booking ? (
            <>
              <Text style={styles.label}>Service</Text>
              {s.services.map((sv) => (
                <RadioRow key={sv.id} label={sv.name} sublabel={`${sv.priceLabel ?? "Price on request"} · ${sv.durationLabel}`}
                  selected={serviceId === sv.id} onPress={() => setServiceId(sv.id)} bordered />
              ))}
              {show("serviceId") ? <Text style={styles.error}>{show("serviceId")}</Text> : null}
              <DateField label="Preferred date" value={date} onChange={setDate}
                min={addDays(utcTodayIso(), 1)} max={addDays(utcTodayIso(), BOOKING_WINDOW_DAYS)}
                minMessage="Choose a date after today" maxMessage="Choose a date within the next year"
                error={show("preferredDate")} containerStyle={{ marginTop: 14 }} />
              <DateField label="Preferred time" optional mode="time" value={time} onChange={setTime} clearable error={fieldErrors.preferredTime} />
            </>
          ) : (
            <Text style={styles.intro}>Send a message to introduce yourself and describe what you need. The specialist will reply with availability.</Text>
          )}
          <TextField label={booking ? "Notes" : "Your message"} optional={booking} value={message} onChangeText={setMessage}
            multiline maxLength={500} placeholder={booking ? "Anything the specialist should know" : "What do you need help with?"}
            error={show("message")} containerStyle={{ marginTop: 14 }} />
          {formError ? <Text style={styles.error} accessibilityLiveRegion="polite">{formError}</Text> : null}
          <Button label={booking ? "Request booking" : "Send message"} variant="pill" onPress={submit}
            loading={send.isPending} disabled={send.isPending} style={{ marginTop: 18 }} />
        </ScrollView>
      </KeyboardAvoidingView>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  content: { paddingHorizontal: spacing.lg, paddingTop: 8, paddingBottom: 32 },
  name: { fontSize: 17, fontWeight: "700", color: colors.text },
  role: { fontSize: 13, color: colors.secondaryText, marginTop: 2, marginBottom: 14 },
  intro: { fontSize: 13, color: colors.secondaryText, lineHeight: 19 },
  label: { fontSize: 13, fontWeight: "500", color: colors.secondaryText, marginBottom: 10 },
  error: { fontSize: 12.5, color: colors.error, marginTop: 4 },
});
