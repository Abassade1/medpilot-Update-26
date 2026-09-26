import React, { useEffect, useRef, useState } from "react";
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text, View } from "react-native";
import ScreenContainer from "../../components/ScreenContainer";
import AppHeader from "../../components/AppHeader";
import Button from "../../components/Button";
import TextField from "../../components/TextField";
import SelectField from "../../components/SelectField";
import PhonePrefix from "../../components/PhonePrefix";
import ToastBanner from "../../components/ToastBanner";
import ListStateView from "../../components/ListStateView";
import { useMe, usePatchProfile } from "../../api/queries";
import { ApiError } from "../../api/errors";
import { MAX_NAME, validateName, validatePhone } from "../../utils/validation";
import { colors, spacing } from "../../theme";
import { RootScreenProps } from "../../navigation/types";

const GENDERS: Record<string, string> = { Male: "male", Female: "female", "Prefer not to say": "undisclosed" };
const MARITAL: Record<string, string> = { Single: "single", Married: "married", Divorced: "divorced", Widowed: "widowed" };
const labelOf = (map: Record<string, string>, code: string | null | undefined) =>
  Object.keys(map).find((k) => map[k] === code) ?? null;

export default function EditProfileScreen({ navigation }: RootScreenProps<"EditProfile">) {
  const me = useMe();
  const save = usePatchProfile();
  const p = me.data?.profile;

  const [first, setFirst] = useState("");
  const [last, setLast] = useState("");
  const [phone, setPhone] = useState("");
  const [gender, setGender] = useState<string | null>(null);
  const [marital, setMarital] = useState<string | null>(null);
  const [location, setLocation] = useState("");
  const [touched, setTouched] = useState<Record<string, boolean>>({});
  const [serverFields, setServerFields] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const seeded = useRef(false);

  useEffect(() => {
    if (p && !seeded.current) {
      seeded.current = true;
      setFirst(p.firstName); setLast(p.lastName); setPhone(p.phone ?? "");
      setGender(labelOf(GENDERS, p.gender)); setMarital(labelOf(MARITAL, p.maritalStatus));
      setLocation(p.locationLabel ?? "");
    }
  }, [p]);

  if (!p) {
    return (
      <ScreenContainer>
        <AppHeader title="Edit profile" />
        {me.isError ? <ListStateView kind="error" onRetry={() => void me.refetch()} /> : <ListStateView kind="loading" />}
      </ScreenContainer>
    );
  }

  const errors = {
    firstName: validateName(first, "Firstname"),
    lastName: validateName(last, "Lastname"),
    phone: validatePhone(phone),
  };
  const shown = (k: keyof typeof errors) => serverFields[k] || (touched[k] ? errors[k] : undefined);
  const touch = (k: string) => setTouched((t) => ({ ...t, [k]: true }));
  const clearServer = (k: string) => setServerFields((s) => ({ ...s, [k]: "" }));

  const body: Record<string, unknown> = {};
  if (first.trim() !== p.firstName) body.firstName = first.trim();
  if (last.trim() !== p.lastName) body.lastName = last.trim();
  if (phone.trim() !== (p.phone ?? "")) body.phone = phone.trim();
  if (gender && GENDERS[gender] !== p.gender) body.gender = GENDERS[gender];
  if (marital && MARITAL[marital] !== p.maritalStatus) body.maritalStatus = MARITAL[marital];
  if (location.trim() !== (p.locationLabel ?? "")) body.locationLabel = location.trim();
  const changed = Object.keys(body).length > 0;

  const submit = () => {
    setTouched({ firstName: true, lastName: true, phone: true });
    setFormError(null);
    if (errors.firstName || errors.lastName || errors.phone || !changed) return;
    save.mutate(body, {
      onSuccess: () => {
        setToast("Profile updated");
        setTimeout(() => navigation.goBack(), 900);
      },
      onError: (err) => {
        const e = err as ApiError;
        if (e.fields && Object.keys(e.fields).length) setServerFields(e.fields);
        else setFormError(e.isOffline ? e.message : e.message || "We couldn't save your changes. Please try again.");
      },
    });
  };

  return (
    <ScreenContainer>
      <AppHeader title="Edit profile" />
      <ToastBanner visible={!!toast} message={toast ?? ""} />
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : undefined}>
        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
          <TextField label="Firstname" value={first} onChangeText={(t) => { setFirst(t); clearServer("firstName"); }}
            onBlur={() => touch("firstName")} error={shown("firstName")} maxLength={MAX_NAME} autoCapitalize="words" />
          <TextField label="Lastname" value={last} onChangeText={(t) => { setLast(t); clearServer("lastName"); }}
            onBlur={() => touch("lastName")} error={shown("lastName")} maxLength={MAX_NAME} autoCapitalize="words" />
          <TextField label="Phone number" value={phone} onChangeText={(t) => { setPhone(t); clearServer("phone"); }}
            onBlur={() => touch("phone")} error={shown("phone")} keyboardType="phone-pad" maxLength={20} left={<PhonePrefix />} />
          <SelectField label="Gender" optional value={gender} options={Object.keys(GENDERS)} onSelect={setGender} />
          <SelectField label="Marital Status" optional value={marital} options={Object.keys(MARITAL)} onSelect={setMarital} />
          <TextField label="Location" optional placeholder="City, Country" value={location} onChangeText={setLocation} maxLength={80} />
          <Text style={styles.note}>Your email and date of birth can't be changed here. Contact support if they need correcting.</Text>

          {formError ? <Text style={styles.error} accessibilityLiveRegion="polite">{formError}</Text> : null}
          <View style={{ marginTop: 18 }}>
            <Button label="Save changes" variant="pill" onPress={submit} loading={save.isPending} disabled={!changed || save.isPending} />
            <Button label="Cancel" variant="outlinePill" onPress={() => navigation.goBack()} style={{ marginTop: 10 }} />
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  content: { paddingHorizontal: spacing.lg, paddingTop: 8, paddingBottom: 32 },
  note: { fontSize: 12, color: colors.secondaryText, lineHeight: 17, marginTop: 4 },
  error: { fontSize: 12.5, color: colors.error, marginTop: 10 },
});
