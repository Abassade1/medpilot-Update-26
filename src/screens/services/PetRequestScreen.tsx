import React, { useState } from "react";
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text, View } from "react-native";
import ScreenContainer from "../../components/ScreenContainer";
import AppHeader from "../../components/AppHeader";
import Button from "../../components/Button";
import DateField from "../../components/DateField";
import RadioRow from "../../components/RadioRow";
import TextField from "../../components/TextField";
import ListStateView from "../../components/ListStateView";
import { usePetClinic, useRequestPet } from "../../api/queries";
import { ApiError } from "../../api/errors";
import { addDays, formatDate, utcTodayIso } from "../../utils/dates";
import { newIdempotencyKey } from "../../utils/device";
import { BOOKING_WINDOW_DAYS } from "../../utils/validation";
import { colors, spacing } from "../../theme";
import { RootScreenProps } from "../../navigation/types";
import type { PetType } from "../../api/types";

const PET_TYPES: { code: PetType; label: string }[] = [
  { code: "dog", label: "Dog" }, { code: "cat", label: "Cat" }, { code: "horse", label: "Horse" },
  { code: "bird", label: "Bird" }, { code: "small_animal", label: "Small animal" }, { code: "other", label: "Other" },
];
const MAX_SITTING_DAYS = 30;

export default function PetRequestScreen({ navigation, route }: RootScreenProps<"PetRequest">) {
  const { clinicId, kind } = route.params;
  const clinic = usePetClinic(clinicId);
  const send = useRequestPet(clinicId);
  const [idempotencyKey] = useState(newIdempotencyKey);
  const sitting = kind === "sitting";

  const [serviceId, setServiceId] = useState<string | null>(route.params.serviceId ?? null);
  const [petName, setPetName] = useState("");
  const [petType, setPetType] = useState<PetType | null>(null);
  const [date, setDate] = useState<string | null>(null);
  const [endDate, setEndDate] = useState<string | null>(null);
  const [time, setTime] = useState<string | null>(null);
  const [message, setMessage] = useState("");
  const [touched, setTouched] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(null);

  if (!clinic.data) {
    return (
      <ScreenContainer>
        <AppHeader title={sitting ? "Pet sitting" : "Book appointment"} />
        {clinic.isError ? <ListStateView kind="error" onRetry={() => void clinic.refetch()} /> : <ListStateView kind="loading" />}
      </ScreenContainer>
    );
  }

  const services = clinic.data.services.filter((s) => (s.kind ?? "appointment") === kind);
  const minDate = addDays(utcTodayIso(), 1);
  const maxDate = addDays(utcTodayIso(), BOOKING_WINDOW_DAYS);
  // A sitting can't end before it starts or run longer than the provider allows.
  const endMin = date ?? minDate;
  const endMax = date ? addDays(date, MAX_SITTING_DAYS) : maxDate;

  const errors = {
    serviceId: serviceId ? undefined : "Choose a service",
    petName: petName.trim() ? undefined : "Enter your pet's name",
    petType: petType ? undefined : "Choose the type of pet",
    preferredDate: date ? undefined : "Choose a date",
  };
  const invalid = Object.values(errors).some(Boolean);
  const show = (k: keyof typeof errors) => fieldErrors[k] || (touched ? errors[k] : undefined);

  const submit = () => {
    setTouched(true);
    setFormError(null);
    setFieldErrors({});
    if (invalid || !date) return;
    send.mutate(
      {
        idempotencyKey,
        body: {
          kind, serviceId, petName: petName.trim(), petType, preferredDate: date,
          preferredTime: time ?? undefined,
          endDate: sitting ? endDate ?? undefined : undefined,
          message: message.trim() || undefined,
        },
      },
      {
        onSuccess: (r) =>
          navigation.replace("BookingSuccess", {
            reference: r.reference,
            kind: "pet",
            headline: sitting ? "Sitting Requested" : "Appointment Requested",
            message: `${clinic.data!.name} will confirm your ${sitting ? "pet sitting request" : "appointment"} shortly.`,
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
      <AppHeader title={sitting ? "Pet sitting" : "Book appointment"} />
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : undefined}>
        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
          <Text style={styles.clinic}>{clinic.data.name}</Text>

          <Text style={styles.label}>Service</Text>
          {services.length === 0 ? (
            <Text style={styles.error}>This provider has no {sitting ? "sitting" : "appointment"} services listed.</Text>
          ) : (
            services.map((sv) => (
              <RadioRow key={sv.id} label={sv.name} sublabel={`${sv.priceLabel ?? "Price on request"} · ${sv.durationLabel}`}
                selected={serviceId === sv.id} onPress={() => setServiceId(sv.id)} bordered />
            ))
          )}
          {show("serviceId") ? <Text style={styles.error}>{show("serviceId")}</Text> : null}

          <TextField label="Pet's name" value={petName} onChangeText={setPetName} maxLength={60} error={show("petName")} containerStyle={{ marginTop: 14 }} />
          <Text style={styles.label}>Type of pet</Text>
          <View style={styles.wrap}>
            {PET_TYPES.map((t) => (
              <RadioRow key={t.code} label={t.label} selected={petType === t.code} onPress={() => setPetType(t.code)} bordered style={styles.half} />
            ))}
          </View>
          {show("petType") ? <Text style={styles.error}>{show("petType")}</Text> : null}

          <DateField label={sitting ? "Start date" : "Date"} value={date}
            onChange={(v) => { setDate(v); if (endDate && v && endDate < v) setEndDate(null); }}
            min={minDate} max={maxDate} minMessage="Choose a date after today" maxMessage="Choose a date within the next year"
            error={show("preferredDate")} containerStyle={{ marginTop: 14 }} />
          {sitting ? (
            <DateField label="End date" optional value={endDate} onChange={setEndDate} clearable
              min={endMin} max={endMax < maxDate ? endMax : maxDate}
              minMessage="The end date can't be before the start date"
              maxMessage={`Sitting can be booked for up to ${MAX_SITTING_DAYS} days at a time`}
              error={fieldErrors.endDate} />
          ) : null}
          <DateField label="Preferred time" optional mode="time" value={time} onChange={setTime} clearable error={fieldErrors.preferredTime} />
          <TextField label="Notes for the provider" optional value={message} onChangeText={setMessage} multiline maxLength={500}
            placeholder="Allergies, medication, behaviour…" error={fieldErrors.message} />

          {date ? <Text style={styles.summary}>{formatDate(date)}{sitting && endDate ? ` → ${formatDate(endDate)}` : ""}</Text> : null}
          {formError ? <Text style={styles.error} accessibilityLiveRegion="polite">{formError}</Text> : null}
          <Button label={sitting ? "Send sitting request" : "Request appointment"} variant="pill" onPress={submit}
            loading={send.isPending} disabled={send.isPending || services.length === 0} style={{ marginTop: 18 }} />
        </ScrollView>
      </KeyboardAvoidingView>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  content: { paddingHorizontal: spacing.lg, paddingTop: 8, paddingBottom: 32 },
  clinic: { fontSize: 17, fontWeight: "700", color: colors.text, marginBottom: 12 },
  label: { fontSize: 13, fontWeight: "500", color: colors.secondaryText, marginBottom: 10 },
  error: { fontSize: 12.5, color: colors.error, marginTop: 4, marginBottom: 4 },
  wrap: { flexDirection: "row", flexWrap: "wrap", justifyContent: "space-between" },
  half: { width: "48.5%" },
  summary: { fontSize: 12.5, color: colors.secondaryText, marginTop: 4 },
});
