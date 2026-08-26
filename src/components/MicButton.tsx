import React from "react";
import { TouchableOpacity, StyleSheet, View, ViewStyle } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useVoiceInput } from "../hooks/useVoiceInput";
import { colors } from "../theme";

interface Props {
  size?: number;
  style?: ViewStyle;
  onCaptured?: (uri: string) => void;
}

/** Mic affordance that actually records via the device microphone. */
export default function MicButton({ size = 18, style, onCaptured }: Props) {
  const { recording, busy, toggle } = useVoiceInput(onCaptured);

  return (
    <TouchableOpacity
      onPress={toggle}
      disabled={busy}
      hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
      style={style}
      accessibilityRole="button"
      accessibilityLabel={recording ? "Stop recording" : "Record voice input"}
      accessibilityState={{ selected: recording, disabled: busy }}
    >
      {recording ? (
        <View style={[styles.recording, { width: size + 6, height: size + 6, borderRadius: (size + 6) / 2 }]}>
          <View style={styles.stopSquare} />
        </View>
      ) : (
        <Ionicons name="mic-outline" size={size} color={colors.secondaryText} />
      )}
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  recording: { backgroundColor: colors.error, alignItems: "center", justifyContent: "center" },
  stopSquare: { width: 8, height: 8, borderRadius: 1.5, backgroundColor: "#fff" },
});
