import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  KeyboardAvoidingView,
  Platform,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import ScreenContainer from "../../components/ScreenContainer";
import AppHeader from "../../components/AppHeader";
import DateField from "../../components/DateField";
import RadioRow from "../../components/RadioRow";
import TextField from "../../components/TextField";
import PhonePrefix from "../../components/PhonePrefix";
import SelectField from "../../components/SelectField";
import Button from "../../components/Button";
import { colors, radii, spacing } from "../../theme";
import { useCreateAppointment, useEmergencyContact, useReference } from "../../api/queries";
import { ApiError } from "../../api/errors";
import { newIdempotencyKey } from "../../utils/device";
import { useMultiStepBack } from "../../hooks/useMultiStepBack";
import { addDays, utcTodayIso } from "../../utils/dates";
import { BOOKING_WINDOW_DAYS } from "../../utils/validation";
import { RootScreenProps } from "../../navigation/types";

export default function BookAppointmentScreen({
  navigation,
  route,
}: RootScreenProps<"BookAppointment">) {
  const [step, setStep] = useState(1);
  const reference = useReference();
  const createAppointment = useCreateAppointment();
  // One key per attempt: a retry after a network blip must not double-book.
  const [idempotencyKey] = useState(newIdempotencyKey);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const appointmentTypes = reference.data?.appointmentTypes ?? [];
  const relationships = reference.data?.relationships ?? [];

  // Step 1
  const [type, setType] = useState<string | null>(null);
  const [date, setDate] = useState<string | null>(null);
  const [time, setTime] = useState<string | null>(null);
  // Set when the server rejects a date the client let through (e.g. the window
  // moved); shown on the field itself rather than on a later step.
  const [serverDateError, setServerDateError] = useState<string | null>(null);
  // Step 2
  const [underTreatment, setUnderTreatment] = useState<boolean | null>(null);
  const [condition, setCondition] = useState("");
  // Step 3
  const [firstname, setFirstname] = useState("");
  const [lastname, setLastname] = useState("");
  const [phone, setPhone] = useState("");
  const [relationship, setRelationship] = useState<string | null>(null);
  const [accompany, setAccompany] = useState(false);

  // Reuse the emergency contact saved on the profile instead of asking again.
  const savedContact = useEmergencyContact();
  const prefilled = useRef(false);
  useEffect(() => {
    const c = savedContact.data?.contact;
    if (c && !prefilled.current) {
      prefilled.current = true;
      setFirstname((v) => v || c.firstName);
      setLastname((v) => v || c.lastName);
      setPhone((v) => v || c.phone);
      setRelationship((v) => v || c.relationship.charAt(0).toUpperCase() + c.relationship.slice(1));
    }
  }, [savedContact.data]);

  const back = useCallback(
    () => (step > 1 ? setStep((s) => s - 1) : navigation.goBack()),
    [step, navigation]
  );
  // Android hardware back / iOS swipe should walk the steps, not exit the flow.
  useMultiStepBack(step, useCallback(() => setStep((s) => s - 1), []));

  // A submit failure belongs to the step it was raised on; carrying it onto
  // another step shows the member an error about a field that isn't there.
  useEffect(() => { setSubmitError(null); }, [step]);

  // The API's window: strictly after today, within a year — in UTC, like the server.
  const minDate = addDays(utcTodayIso(), 1);
  const maxDate = addDays(utcTodayIso(), BOOKING_WINDOW_DAYS);

  const titles = ["Appointment Details", "Medical History", "Emergency Contact"];
  const canNext =
    step === 1
      ? !!type && !!date
      : step === 2
      ? underTreatment === false || (underTreatment === true && condition.trim().length > 0)
      : firstname.trim() && lastname.trim() && phone.trim() && relationship;

  const submit = async () => {
    setSubmitError(null);
    if (!date) {
      // Unreachable in normal use (Next is gated on it); send the member to the field.
      setStep(1);
      return;
    }
    try {
      const created = await createAppointment.mutateAsync({
        idempotencyKey,
        body: {
          hospitalId: route.params.hospitalId,
          packageId: route.params.packageId ?? null,
          appointmentType: type,
          requestedDate: date,
          requestedTime: time ?? undefined,
          underTreatment: underTreatment === true,
          conditionNote: condition.trim() || undefined,
          emergencyContact: {
            firstName: firstname.trim(),
            lastName: lastname.trim(),
            phone: phone.trim(),
            relationship: (relationship ?? "other").toLowerCase(),
            accompanies: accompany,
          },
        },
      });
      navigation.replace("BookingSuccess", {
        reference: created.reference,
        kind: "appointment",
        detail: { route: "AppointmentDetail", appointmentId: created.id },
      });
    } catch (err) {
      const e = err as ApiError;
      if (e.fields?.requestedDate) {
        setServerDateError(e.fields.requestedDate);
        setStep(1);
        return;
      }
      setSubmitError(
        e.isOffline
          ? "You appear to be offline. Check your connection and try again."
          : e.isQuota
          ? "You have used all the bookings on your current plan. Upgrade to continue."
          : e.message || "We could not submit your booking. Please try again."
      );
    }
  };

  const next = () => {
    if (step < 3) setStep(step + 1);
    else void submit();
  };

  return (
    <ScreenContainer>
      <AppHeader title="Book Appointment" onBack={back} />
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
      <ScrollView
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="interactive"
        contentContainerStyle={styles.content}
      >
        <Text style={styles.step}>
          <Text style={styles.stepCurrent}>{step}</Text> of 3
        </Text>
        <Text style={styles.title}>{titles[step - 1]}</Text>

        {step === 1 && (
          <View>
            <Text style={styles.fieldLabel}>Select type of Appointment</Text>
            {appointmentTypes.map((t) => (
              <RadioRow
                key={t.code}
                label={t.label}
                selected={type === t.code}
                onPress={() => setType(t.code)}
                bordered
              />
            ))}
            <DateField
              label="Appointment Date"
              value={date}
              onChange={(v) => { setDate(v); setServerDateError(null); }}
              min={minDate}
              max={maxDate}
              minMessage="Choose a date after today"
              maxMessage="Choose a date within the next year"
              requiredMessage="Choose the appointment date"
              error={serverDateError ?? undefined}
              containerStyle={{ marginTop: 10 }}
            />
            <DateField
              label="Preferred time"
              optional
              mode="time"
              value={time}
              onChange={setTime}
              clearable
            />
          </View>
        )}

        {step === 2 && (
          <View>
            <Text style={styles.question}>
              Are you currently under treatment for any medical condition?
            </Text>
            <RadioRow
              label="Yes"
              selected={underTreatment === true}
              onPress={() => setUnderTreatment(true)}
              style={{ marginTop: 14 }}
            />
            <RadioRow
              label="No"
              selected={underTreatment === false}
              onPress={() => setUnderTreatment(false)}
              style={{ marginTop: 12 }}
            />
            <Text style={[styles.fieldLabel, { marginTop: 20 }]}>If Yes, Please specify</Text>
            <TextField
              placeholder="Medical condition"
              value={condition}
              onChangeText={setCondition}
              autoCapitalize="sentences"
              maxLength={200}
              returnKeyType="done"
              multiline
              accessibilityLabel="Describe your medical condition"
            />
          </View>
        )}

        {step === 3 && (
          <View>
            <View style={styles.nameRow}>
              <TextField
                label="Firstname"
                placeholder="Firstname"
                value={firstname}
                onChangeText={setFirstname}
                autoCapitalize="words"
                textContentType="givenName"
                maxLength={40}
                returnKeyType="next"
                containerStyle={styles.nameField}
              />
              <TextField
                label="Lastname"
                placeholder="Lastname"
                value={lastname}
                onChangeText={setLastname}
                autoCapitalize="words"
                textContentType="familyName"
                maxLength={40}
                returnKeyType="next"
                containerStyle={[styles.nameField, { marginLeft: 12 }]}
              />
            </View>
            <TextField
              label="Phone number"
              placeholder="Phone number"
              value={phone}
              onChangeText={setPhone}
              keyboardType="phone-pad"
              textContentType="telephoneNumber"
              autoComplete="tel"
              maxLength={20}
              returnKeyType="done"
              left={<PhonePrefix />}
            />
            <SelectField
              label="Relationship"
              value={relationship}
              options={relationships.map(titleCase)}
              onSelect={setRelationship}
            />
            <TouchableOpacity style={styles.accompanyRow} onPress={() => setAccompany((a) => !a)}>
              <View style={[styles.checkbox, accompany && styles.checkboxChecked]}>
                {accompany && <Ionicons name="checkmark" size={12} color="#fff" />}
              </View>
              <Text style={styles.accompanyText}>My Emergency Contact will accompany me</Text>
            </TouchableOpacity>
          </View>
        )}

        <View style={styles.bottom}>
          {submitError ? <Text style={styles.error}>{submitError}</Text> : null}
          <Button
            label={step === 3 ? "Submit" : step === 2 ? "Proceed" : "Next"}
            variant="pill"
            disabled={!canNext || createAppointment.isPending}
            loading={createAppointment.isPending}
            onPress={next}
          />
        </View>
      </ScrollView>
      </KeyboardAvoidingView>
    </ScreenContainer>
  );
}

