import React, { useEffect, useRef, useState } from "react";
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text, View } from "react-native";
import ScreenContainer from "../../components/ScreenContainer";
import AppHeader from "../../components/AppHeader";
import Button from "../../components/Button";
import TextField from "../../components/TextField";
import RadioRow from "../../components/RadioRow";
import PhonePrefix from "../../components/PhonePrefix";
import ToastBanner from "../../components/ToastBanner";
import { useEmergencyContact, usePutEmergencyContact, useReference } from "../../api/queries";
import { ApiError } from "../../api/errors";
import { MAX_NAME, validateName, validatePhone } from "../../utils/validation";
import { colors, spacing } from "../../theme";
import { RootScreenProps } from "../../navigation/types";

const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

export default function EmergencyContactScreen({ navigation }: RootScreenProps<"EmergencyContact">) {
  const existing = useEmergencyContact();
  const reference = useReference();
  const save = usePutEmergencyContact();
  const [first, setFirst] = useState("");
  const [last, setLast] = useState("");
  const [phone, setPhone] = useState("");
  const [relationship, setRelationship] = useState<string | null>(null);
  const [touched, setTouched] = useState<Record<string, boolean>>({});
  const [serverFields, setServerFields] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const seeded = useRef(false);

  useEffect(() => {
    const c = existing.data?.contact;
    if (existing.data && !seeded.current) {
      seeded.current = true;
      if (c) { setFirst(c.firstName); setLast(c.lastName); setPhone(c.phone); setRelationship(c.relationship); }
    }
  }, [existing.data]);

  const errors = {
    firstName: validateName(first, "Firstname"),
    lastName: validateName(last, "Lastname"),
    phone: validatePhone(phone),
    relationship: relationship ? undefined : "Choose how you know this person",
  };
  const shown = (k: keyof typeof errors) => serverFields[k] || (touched[k] ? errors[k] : undefined);
  const touch = (k: string) => setTouched((t) => ({ ...t, [k]: true }));

  const submit = () => {
    setTouched({ firstName: true, lastName: true, phone: true, relationship: true });
    setFormError(null);
    if (Object.values(errors).some(Boolean)) return;
    save.mutate(
      { firstName: first.trim(), lastName: last.trim(), phone: phone.trim(), relationship: relationship! },
      {
        onSuccess: () => { setToast("Emergency contact saved"); setTimeout(() => navigation.goBack(), 900); },
        onError: (err) => {
          const e = err as ApiError;
          if (e.fields && Object.keys(e.fields).length) setServerFields(e.fields);
          else setFormError(e.message || "We couldn't save this contact. Please try again.");
        },
      },
    );
  };

  return (
    <ScreenContainer>
      <AppHeader title="Emergency contact" />
      <ToastBanner visible={!!toast} message={toast ?? ""} />
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : undefined}>
        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
          <Text style={styles.intro}>We'll share this with the hospital only when you book an appointment.</Text>
          <TextField label="Firstname" value={first} onChangeText={(t) => { setFirst(t); setServerFields((s) => ({ ...s, firstName: "" })); }}
            onBlur={() => touch("firstName")} error={shown("firstName")} maxLength={MAX_NAME} autoCapitalize="words" />
          <TextField label="Lastname" value={last} onChangeText={(t) => { setLast(t); setServerFields((s) => ({ ...s, lastName: "" })); }}
            onBlur={() => touch("lastName")} error={shown("lastName")} maxLength={MAX_NAME} autoCapitalize="words" />
          <TextField label="Phone number" value={phone} onChangeText={(t) => { setPhone(t); setServerFields((s) => ({ ...s, phone: "" })); }}
            onBlur={() => touch("phone")} error={shown("phone")} keyboardType="phone-pad" maxLength={20} left={<PhonePrefix />} />
          <Text style={styles.label}>Relationship</Text>
          {(reference.data?.relationships ?? []).map((r) => (
            <RadioRow key={r} label={cap(r)} selected={relationship === r} onPress={() => { setRelationship(r); touch("relationship"); }} bordered />
          ))}
          {shown("relationship") ? <Text style={styles.error}>{shown("relationship")}</Text> : null}
          {formError ? <Text style={styles.error} accessibilityLiveRegion="polite">{formError}</Text> : null}
          <View style={{ marginTop: 18 }}>
            <Button label="Save contact" variant="pill" onPress={submit} loading={save.isPending} disabled={save.isPending} />
            <Button label="Cancel" variant="outlinePill" onPress={() => navigation.goBack()} style={{ marginTop: 10 }} />
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  content: { paddingHorizontal: spacing.lg, paddingTop: 8, paddingBottom: 32 },
  intro: { fontSize: 13, color: colors.secondaryText, lineHeight: 18, marginBottom: 12 },
  label: { fontSize: 13, fontWeight: "500", color: colors.secondaryText, marginTop: 4, marginBottom: 10 },
  error: { fontSize: 12.5, color: colors.error, marginTop: 6 },
});
