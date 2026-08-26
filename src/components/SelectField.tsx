import React, { useState } from "react";
import { View, Text, StyleSheet, TouchableOpacity, Modal, Pressable, StyleProp, ViewStyle } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { colors, radii, spacing, shadows } from "../theme";

interface Props {
  label?: string;
  optional?: boolean;
  placeholder?: string;
  value?: string | null;
  options: string[];
  onSelect: (value: string) => void;
  containerStyle?: StyleProp<ViewStyle>;
}

export default function SelectField({
  label,
  optional,
  placeholder = "Select",
  value,
  options,
  onSelect,
  containerStyle,
}: Props) {
  const [open, setOpen] = useState(false);

  return (
    <View style={[styles.container, containerStyle]}>
      {label ? (
        <Text style={styles.label}>
          {label}
          {optional ? <Text style={styles.optional}> (Optional)</Text> : null}
        </Text>
      ) : null}
      <TouchableOpacity
        style={styles.field}
        activeOpacity={0.7}
        onPress={() => setOpen(true)}
        accessibilityRole="button"
        accessibilityLabel={label ?? placeholder}
        accessibilityValue={{ text: value ?? "Not selected" }}
        accessibilityHint="Opens a list of options"
        accessibilityState={{ expanded: open }}
      >
        <Text style={[styles.value, !value && { color: colors.tertiaryText }]}>{value || placeholder}</Text>
        <Ionicons name="chevron-down" size={16} color={colors.secondaryText} />
      </TouchableOpacity>

      <Modal visible={open} transparent animationType="fade" onRequestClose={() => setOpen(false)}>
        <Pressable style={styles.backdrop} onPress={() => setOpen(false)}>
          <View style={styles.menu}>
            {options.map((opt) => (
              <TouchableOpacity
                key={opt}
                style={styles.option}
                accessibilityRole="menuitem"
                accessibilityLabel={opt}
                accessibilityState={{ selected: opt === value }}
                onPress={() => {
                  onSelect(opt);
                  setOpen(false);
                }}
              >
                <Text style={[styles.optionText, opt === value && { color: colors.primary, fontWeight: "600" }]}>
                  {opt}
                </Text>
                {opt === value && <Ionicons name="checkmark" size={16} color={colors.primary} />}
              </TouchableOpacity>
            ))}
          </View>
        </Pressable>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { marginBottom: spacing.md },
  label: { fontSize: 13, fontWeight: "500", color: colors.text, marginBottom: 6 },
  optional: { color: colors.tertiaryText, fontWeight: "400" },
  field: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radii.sm,
    paddingHorizontal: 12,
    height: 44,
    backgroundColor: colors.background,
  },
  value: { fontSize: 14, color: colors.text },
  backdrop: {
    flex: 1,
    backgroundColor: colors.overlay,
    justifyContent: "center",
    paddingHorizontal: 32,
  },
  menu: {
    backgroundColor: "#fff",
    borderRadius: radii.md,
    paddingVertical: 6,
    ...shadows.card,
  },
  option: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 18,
    paddingVertical: 13,
  },
  optionText: { fontSize: 15, color: colors.text },
});
