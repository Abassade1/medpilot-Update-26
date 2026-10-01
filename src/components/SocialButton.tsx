import React from "react";
import { Text, StyleSheet, TouchableOpacity } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { colors, radii } from "../theme";
import { useT } from "../i18n";

interface Props {
  provider: "google" | "amazon" | "apple";
  mode: "in" | "up";
  onPress?: () => void;
}

const config = {
  google: { icon: "logo-google" as const, color: "#4285F4", label: "Google" },
  amazon: { icon: "logo-amazon" as const, color: "#FF9900", label: "Amazon" },
  apple: { icon: "logo-apple" as const, color: "#111111", label: "Apple" },
};

export default function SocialButton({ provider, mode, onPress }: Props) {
  const tr = useT();
  const c = config[provider];
  return (
    <TouchableOpacity style={styles.btn} activeOpacity={0.75} onPress={onPress}>
      <Ionicons name={c.icon} size={17} color={c.color} />
      <Text style={styles.label}>
        {tr(mode === "in" ? "Sign in with {provider}" : "Sign up with {provider}", { provider: c.label })}
      </Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  btn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radii.pill,
    height: 44,
    marginBottom: 12,
    backgroundColor: "#fff",
  },
  label: { fontSize: 13.5, fontWeight: "600", color: colors.text, marginLeft: 8 },
});
