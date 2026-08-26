import React, { useState } from "react";
import { View, TextInput, StyleSheet, TouchableOpacity } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import MicButton from "./MicButton";
import { colors, radii, spacing } from "../theme";

interface Props {
  placeholder?: string;
  onSend?: (text: string) => void;
  /** Matches the AUX screen (grey field) vs the diagnosis screen (white field). */
  tone?: "filled" | "outline";
}

/** Shared composer used by the AUX assistant and the diagnosis result screen. */
export default function AssistantInputBar({
  placeholder = "What's in your mind?...",
  onSend,
  tone = "filled",
}: Props) {
  const [text, setText] = useState("");
  const canSend = text.trim().length > 0;

  const send = () => {
    if (!canSend) return; // empty submissions are ignored
    onSend?.(text.trim());
    setText("");
  };

  return (
    <View style={styles.bar}>
      <View style={[styles.wrap, tone === "outline" && styles.wrapOutline]}>
        <TextInput
          style={styles.input}
          placeholder={placeholder}
          placeholderTextColor={colors.tertiaryText}
          value={text}
          onChangeText={setText}
          onSubmitEditing={send}
          returnKeyType="send"
          maxLength={500}
          autoCapitalize="sentences"
          accessibilityLabel="Message the assistant"
        />
        <MicButton size={18} />
      </View>
      <TouchableOpacity
        style={[styles.sendBtn, !canSend && styles.sendBtnOff]}
        activeOpacity={0.8}
        onPress={send}
        disabled={!canSend}
        accessibilityRole="button"
        accessibilityLabel="Send message"
        accessibilityState={{ disabled: !canSend }}
      >
        <Ionicons name="send" size={16} color="#fff" />
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  bar: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: spacing.lg,
    paddingBottom: 12,
    paddingTop: 4,
  },
  wrap: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radii.pill,
    paddingHorizontal: 14,
    height: 42,
    backgroundColor: colors.surfaceAlt,
  },
  wrapOutline: { backgroundColor: "#fff" },
  input: { flex: 1, minWidth: 0, fontSize: 13.5, color: colors.text, paddingVertical: 0, marginRight: 8 },
  sendBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.primary,
    alignItems: "center",
    justifyContent: "center",
    marginLeft: 10,
  },
  sendBtnOff: { backgroundColor: colors.disabled },
});
