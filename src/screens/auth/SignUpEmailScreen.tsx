import React, { useState } from "react";
import { View, Text, StyleSheet, TouchableOpacity } from "react-native";
import ScreenContainer from "../../components/ScreenContainer";
import AppHeader from "../../components/AppHeader";
import TextField from "../../components/TextField";
import Button from "../../components/Button";
import { colors, spacing } from "../../theme";
import { validateEmail } from "../../utils/validation";
import { endpoints } from "../../api/endpoints";
import { ApiError } from "../../api/errors";
import { RootScreenProps } from "../../navigation/types";

export default function SignUpEmailScreen({ navigation }: RootScreenProps<"SignUpEmail">) {
  const [email, setEmail] = useState("");
  const [touched, setTouched] = useState(false);
  const [serverError, setServerError] = useState<string | undefined>();
  const [busy, setBusy] = useState(false);

  const error = serverError ?? (touched ? validateEmail(email) : undefined);
  const valid = !validateEmail(email);

  const submit = async () => {
    setTouched(true);
    setServerError(undefined);
    if (!valid || busy) return;
    setBusy(true);
    try {
      // Catches a taken address before the member fills in the whole profile.
      const { available } = await endpoints.auth.checkEmail(email.trim());
      if (!available) {
        setServerError("An account with this email already exists");
        return;
      }
      navigation.navigate("AboutYou", { email: email.trim() });
    } catch (e) {
      if (e instanceof ApiError && e.isOffline) setServerError(e.message);
      else navigation.navigate("AboutYou", { email: email.trim() });
    } finally {
      setBusy(false);
    }
  };

  return (
    <ScreenContainer>
      <AppHeader title="Create Account" />
      <View style={styles.body}>
        <Text style={styles.hint}>You'll need to confirm this email later</Text>
        <Text style={styles.title}>Whats your email?</Text>
        <TextField
          label="Email address"
          placeholder="Enter email address"
          value={email}
          onChangeText={(t) => { setEmail(t); if (serverError) setServerError(undefined); }}
          onBlur={() => setTouched(true)}
          error={error}
          autoCapitalize="none"
          autoCorrect={false}
          autoComplete="email"
          textContentType="emailAddress"
          keyboardType="email-address"
          returnKeyType="next"
          onSubmitEditing={submit}
          containerStyle={{ marginTop: 18 }}
        />

        <View style={styles.bottom}>
          <Button
            label="Next"
            variant="pill"
            disabled={!email.trim()}
            loading={busy}
            onPress={submit}
          />
          <TouchableOpacity style={styles.footer} onPress={() => navigation.navigate("SignIn")}>
            <Text style={styles.footerText}>Already have an account? Sign in</Text>
          </TouchableOpacity>
        </View>
      </View>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  body: { flex: 1, paddingHorizontal: spacing.xl, paddingTop: spacing.md },
  hint: { fontSize: 12, color: colors.secondaryText },
  title: { fontSize: 20, fontWeight: "700", color: colors.text, marginTop: 6 },
  bottom: { marginTop: "auto", paddingBottom: 28 },
  footer: { alignItems: "center", marginTop: 18 },
  footerText: { fontSize: 13.5, fontWeight: "600", color: colors.text, textDecorationLine: "underline" },
});
