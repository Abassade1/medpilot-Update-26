import React from "react";
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, ViewStyle } from "react-native";
import { colors } from "../theme";

interface Props {
  tabs: string[];
  active: number;
  onChange: (index: number) => void;
  scrollable?: boolean;
  style?: ViewStyle;
}

export default function SegmentTabs({ tabs, active, onChange, scrollable = false, style }: Props) {
  const content = tabs.map((tab, i) => {
    const isActive = i === active;
    return (
      <TouchableOpacity
        key={tab}
        style={styles.tab}
        onPress={() => onChange(i)}
        activeOpacity={0.7}
        accessibilityRole="tab"
        accessibilityLabel={tab}
        accessibilityState={{ selected: isActive }}
      >
        <Text style={[styles.label, isActive && styles.labelActive]} numberOfLines={1}>
          {tab}
        </Text>
        <View style={[styles.underline, isActive && styles.underlineActive]} />
      </TouchableOpacity>
    );
  });

  if (scrollable) {
    return (
      <View style={[styles.wrap, style]}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false}>
          {content}
        </ScrollView>
      </View>
    );
  }
  return <View style={[styles.wrap, styles.row, style]}>{content}</View>;
}

const styles = StyleSheet.create({
  wrap: {
    borderBottomWidth: 1,
    borderBottomColor: colors.borderLight,
  },
  row: { flexDirection: "row", justifyContent: "space-between", paddingHorizontal: 20 },
  tab: { alignItems: "center" },
  label: {
    fontSize: 14,
    fontWeight: "500",
    color: colors.text,
    paddingVertical: 12,
  },
  labelActive: { color: colors.primary, fontWeight: "600" },
  underline: { height: 2.5, alignSelf: "stretch", backgroundColor: "transparent", borderRadius: 2 },
  underlineActive: { backgroundColor: colors.primary },
});