/** Reference data is lowercase codes; the form shows them the way the design does. */
const titleCase = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

const styles = StyleSheet.create({
  content: { paddingHorizontal: spacing.lg, paddingTop: spacing.sm, flexGrow: 1, paddingBottom: 30 },
  step: { fontSize: 12, color: colors.secondaryText, marginBottom: 6 },
  stepCurrent: { color: colors.primary, fontWeight: "700" },
  title: { fontSize: 21, fontWeight: "700", color: colors.text, marginBottom: 16 },
  fieldLabel: { fontSize: 12.5, fontWeight: "500", color: colors.secondaryText, marginBottom: 10 },
  question: { fontSize: 13.5, color: colors.text, lineHeight: 19 },
  nameRow: { flexDirection: "row" },
  nameField: { flex: 1 },
  accompanyRow: { flexDirection: "row", alignItems: "center", marginTop: 4 },
  checkbox: {
    width: 18,
    height: 18,
    borderRadius: radii.xs - 2,
    borderWidth: 1.5,
    borderColor: colors.tertiaryText,
    alignItems: "center",
    justifyContent: "center",
  },
  checkboxChecked: { backgroundColor: colors.primary, borderColor: colors.primary },
  accompanyText: { fontSize: 12.5, color: colors.text, marginLeft: 10 },
  bottom: { marginTop: "auto", paddingTop: 30 },
  error: { fontSize: 12.5, color: colors.error, marginBottom: 12, lineHeight: 18 },
});
