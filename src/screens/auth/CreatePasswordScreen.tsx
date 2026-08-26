import React, { useCallback, useEffect, useState } from "react";
import { View, Text, StyleSheet, Image, TouchableOpacity, Alert, Platform } from "react-native";
import * as LocalAuthentication from "expo-local-authentication";
import ScreenContainer from "../../components/ScreenContainer";
import TextField from "../../components/TextField";
import Button from "../../components/Button";
import { images } from "../../data/mock";
import { endpoints } from "../../api/endpoints";
import { ApiError } from "../../api/errors";
import { saveTokens } from "../../api/tokens";
import { useSession } from "../../state/Session";
import { getInstallId } from "../../utils/device";
import { colors, radii, spacing } from "../../theme";
import { RootScreenProps } from "../../navigation/types";

export default function CreatePasswordScreen({ navigation }: RootScreenProps<"CreatePassword">) {
  const { refreshSetup } = useSession();
  const [saving, setSaving] = useState(false);
  const [password, setPassword] = useState("");
  const [touched, setTouched] = useState(false);
  const [biometry, setBiometry] = useState<{ available: boolean; enrolled: boolean }>({
    available: false,
    enrolled: false,
  });
  const [authenticating, setAuthenticating] = useState(false);

  const valid = password.length >= 8;
  const error =
    touched && password.length > 0 && !valid ? "Use at least 8 characters" : undefined;

  // Capability check only — no prompt is raised until the user taps.
  useEffect(() => {
    let alive = true;
    (async () => {
      const [available, enrolled] = await Promise.all([
        LocalAuthentication.hasHardwareAsync(),
        LocalAuthentication.isEnrolledAsync(),
      ]);
      if (alive) setBiometry({ available, enrolled });
    })();
    return () => {
      alive = false;
    };
  }, []);

  const savePassword = useCallback(async (): Promise<boolean> => {
    if (saving || !valid) return false;
    setSaving(true);
    try {
      // Setting the password revokes other sessions; the API returns a fresh
      // pair so this device stays signed in.
      const { tokens } = await endpoints.me.setPassword(password);
      await saveTokens(tokens);
      await refreshSetup();
      return true;
    } catch (e) {
      Alert.alert("Couldn't set your password", e instanceof ApiError ? e.message : "Please try again.");
      return false;
    } finally {
      setSaving(false);
    }
  }, [saving, valid, password, refreshSetup]);

  const authenticate = useCallback(
    async (label: string) => {
      if (authenticating) return; // guards repeated taps
      if (!biometry.available) {
        Alert.alert(`${label} unavailable`, "This device doesn't support biometric sign-in.");
        return;
      }
      if (!biometry.enrolled) {
        Alert.alert(
          `Set up ${label} first`,
          `No biometrics are enrolled on this device. Add them in Settings to use ${label}.`
        );
        return;
      }
      setAuthenticating(true);
      try {
        const res = await LocalAuthentication.authenticateAsync({
          promptMessage: `Use ${label} to secure MedPilot`,
          fallbackLabel: "Use password",
          cancelLabel: "Cancel",
        });
        if (res.success) {
          // Biometrics unlock a locally stored session; the password is still
          // what authenticates against the server.
          const ok = await savePassword();
          if (!ok) return;
          const installId = await getInstallId();
          await endpoints.me.registerDevice({ platform: Platform.OS === "android" ? "android" : "ios", installId }).catch(() => {});
          await endpoints.me.setBiometric({ installId, enabled: true }).catch(() => {});
          navigation.navigate("SetupChecklist");
        } else if (res.error !== "user_cancel" && res.error !== "system_cancel") {
          Alert.alert("Authentication failed", "We couldn't verify you. Please try again.");
        }
        // user_cancel / system_cancel: stay put silently
      } catch {
        Alert.alert(`${label} unavailable`, "Biometric authentication isn't available right now.");
      } finally {
        setAuthenticating(false);
      }
    },
    [authenticating, biometry, savePassword, navigation]
  );

  return (
    <ScreenContainer scroll>
      <View style={styles.body}>
        <Image source={images.illusPassword} style={styles.illustration} resizeMode="contain" />
        <Text style={styles.title}>Create Password</Text>
        <Text style={styles.hint}>
          At least 8 characters long but 10 or more is better. A combination of uppercase letters,
          lowercase letters, numbers, and symbols.
        </Text>
        <TextField
          label="Password"
          placeholder="Password"
          secure
          value={password}
          onChangeText={setPassword}
          onBlur={() => setTouched(true)}
          error={error}
          textContentType="newPassword"
          returnKeyType="done"
          onSubmitEditing={() => valid && setPassword(password)}
          containerStyle={{ marginTop: 16 }}
        />
        <Button
          label="Set Password"
          variant="pill"
          disabled={!valid}
          loading={saving}
          onPress={async () => {
            if (await savePassword()) navigation.navigate("SetupChecklist");
          }}
          style={{ marginTop: 8 }}
        />

        <View style={styles.dividerRow}>
          <View style={styles.divider} />
          <Text style={styles.dividerText}>OR CONNECT WITH YOUR</Text>
          <View style={styles.divider} />
        </View>

        <View style={styles.bioRow}>
          <TouchableOpacity
            style={styles.bioItem}
            onPress={() => authenticate("Face ID")}
            disabled={authenticating}
            accessibilityRole="button"
            accessibilityLabel="Set up Face ID"
            accessibilityState={{ disabled: authenticating }}
          >
            <Image
              source={images.faceId}
              style={[styles.bioIcon, !biometry.available && styles.bioIconOff]}
            />
            <Text style={styles.bioLabel}>Face ID</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.bioItem}
            onPress={() => authenticate("Optic ID")}
            disabled={authenticating}
            accessibilityRole="button"
            accessibilityLabel="Set up Optic ID"
            accessibilityState={{ disabled: authenticating }}
          >
            <Image
              source={images.opticId}
              style={[styles.bioIcon, !biometry.available && styles.bioIconOff]}
            />
            <Text style={styles.bioLabel}>Optic ID</Text>
          </TouchableOpacity>
        </View>
        {!biometry.available && (
          <Text style={styles.bioNote}>Biometric sign-in isn't available on this device.</Text>
        )}
      </View>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  body: { paddingHorizontal: spacing.xl, paddingTop: 30 },
  illustration: { width: 210, height: 165, alignSelf: "center" },
  title: { fontSize: 20, fontWeight: "700", color: colors.text, marginTop: 24 },
  hint: { fontSize: 12.5, color: colors.secondaryText, lineHeight: 18, marginTop: 8 },
  dividerRow: { flexDirection: "row", alignItems: "center", marginVertical: 24 },
  divider: { flex: 1, height: 1, backgroundColor: colors.border },
  dividerText: { fontSize: 10.5, color: colors.tertiaryText, marginHorizontal: 10, letterSpacing: 0.5 },
  bioRow: { flexDirection: "row", justifyContent: "center" },
  bioItem: { alignItems: "center", marginHorizontal: 18 },
  bioIcon: {
    width: 52,
    height: 52,
    borderRadius: radii.md,
  },
  bioIconOff: { opacity: 0.4 },
  bioLabel: { fontSize: 11, color: colors.secondaryText, marginTop: 6 },
  bioNote: {
    fontSize: 11.5,
    color: colors.tertiaryText,
    textAlign: "center",
    marginTop: 12,
  },
});
