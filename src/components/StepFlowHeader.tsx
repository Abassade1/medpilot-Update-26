import React from "react";
import { View, Text, StyleSheet } from "react-native";
import AppHeader from "./AppHeader";
import { colors, spacing } from "../theme";

interface Props {
  headerTitle: string;
  step: number;
  totalSteps: number;
  title: string;
  subtitle?: string;
}

/** "‹ Back  Book Appointment" header + "1 of 3" + big step title (Figma booking flows). */
export default function StepFlowHeader({ headerTitle, step, totalSteps, title, subtitle }: Props) {
  return (
    <View>
      <AppHeader title={headerTitle} />
      <View style={styles.body}>
        <Text style={styles.step}>
          <Text style={styles.stepCurrent}>{step}</Text> of {totalSteps}
        </Text>
        <Text style={styles.title}>{title}</Text>
        {subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  body: { paddingHorizontal: spacing.lg, paddingTop: spacing.sm, paddingBottom: spacing.xs },
  step: { fontSize: 12, color: colors.secondaryText, marginBottom: 6 },
  stepCurrent: { color: colors.primary, fontWeight: "700" },
  title: { fontSize: 21, fontWeight: "700", color: colors.text },
  subtitle: { fontSize: 13, color: colors.secondaryText, marginTop: 6, lineHeight: 18 },
});
