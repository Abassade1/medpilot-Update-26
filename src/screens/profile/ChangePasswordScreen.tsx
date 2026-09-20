import React, { useState } from "react";
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text, View } from "react-native";
import ScreenContainer from "../../components/ScreenContainer";
import AppHeader from "../../components/AppHeader";
import Button from "../../components/Button";
import TextField from "../../components/TextField";
import ToastBanner from "../../components/ToastBanner";
import { endpoints } from "../../api/endpoints";
import { saveTokens } from "../../api/tokens";
import { ApiError } from "../../api/errors";
import { validatePassword } from "../../utils/validation";
import { colors, spacing } from "../../theme";
import { RootScreenProps } from "../../navigation/types";

export default function ChangePasswordScreen({ navigation }: RootScreenProps<"ChangePassword">) {
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [confirm, setConfirm] = useState("");
  const [touched, setTouched] = useState<Record<string, boolean>>({});
  const [serverError, setServerError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState<string | null>(null);

  const errors = {
    current: current ? undefined : "Enter your current password",
    next: validatePassword(next) ?? (next && next === current ? "Choose a password you haven't used here" : undefined),
    confirm: confirm === next ? undefined : "Passwords don't match",
  };
  const shown = (k: keyof typeof errors) => (k === "current" && serverError ? serverError : touched[k] ? errors[k] : undefined);

  const submit = async () => {
    setTouched({ current: true, next: true, confirm: true });
    setServerError(null);
    if (errors.current || errors.next || errors.confirm || saving) return;
    setSaving(true);
    try {
      // Changing the password revokes other sessions; the API returns fresh tokens for this one.
      const { tokens } = await endpoints.me.setPassword(next, current);
      await saveTokens(tokens);
      setToast("Password updated");
      setTimeout(() => navigation.goBack(), 900);
    } catch (e) {
      const err = e as ApiError;
      setServerError(err.fields?.currentPassword || (err.status === 401 || err.status === 403 || err.code === "validation_failed"
        ? "That isn't your current password" : err.message || "Couldn't update your password. Please try again."));
    } finally {
      setSaving(false);
    }
  };

  return (
    <ScreenContainer>
      <AppHeader title="Change password" />
      <ToastBanner visible={!!toast} message={toast ?? ""} />
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : undefined}>
        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
          <Text style={styles.intro}>Other devices will be signed out when you change your password.</Text>
          <TextField label="Current password" secure value={current} onChangeText={(t) => { setCurrent(t); setServerError(null); }}
            onBlur={() => setTouched((t) => ({ ...t, current: true }))} error={shown("current")} textContentType="password" />
          <TextField label="New password" secure value={next} onChangeText={setNext}
            onBlur={() => setTouched((t) => ({ ...t, next: true }))} error={shown("next")} textContentType="newPassword" />
          <TextField label="Confirm new password" secure value={confirm} onChangeText={setConfirm}
            onBlur={() => setTouched((t) => ({ ...t, confirm: true }))} error={shown("confirm")} textContentType="newPassword" />
          <View style={{ marginTop: 18 }}>
            <Button label="Update password" variant="pill" onPress={() => void submit()} loading={saving} disabled={saving} />
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
});
