import React, { useCallback, useRef } from "react";
import { Text, StyleSheet, TouchableOpacity, ViewStyle, ActivityIndicator } from "react-native";
import { colors, radii } from "../theme";

type Variant = "primary" | "pill" | "outline" | "outlinePill";

interface Props {
  label: string;
  onPress?: () => void;
  disabled?: boolean;
  variant?: Variant;
  style?: ViewStyle;
  loading?: boolean;
  icon?: React.ReactNode;
  /** "danger" for destructive actions such as cancelling; recolours the outline and label. */
  tone?: "default" | "danger";
}

export default function Button({ label, onPress, disabled, variant = "primary", style, loading, icon, tone = "default" }: Props) {
  const accent = tone === "danger" ? colors.error : colors.primary;
  const isOutline = variant === "outline" || variant === "outlinePill";
  const isPill = variant === "pill" || variant === "outlinePill";
  const lastPress = useRef(0);

  /** Swallows repeat presses within 600ms so an action can't fire twice. */
  const handlePress = useCallback(() => {
    const now = Date.now();
    if (now - lastPress.current < 600) return;
    lastPress.current = now;
    onPress?.();
  }, [onPress]);

  return (
    <TouchableOpacity
      activeOpacity={0.8}
      disabled={disabled || loading}
      onPress={handlePress}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled: !!disabled || !!loading, busy: !!loading }}
      style={[
        styles.base,
        isPill ? styles.pill : styles.block,
        isOutline
          ? [styles.outline, { borderColor: accent }]
          : { backgroundColor: disabled ? colors.disabled : accent },
        style,
      ]}
    >
      {loading ? (
        <ActivityIndicator color={isOutline ? accent : "#fff"} />
      ) : (
        <>
          {icon}
          <Text
            style={[
              styles.label,
              isOutline
                ? { color: accent }
                : { color: disabled ? "#F3F4F6" : "#FFFFFF" },
              icon ? { marginLeft: 6 } : null,
            ]}
          >
            {label}
          </Text>
        </>
      )}
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  base: {
    height: 46,
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
  },
  block: {
    borderRadius: radii.sm,
    alignSelf: "stretch",
    paddingHorizontal: 20,
  },
  pill: {
    borderRadius: radii.pill,
    alignSelf: "center",
    minWidth: 168,
    paddingHorizontal: 28,
  },
  outline: {
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: colors.primary,
  },
  label: {
    fontSize: 15,
    fontWeight: "600",
  },
});
