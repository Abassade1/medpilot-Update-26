import React, { useState } from "react";
import { View, Text, StyleSheet, TouchableOpacity } from "react-native";
import ScreenContainer from "../../components/ScreenContainer";
import AppHeader from "../../components/AppHeader";
import TextField from "../../components/TextField";
import Button from "../../components/Button";
import { colors, spacing } from "../../theme";
import { RootScreenProps } from "../../navigation/types";

export default function PasswordScreen({ navigation, route }: RootScreenProps<"Password">) {
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | undefined>();

  const submit = () => {
    // Frontend-only: any password of 8+ chars signs in; shorter shows the
    // Figma "Incorrect password" error state.
    if (password.length < 8) {
      setError("Incorrect password");
      return;
    }
    navigation.replace("MainTabs");
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
          <Button label="Sign in" variant="pill" disabled={password.length === 0} onPress={submit} />
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
