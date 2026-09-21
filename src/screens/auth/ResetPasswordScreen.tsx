import React, { useState } from "react";
import { Alert, KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text, View } from "react-native";
import ScreenContainer from "../../components/ScreenContainer";
import AppHeader from "../../components/AppHeader";
import Button from "../../components/Button";
import TextField from "../../components/TextField";
import { endpoints } from "../../api/endpoints";
import { ApiError } from "../../api/errors";
import { validatePassword } from "../../utils/validation";
import { colors, spacing } from "../../theme";
import { RootScreenProps } from "../../navigation/types";

/** Finishes a password reset: the emailed link opens this with the token filled in, or the code can be pasted. */
export default function ResetPasswordScreen({ navigation, route }: RootScreenProps<"ResetPassword">) {
  const [token, setToken] = useState(route.params?.token ?? "");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [touched, setTouched] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const errors = {
    token: token.trim().length >= 20 ? undefined : "Paste the code from your email",
    password: validatePassword(password),
    confirm: confirm === password ? undefined : "Passwords don't match",
  };
  const show = (k: keyof typeof errors) => (touched ? errors[k] : undefined);

  const submit = async () => {
    setTouched(true);
    setError(null);
    if (errors.token || errors.password || errors.confirm || busy) return;
    setBusy(true);
    try {
      await endpoints.auth.resetPassword(token.trim(), password);
      Alert.alert("Password updated", "Sign in with your new password.", [
        { text: "Sign in", onPress: () => navigation.reset({ index: 0, routes: [{ name: "SignIn" }] }) },
      ]);
    } catch (e) {
      const err = e as ApiError;
      setError(
        err.isOffline
          ? err.message
          : err.status === 400 || err.status === 401 || err.status === 422
          ? "This reset link is invalid or has expired. Go back and request a new one."
          : err.message || "We couldn't reset your password. Please try again.",
      );
    } finally {
      setBusy(false);
    }
  };

  return (
    <ScreenContainer>
      <AppHeader title="Reset password" />
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : undefined}>
        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
          <Text style={styles.intro}>
            {route.params?.email ? `We emailed a reset link to ${route.params.email}. ` : ""}
            Open the link, or paste the code from the email below. The link works once and expires in an hour.
          </Text>
          <TextField label="Code from your email" value={token} onChangeText={setToken} autoCapitalize="none" autoCorrect={false} error={show("token")} />
          <TextField label="New password" secure value={password} onChangeText={setPassword} textContentType="newPassword" error={show("password")} />
          <TextField label="Confirm new password" secure value={confirm} onChangeText={setConfirm} textContentType="newPassword" error={show("confirm")} onSubmitEditing={() => void submit()} returnKeyType="done" />
          {error ? <Text style={styles.error} accessibilityLiveRegion="polite">{error}</Text> : null}
          <View style={{ marginTop: 18 }}>
            <Button label="Update password" variant="pill" onPress={() => void submit()} loading={busy} disabled={busy} />
            <Button label="Back to sign in" variant="outlinePill" onPress={() => navigation.reset({ index: 0, routes: [{ name: "SignIn" }] })} style={{ marginTop: 10 }} />
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  content: { paddingHorizontal: spacing.lg, paddingTop: 8, paddingBottom: 32 },
  intro: { fontSize: 13, color: colors.secondaryText, lineHeight: 19, marginBottom: 14 },
  error: { fontSize: 12.5, color: colors.error, marginTop: 8, lineHeight: 18 },
});
