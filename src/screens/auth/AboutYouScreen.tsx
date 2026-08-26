import React, { useRef, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  TextInput,
  ScrollView,
} from "react-native";
import ScreenContainer from "../../components/ScreenContainer";
import AppHeader from "../../components/AppHeader";
import TextField from "../../components/TextField";
import PhonePrefix from "../../components/PhonePrefix";
import SelectField from "../../components/SelectField";
import Button from "../../components/Button";
import { colors, spacing } from "../../theme";
import { MAX_NAME, validateDob, validateName, validatePhone } from "../../utils/validation";
import { RootScreenProps } from "../../navigation/types";

type Field = "firstname" | "lastname" | "phone" | "dob";

export default function AboutYouScreen({ navigation, route }: RootScreenProps<"AboutYou">) {
  const [firstname, setFirstname] = useState("");
  const [lastname, setLastname] = useState("");
  const [phone, setPhone] = useState("");
  const [dob, setDob] = useState("");
  const [gender, setGender] = useState<string | null>(null);
  const [marital, setMarital] = useState<string | null>(null);
  const [touched, setTouched] = useState<Record<Field, boolean>>({
    firstname: false,
    lastname: false,
    phone: false,
    dob: false,
  });

  const lastnameRef = useRef<TextInput>(null);
  const phoneRef = useRef<TextInput>(null);
  const dobRef = useRef<TextInput>(null);

  const errors: Record<Field, string | undefined> = {
    firstname: validateName(firstname, "Firstname"),
    lastname: validateName(lastname, "Lastname"),
    phone: validatePhone(phone),
    dob: validateDob(dob),
  };
  const shown = (f: Field) => (touched[f] ? errors[f] : undefined);
  const markTouched = (f: Field) => setTouched((t) => ({ ...t, [f]: true }));
  const canSubmit = !Object.values(errors).some(Boolean);

  const submit = () => {
    setTouched({ firstname: true, lastname: true, phone: true, dob: true });
    if (canSubmit) navigation.navigate("VerifyEmail");
  };

  return (
    <ScreenContainer>
      <AppHeader title="Create Account" />
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        <ScrollView
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="interactive"
          contentContainerStyle={styles.body}
        >
          <Text style={styles.hint}>{route.params.email}</Text>
          <Text style={styles.title}>Tell us about yourself</Text>

          <View style={styles.nameRow}>
            <TextField
              label="Firstname"
              placeholder="Firstname"
              value={firstname}
              onChangeText={setFirstname}
              onBlur={() => markTouched("firstname")}
              error={shown("firstname")}
              autoCapitalize="words"
              autoComplete="given-name"
              textContentType="givenName"
              maxLength={MAX_NAME}
              returnKeyType="next"
              onSubmitEditing={() => lastnameRef.current?.focus()}
              containerStyle={styles.nameField}
            />
            <TextField
              ref={lastnameRef}
              label="Lastname"
              placeholder="Lastname"
              value={lastname}
              onChangeText={setLastname}
              onBlur={() => markTouched("lastname")}
              error={shown("lastname")}
              autoCapitalize="words"
              autoComplete="family-name"
              textContentType="familyName"
              maxLength={MAX_NAME}
              returnKeyType="next"
              onSubmitEditing={() => phoneRef.current?.focus()}
              containerStyle={[styles.nameField, { marginLeft: 12 }]}
            />
          </View>

          <TextField
            ref={phoneRef}
            label="Phone number"
            placeholder="Phone number"
            value={phone}
            onChangeText={setPhone}
            onBlur={() => markTouched("phone")}
            error={shown("phone")}
            keyboardType="phone-pad"
            autoComplete="tel"
            textContentType="telephoneNumber"
            maxLength={20}
            returnKeyType="next"
            onSubmitEditing={() => dobRef.current?.focus()}
            left={<PhonePrefix />}
          />

          <TextField
            ref={dobRef}
            label="Date of Birth"
            placeholder="YYYY-MM-DD"
            value={dob}
            onChangeText={setDob}
            onBlur={() => markTouched("dob")}
            error={shown("dob")}
            keyboardType={Platform.OS === "ios" ? "numbers-and-punctuation" : "default"}
            autoComplete="birthdate-full"
            maxLength={10}
            returnKeyType="done"
            onSubmitEditing={submit}
          />

          <SelectField
            label="Gender"
            optional
            value={gender}
            options={["Male", "Female", "Prefer not to say"]}
            onSelect={setGender}
          />

          <SelectField
            label="Marital Status"
            optional
            value={marital}
            options={["Single", "Married", "Divorced", "Widowed"]}
            onSelect={setMarital}
          />

          <Text style={styles.terms}>
            By clicking on Submit, you agree to the EliteCare's{" "}
            <Text style={styles.link}>Terms & Conditions</Text> and{" "}
            <Text style={styles.link}>Privacy Policy</Text>
          </Text>

          <Button
            label="Submit"
            variant="pill"
            disabled={!firstname.trim() || !lastname.trim() || !phone.trim() || !dob.trim()}
            onPress={submit}
            style={{ marginTop: 22, marginBottom: 12 }}
          />
        </ScrollView>
      </KeyboardAvoidingView>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  body: { paddingHorizontal: spacing.xl, paddingTop: spacing.md, paddingBottom: 32 },
  hint: { fontSize: 12, color: colors.secondaryText },
  title: { fontSize: 20, fontWeight: "700", color: colors.text, marginTop: 6, marginBottom: 18 },
  nameRow: { flexDirection: "row" },
  nameField: { flex: 1 },
  terms: { fontSize: 12, color: colors.secondaryText, textAlign: "center", lineHeight: 17, marginTop: 8 },
  link: { color: colors.primary },
});
