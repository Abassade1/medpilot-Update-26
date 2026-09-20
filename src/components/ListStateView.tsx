import React from "react";
import { View, Text, StyleSheet, ActivityIndicator } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import Button from "./Button";
import { colors, spacing } from "../theme";

type Kind = "loading" | "empty" | "error";

interface Props {
  kind: Kind;
  title?: string;
  message?: string;
  onRetry?: () => void;
  /** A way forward from an empty state, so it is never a dead end. */
  actionLabel?: string;
  onAction?: () => void;
}

const defaults: Record<Kind, { icon: React.ComponentProps<typeof Ionicons>["name"]; title: string; message: string }> = {
  loading: { icon: "time-outline", title: "Loading…", message: "" },
  empty: { icon: "search-outline", title: "No results", message: "Try a different search term." },
  error: {
    icon: "cloud-offline-outline",
    title: "Something went wrong",
    message: "We couldn't load this list. Please try again.",
  },
};

/** Shared loading / empty / error presentation for list screens. */
export default function ListStateView({ kind, title, message, onRetry, actionLabel, onAction }: Props) {
  const d = defaults[kind];

  if (kind === "loading") {
    return (
      <View style={styles.wrap} accessibilityRole="progressbar" accessibilityLabel="Loading">
        <ActivityIndicator color={colors.primary} />
        <Text style={styles.message}>{message ?? "Loading…"}</Text>
      </View>
    );
  }

  return (
    <View style={styles.wrap} accessibilityLiveRegion="polite">
      <Ionicons name={d.icon} size={40} color={colors.disabled} />
      <Text style={styles.title}>{title ?? d.title}</Text>
      <Text style={styles.message}>{message ?? d.message}</Text>
      {kind === "empty" && actionLabel && onAction && (
        <Button label={actionLabel} variant="pill" onPress={onAction} style={{ marginTop: 18 }} />
      )}
      {kind === "error" && onRetry && (
        <Button label="Try again" variant="outlinePill" onPress={onRetry} style={{ marginTop: 18 }} />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 64,
    paddingHorizontal: spacing.xl,
  },
  title: { fontSize: 16, fontWeight: "700", color: colors.text, marginTop: 14 },
  message: {
    fontSize: 13,
    color: colors.secondaryText,
    textAlign: "center",
    lineHeight: 19,
    marginTop: 6,
  },
});
