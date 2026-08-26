import React from "react";
import { View, TextInput, StyleSheet, ViewStyle } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import MicButton from "./MicButton";
import { colors, radii } from "../theme";

interface Props {
  placeholder?: string;
  value?: string;
  onChangeText?: (t: string) => void;
  style?: ViewStyle;
}

export default function SearchBar({ placeholder = "Search", value, onChangeText, style }: Props) {
  return (
    <View style={[styles.bar, style]}>
      <Ionicons name="search" size={16} color={colors.tertiaryText} />
      <TextInput
        style={styles.input}
        placeholder={placeholder}
        placeholderTextColor={colors.tertiaryText}
        value={value}
        onChangeText={onChangeText}
        returnKeyType="search"
        clearButtonMode="while-editing"
        autoCorrect={false}
        accessibilityLabel={placeholder}
      />
      <MicButton size={17} />
    </View>
  );
}

const styles = StyleSheet.create({
  bar: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: colors.surfaceAlt,
    borderRadius: radii.sm,
    paddingHorizontal: 12,
    height: 40,
  },
  input: { flex: 1, minWidth: 0, fontSize: 14, color: colors.text, marginHorizontal: 8, paddingVertical: 0 },
});
