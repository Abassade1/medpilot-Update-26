import React, { useState } from "react";
import { View, Text, StyleSheet, TouchableOpacity } from "react-native";
import ScreenContainer from "../../components/ScreenContainer";
import AppHeader from "../../components/AppHeader";
import TextField from "../../components/TextField";
import Button from "../../components/Button";
import { colors, spacing } from "../../theme";
import { validateEmail } from "../../utils/validation";
import { RootScreenProps } from "../../navigation/types";

export default function SignUpEmailScreen({ navigation }: RootScreenProps<"SignUpEmail">) {
  const [email, setEmail] = useState("");
  const [touched, setTouched] = useState(false);

  const error = touched ? validateEmail(email) : undefined;
  const valid = !validateEmail(email);

  const submit = () => {
    setTouched(true);
    if (valid) navigation.navigate("AboutYou", { email: email.trim() });
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
          onChangeText={setEmail}
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
