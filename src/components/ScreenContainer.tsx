import React from "react";
import { View, ScrollView, StyleSheet, ViewStyle, StatusBar } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { colors } from "../theme";

interface Props {
  children: React.ReactNode;
  scroll?: boolean;
  style?: ViewStyle;
  contentStyle?: ViewStyle;
  backgroundColor?: string;
  edgesTop?: boolean;
  edgesBottom?: boolean;
  barStyle?: "dark-content" | "light-content";
}

export default function ScreenContainer({
  children,
  scroll = false,
  style,
  contentStyle,
  backgroundColor = colors.background,
  edgesTop = true,
  edgesBottom = false,
  barStyle = "dark-content",
}: Props) {
  const insets = useSafeAreaInsets();
  const padding = {
    paddingTop: edgesTop ? insets.top : 0,
    paddingBottom: edgesBottom ? Math.max(insets.bottom, 12) : 0,
  };

  return (
    <View style={[styles.root, { backgroundColor }, padding, style]}>
      <StatusBar barStyle={barStyle} />
      {scroll ? (
        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={[styles.scrollContent, contentStyle]}
          keyboardShouldPersistTaps="handled"
        >
          {children}
        </ScrollView>
      ) : (
        children
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  scrollContent: { flexGrow: 1, paddingBottom: 32 },
});
