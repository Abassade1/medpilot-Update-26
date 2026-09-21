import React, { useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  KeyboardAvoidingView,
  Platform,
  TextInput,
  Alert,
} from "react-native";
import ScreenContainer from "../../components/ScreenContainer";
import LogoMark from "../../components/LogoMark";
import SocialButton from "../../components/SocialButton";
import Button from "../../components/Button";
import { colors, radii, spacing } from "../../theme";
import { validateEmail } from "../../utils/validation";
import { endpoints } from "../../api/endpoints";
import { ApiError } from "../../api/errors";
import { useSession } from "../../state/Session";
import { RootScreenProps } from "../../navigation/types";

export default function SignInScreen({ navigation }: RootScreenProps<"SignIn">) {
  const { adopt } = useSession();
  // Social sign-in has no backend yet. It must not pretend to work (it used to open the app with no
  // session), so it says so and points to email.
  const socialUnavailable = (name: string) =>
    Alert.alert(`${name} sign-in isn't available yet`, "Please continue with your email address instead.");
  const [email, setEmail] = useState("");
  const [touched, setTouched] = useState(false);
  const [serverError, setServerError] = useState<string | undefined>();
  const [busy, setBusy] = useState(false);

  const error = serverError ?? (touched ? validateEmail(email) : undefined);
  const canContinue = !validateEmail(email);

  const submit = async () => {
    setTouched(true);
    setServerError(undefined);
    if (!canContinue || busy) return;
    setBusy(true);
    try {
      // Tells the member early whether this address has an account, instead of
      // failing only after they have typed a password.
      const { available } = await endpoints.auth.checkEmail(email.trim());
      if (available) {
        setServerError("We couldn't find an account with that email");
        return;
      }
      navigation.navigate("Password", { email: email.trim() });
    } catch (e) {
      // A lookup failure must not block sign-in; continue to the password step.
      if (e instanceof ApiError && e.isOffline) setServerError(e.message);
      else navigation.navigate("Password", { email: email.trim() });
    } finally {
      setBusy(false);
    }
  };
  void adopt;

  return (
    <ScreenContainer scroll backgroundColor={colors.surface}>
      <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={{ flex: 1 }}>
        <View style={styles.body}>
          <LogoMark size={52} style={styles.logo} />
          <Text style={styles.title}>Hi there!</Text>
          <Text style={styles.subtitle}>Sign in to your account</Text>

          <View style={styles.socials}>
            <SocialButton provider="google" mode="in" onPress={() => socialUnavailable("Google")} />
            <SocialButton provider="amazon" mode="in" onPress={() => socialUnavailable("Amazon")} />
            <SocialButton provider="apple" mode="in" onPress={() => socialUnavailable("Apple")} />
          </View>

          <View style={styles.dividerRow}>
            <View style={styles.divider} />
            <Text style={styles.dividerText}>OR SIGN IN WITH EMAIL</Text>
            <View style={styles.divider} />
          </View>

          <Text style={styles.fieldLabel}>Email /Username</Text>
          <TextInput
            style={[styles.input, !!error && styles.inputError]}
            placeholder="Enter email address"
            placeholderTextColor={colors.tertiaryText}
            value={email}
            onChangeText={(t) => { setEmail(t); if (serverError) setServerError(undefined); }}
            onBlur={() => setTouched(true)}
            autoCapitalize="none"
            autoCorrect={false}
            autoComplete="email"
            textContentType="emailAddress"
            keyboardType="email-address"
            returnKeyType="go"
            onSubmitEditing={submit}
            selectionColor={colors.primary}
            accessibilityLabel="Email or username"
          />
          {error ? (
            <Text style={styles.errorText} accessibilityLiveRegion="polite">
              {error}
            </Text>
          ) : null}
          <Button
            label="Continue"
            variant="pill"
            disabled={email.trim().length === 0}
            loading={busy}
            onPress={submit}
            style={{ marginTop: 20 }}
          />

          <TouchableOpacity
          style={styles.footer}
          onPress={() => navigation.navigate("SignUpEmail")}
          accessibilityRole="link"
          accessibilityLabel="Don't have an account? Sign up"
        >
            <Text style={styles.footerText}>Dont have an account? Sign up</Text>
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  body: { flex: 1, paddingHorizontal: spacing.xl, paddingTop: 64 },
  logo: { alignSelf: "flex-start" },
  title: { fontSize: 26, fontWeight: "700", color: colors.text, marginTop: 18 },
  subtitle: { fontSize: 24, fontWeight: "400", color: colors.text, marginTop: 2, marginBottom: 28 },
  socials: { marginBottom: 8 },
  dividerRow: { flexDirection: "row", alignItems: "center", marginVertical: 18 },
  divider: { flex: 1, height: 1, backgroundColor: "#9CA3AF" },
  dividerText: { fontSize: 11, color: colors.secondaryText, marginHorizontal: 10, letterSpacing: 0.4 },
  fieldLabel: { fontSize: 14, fontWeight: "500", color: colors.text, marginBottom: 8 },
  input: {
    borderWidth: 1,
    borderColor: colors.text,
    borderRadius: radii.pill,
    backgroundColor: colors.surface,
    height: 48,
    paddingHorizontal: 20,
    fontSize: 14.5,
    color: colors.text,
    minWidth: 0,
  },
  inputError: { borderColor: colors.error },
  errorText: { fontSize: 12, color: colors.error, marginTop: 8 },
  footer: { alignItems: "center", marginTop: 24, paddingBottom: 24 },
  footerText: {
    fontSize: 13.5,
    fontWeight: "600",
    color: colors.text,
    textDecorationLine: "underline",
  },
});
