import React, { useEffect, useState } from "react";
import { View, Text, StyleSheet, ScrollView, TouchableOpacity } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import Svg, { Circle } from "react-native-svg";
import ScreenContainer from "../../components/ScreenContainer";
import AppHeader from "../../components/AppHeader";
import LogoMark from "../../components/LogoMark";
import Button from "../../components/Button";
import BottomSheet from "../../components/BottomSheet";
import { colors, radii, shadows, spacing } from "../../theme";
import { mealReport } from "../../data/mock";
import { RootScreenProps } from "../../navigation/types";

const SIZE = 210;
const STROKE = 26;
const R = (SIZE - STROKE) / 2;
const CIRC = 2 * Math.PI * R;

export default function MealReportScreen({ navigation }: RootScreenProps<"MealReport">) {
  const [showUpsell, setShowUpsell] = useState(false);

  useEffect(() => {
    const t = setTimeout(() => setShowUpsell(true), 1800);
    return () => clearTimeout(t);
  }, []);

  // Normalize segment percentages into donut arc shares
  const total = mealReport.segments.reduce((sum, s) => sum + s.pct, 0);
  let acc = 0;
  const arcs = mealReport.segments.map((s) => {
    const share = s.pct / total;
    const arc = { ...s, start: acc, share };
    acc += share;
    return arc;
  });

  return (
    <ScreenContainer>
      <AppHeader title="Meal Analysis Report" right={<LogoMark size={26} />} />
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.content}>
        <View style={styles.chartWrap}>
          <Svg width={SIZE} height={SIZE}>
            {arcs.map((a) => (
              <Circle
                key={a.label}
                cx={SIZE / 2}
                cy={SIZE / 2}
                r={R}
                stroke={a.color}
                strokeWidth={STROKE}
                fill="none"
                strokeDasharray={`${a.share * CIRC - 3} ${CIRC - (a.share * CIRC - 3)}`}
                strokeDashoffset={-a.start * CIRC + CIRC / 4}
              />
            ))}
          </Svg>
          <View style={styles.chartCenter}>
            <Text style={styles.calories}>{mealReport.calories}</Text>
            <Text style={styles.caloriesLabel}>Estimated Calories</Text>
            <Text style={styles.delta}>{mealReport.deltaLabel}</Text>
          </View>
        </View>

        <View style={styles.legendRow}>
          {mealReport.segments.map((s, i) => (
            <View key={s.label} style={[styles.legendItem, i > 0 && styles.legendDivider]}>
              <Text style={[styles.legendPct, { color: s.color }]}>{s.pct}%</Text>
              <Text style={[styles.legendLabel, { color: s.color }]}>{s.label}</Text>
            </View>
          ))}
        </View>

        <View style={styles.detailCard}>
          <Text style={styles.detailTitle}>Detailed Analysis</Text>
          {mealReport.detailRows.map((row) => (
            <TouchableOpacity key={row.id} style={styles.detailRow} activeOpacity={0.7}>
              <View style={[styles.detailIcon, row.id === "warning" && { backgroundColor: colors.errorBg }]}>
                <Text style={{ fontSize: 15 }}>{row.emoji}</Text>
              </View>
              <Text style={[styles.detailLabel, row.id === "warning" && { color: colors.error }]}>
                {row.label}
              </Text>
              <Ionicons name="chevron-forward" size={16} color={colors.tertiaryText} />
            </TouchableOpacity>
          ))}
        </View>

        <Button
          label="Rescan"
          variant="outlinePill"
          icon={<Ionicons name="refresh" size={15} color={colors.primary} />}
          onPress={() => navigation.replace("MealCamera")}
          style={{ marginTop: 24 }}
        />
      </ScrollView>

      <BottomSheet visible={showUpsell} onClose={() => setShowUpsell(false)} maxHeightRatio={0.45}>
        <Text style={styles.upsellTitle}>Access all features</Text>
        <Text style={styles.upsellBody}>
          Get unlimited access to the meal analysis & International specialist from $10/month —
          cancel anytime.
        </Text>
        <Button
          label="Upgrade"
          onPress={() => {
            setShowUpsell(false);
            navigation.navigate("Upgrade");
          }}
          style={{ marginTop: 22, marginHorizontal: 24, borderRadius: 24 }}
        />
        <TouchableOpacity style={styles.cancelLink} onPress={() => setShowUpsell(false)}>
          <Text style={styles.cancelText}>Cancel</Text>
        </TouchableOpacity>
      </BottomSheet>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  content: { paddingHorizontal: spacing.lg, paddingTop: 16, paddingBottom: 32 },
  chartWrap: { alignSelf: "center", alignItems: "center", justifyContent: "center" },
  chartCenter: { position: "absolute", alignItems: "center" },
  calories: { fontSize: 36, fontWeight: "700", color: colors.text },
  caloriesLabel: { fontSize: 12, color: colors.secondaryText, marginTop: 2 },
  delta: { fontSize: 11, fontWeight: "600", color: colors.error, marginTop: 5 },
  legendRow: { flexDirection: "row", marginTop: 26 },
  legendItem: { flex: 1, alignItems: "center" },
  legendDivider: { borderLeftWidth: 1, borderLeftColor: colors.border },
  legendPct: { fontSize: 16, fontWeight: "700" },
  legendLabel: { fontSize: 11.5, fontWeight: "500", marginTop: 3 },
  detailCard: {
    backgroundColor: "#fff",
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: colors.borderLight,
    padding: 16,
    marginTop: 26,
    ...shadows.card,
  },
  detailTitle: { fontSize: 15.5, fontWeight: "700", color: colors.text, marginBottom: 6 },
  detailRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 11,
    borderBottomWidth: 1,
    borderBottomColor: colors.borderLight,
  },
  detailIcon: {
    width: 34,
    height: 34,
    borderRadius: 8,
    backgroundColor: colors.surfaceAlt,
    alignItems: "center",
    justifyContent: "center",
  },
  detailLabel: { flex: 1, fontSize: 13.5, fontWeight: "500", color: colors.text, marginLeft: 12 },
  upsellTitle: { fontSize: 21, fontWeight: "700", color: colors.text, textAlign: "center", marginTop: 8 },
  upsellBody: {
    fontSize: 13.5,
    color: colors.secondaryText,
    textAlign: "center",
    lineHeight: 20,
    marginTop: 10,
    paddingHorizontal: 8,
  },
  cancelLink: { alignItems: "center", marginTop: 18, marginBottom: 6 },
  cancelText: { fontSize: 13.5, fontWeight: "600", color: colors.text, textDecorationLine: "underline" },
});
