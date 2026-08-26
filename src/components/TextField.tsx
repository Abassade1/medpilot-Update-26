import React, { forwardRef, useState } from "react";
import {
  View,
  Text,
  TextInput,
  StyleSheet,
  TouchableOpacity,
  TextInputProps,
  StyleProp,
  ViewStyle,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { colors, radii, spacing } from "../theme";

interface Props extends TextInputProps {
  label?: string;
  optional?: boolean;
  error?: string;
  secure?: boolean;
  containerStyle?: StyleProp<ViewStyle>;
  left?: React.ReactNode;
  right?: React.ReactNode;
}

/**
 * Labelled text input with focus, error and secure-entry states.
 * Forwards a ref to the underlying TextInput so forms can chain focus
 * from one field to the next via the keyboard's Next key.
 */
const TextField = forwardRef<TextInput, Props>(function TextField(
  { label, optional, error, secure, containerStyle, left, right, onFocus, onBlur, ...inputProps },
  ref
) {
  const [hidden, setHidden] = useState(!!secure);
  const [focused, setFocused] = useState(false);

  return (
    <View style={[styles.container, containerStyle]}>
      {label ? (
        <Text style={styles.label}>
          {label}
          {optional ? <Text style={styles.optional}> (Optional)</Text> : null}
        </Text>
      ) : null}
      <View
        style={[
          styles.inputRow,
          focused && styles.inputRowFocused,
          !!error && styles.inputRowError,
        ]}
      >
        {left}
        <TextInput
          ref={ref}
          style={styles.input}
          placeholderTextColor={colors.tertiaryText}
          secureTextEntry={hidden}
          selectionColor={colors.primary}
          accessibilityLabel={label ?? inputProps.placeholder}
          accessibilityHint={error}
          onFocus={(e) => {
            setFocused(true);
            onFocus?.(e);
          }}
          onBlur={(e) => {
            setFocused(false);
            onBlur?.(e);
          }}
          {...inputProps}
        />
        {secure ? (
          <TouchableOpacity
            onPress={() => setHidden((h) => !h)}
            hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
            accessibilityRole="button"
            accessibilityLabel={hidden ? "Show password" : "Hide password"}
          >
            <Ionicons
              name={hidden ? "eye-off-outline" : "eye-outline"}
              size={18}
              color={colors.tertiaryText}
            />
          </TouchableOpacity>
        ) : (
          right
        )}
      </View>
      {error ? (
        <View style={styles.errorRow} accessibilityLiveRegion="polite">
          <Ionicons name="alert-circle" size={13} color={colors.error} />
          <Text style={styles.errorText}>{error}</Text>
        </View>
      ) : null}
    </View>
  );
});

export default TextField;

const styles = StyleSheet.create({
  container: { marginBottom: spacing.md },
  label: { fontSize: 13, fontWeight: "500", color: colors.text, marginBottom: 6 },
  optional: { color: colors.tertiaryText, fontWeight: "400" },
  inputRow: {
    flexDirection: "row",
    alignItems: "center",
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radii.sm,
    paddingHorizontal: 12,
    height: 44,
    backgroundColor: colors.background,
  },
  inputRowFocused: { borderColor: colors.primary },
  inputRowError: { borderColor: colors.error },
  input: { flex: 1, minWidth: 0, fontSize: 14, color: colors.text, paddingVertical: 0 },
  errorRow: { flexDirection: "row", alignItems: "center", marginTop: 6 },
  errorText: { fontSize: 12, color: colors.error, marginLeft: 4, flex: 1 },
});
