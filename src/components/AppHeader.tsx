import React from "react";
import { View, Text, StyleSheet, TouchableOpacity } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useNavigation } from "@react-navigation/native";
import { colors, spacing } from "../theme";

interface Props {
  title?: string;
  onBack?: () => void;
  right?: React.ReactNode;
  showBack?: boolean;
  backLabel?: string;
  tint?: string;
}

export default function AppHeader({ title, onBack, right, showBack = true, backLabel = "Back", tint = colors.primary }: Props) {
  const navigation = useNavigation();
  return (
    <View style={styles.container}>
      <View style={styles.side}>
        {showBack && (
          <TouchableOpacity
            style={styles.backBtn}
            onPress={onBack ?? (() => navigation.goBack())}
            hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
            accessibilityRole="button"
            accessibilityLabel={backLabel}
          >
            <Ionicons name="chevron-back" size={22} color={tint} />
            <Text style={[styles.backText, { color: tint }]}>{backLabel}</Text>
          </TouchableOpacity>
        )}
      </View>
      <Text style={styles.title} numberOfLines={1}>
        {title}
      </Text>
      <View style={[styles.side, styles.rightSide]}>{right}</View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: spacing.md,
    height: 48,
  },
  side: { width: 76, flexDirection: "row", alignItems: "center" },
  rightSide: { justifyContent: "flex-end" },
  backBtn: { flexDirection: "row", alignItems: "center" },
  backText: { fontSize: 15, fontWeight: "500", marginLeft: 2 },
  title: {
    flex: 1,
    textAlign: "center",
    fontSize: 16,
    fontWeight: "600",
    color: colors.text,
  },
});
