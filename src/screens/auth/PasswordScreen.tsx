import React, { useState } from "react";
import { View, Text, StyleSheet, TouchableOpacity } from "react-native";
import ScreenContainer from "../../components/ScreenContainer";
import AppHeader from "../../components/AppHeader";
import TextField from "../../components/TextField";
import Button from "../../components/Button";
import { colors, spacing } from "../../theme";
import { endpoints } from "../../api/endpoints";
import { ApiError } from "../../api/errors";
import { useSession } from "../../state/Session";
import { RootScreenProps } from "../../navigation/types";

export default function PasswordScreen({ navigation, route }: RootScreenProps<"Password">) {
  const { adopt } = useSession();
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | undefined>();
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    if (busy || password.length === 0) return;
    setBusy(true);
    setError(undefined);
    try {
      const res = await endpoints.auth.login(route.params.email, password);
      await adopt(res);
      const incomplete = !res.setup.passwordSet || !res.setup.historyComplete;
      navigation.replace(incomplete ? "SetupChecklist" : "MainTabs");
    } catch (e) {
      if (e instanceof ApiError) {
        // 401 renders in the same inline slot the design specified
        setError(e.code === "unauthenticated" ? "Incorrect password" : e.message);
      } else {
        setError("Something went wrong. Please try again.");
      }
    } finally {
      setBusy(false);
    }
  };

  return (
    <ScreenContainer>
      <AppHeader title="Sign in" />
      <View style={styles.body}>
        <Text style={styles.email}>{route.params.email}</Text>
        <Text style={styles.title}>Enter your password!</Text>
        <TextField
          label="Password"
          placeholder="Password"
          secure
          value={password}
          onChangeText={(t) => {
            setPassword(t);
            if (error) setError(undefined);
          }}
          error={error}
          autoCapitalize="none"
          autoCorrect={false}
          autoComplete="current-password"
          textContentType="password"
          maxLength={64}
          returnKeyType="go"
          onSubmitEditing={submit}
          containerStyle={{ marginTop: 18 }}
        />
        <TouchableOpacity style={styles.forgot} accessibilityRole="link" accessibilityLabel="Forgot your password?">
          <Text style={styles.forgotText}>Forgot your password?</Text>
        </TouchableOpacity>

        <View style={styles.bottom}>
          <Button label="Sign in" variant="pill" disabled={password.length === 0} loading={busy} onPress={submit} />
          <TouchableOpacity style={styles.footer} onPress={() => navigation.navigate("SignUpEmail")}>
            <Text style={styles.footerText}>Dont have an account? Sign up</Text>
          </TouchableOpacity>
        </View>
      </View>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  body: { flex: 1, paddingHorizontal: spacing.xl, paddingTop: spacing.md },
  email: { fontSize: 12, color: colors.secondaryText },
  title: { fontSize: 20, fontWeight: "700", color: colors.text, marginTop: 6 },
  forgot: { alignItems: "center", marginTop: 14 },
  forgotText: { fontSize: 13.5, fontWeight: "600", color: colors.text, textDecorationLine: "underline" },
  bottom: { marginTop: "auto", paddingBottom: 28 },
  footer: { alignItems: "center", marginTop: 18 },
  footerText: { fontSize: 13.5, fontWeight: "600", color: colors.text, textDecorationLine: "underline" },
});
