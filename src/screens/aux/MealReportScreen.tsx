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
import ListStateView from "../../components/ListStateView";
import { endpoints } from "../../api/endpoints";
import { useQuery } from "@tanstack/react-query";
import { useSubscription } from "../../api/queries";
import { RootScreenProps } from "../../navigation/types";

/** Emoji are presentation, so they stay client-side rather than in the payload. */
const DETAIL_EMOJI: Record<string, string> = {
  nutrition: "🥗",
  ingredient: "🍚",
  health: "❤️",
  warning: "⚠️",
};

const SIZE = 210;
const STROKE = 26;
const R = (SIZE - STROKE) / 2;
const CIRC = 2 * Math.PI * R;

export default function MealReportScreen({ navigation, route }: RootScreenProps<"MealReport">) {
  const [showUpsell, setShowUpsell] = useState(false);
  const [openDetail, setOpenDetail] = useState<string | null>(null);
  const mealQuery = useQuery({
    queryKey: ["meal", route.params.mealId],
    queryFn: () => endpoints.aux.meal(route.params.mealId),
  });
  const subscription = useSubscription();
  const meal = mealQuery.data;
  const segments = meal?.segments ?? [];
  const detailRows = meal?.details ?? [];
  const onFreePlan = subscription.data?.planCode !== "pro";

  // Only nudge members who would actually gain something from upgrading.
  useEffect(() => {
    if (!meal || !onFreePlan) return;
    const t = setTimeout(() => setShowUpsell(true), 1800);
    return () => clearTimeout(t);
  }, [meal, onFreePlan]);

  // Normalize segment percentages into donut arc shares
  const total = segments.reduce((sum, s) => sum + s.percentage, 0) || 1;
  let acc = 0;
  const arcs = segments.map((s) => {
    const share = s.percentage / total;
    const arc = { ...s, start: acc, share };
    acc += share;
    return arc;
  });

  if (!meal) {
    return (
      <ScreenContainer>
        <AppHeader title="Meal Analysis Report" right={<LogoMark size={26} />} />
        {mealQuery.isError ? (
          <ListStateView kind="error" onRetry={() => void mealQuery.refetch()} />
        ) : (
          <ListStateView kind="loading" message="Loading your report…" />
        )}
      </ScreenContainer>
    );
  }

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
                stroke={a.colorHex}
                strokeWidth={STROKE}
                fill="none"
                strokeDasharray={`${a.share * CIRC - 3} ${CIRC - (a.share * CIRC - 3)}`}
                strokeDashoffset={-a.start * CIRC + CIRC / 4}
              />
            ))}
          </Svg>
          <View style={styles.chartCenter}>
            <Text style={styles.calories}>{meal.caloriesEstimate ?? "—"}</Text>
            <Text style={styles.caloriesLabel}>Estimated Calories</Text>
            <Text style={styles.delta}>
              {meal.baselineDeltaPct == null
                ? ""
                : `${meal.baselineDeltaPct > 0 ? "+" : ""}${meal.baselineDeltaPct}% vs your baseline`}
            </Text>
          </View>
        </View>

        <View style={styles.legendRow}>
          {segments.map((s, i) => (
            <View key={s.label} style={[styles.legendItem, i > 0 && styles.legendDivider]}>
              <Text style={[styles.legendPct, { color: s.colorHex }]}>{s.percentage}%</Text>
              <Text style={[styles.legendLabel, { color: s.colorHex }]}>{s.label}</Text>
            </View>
          ))}
        </View>

        <View style={styles.detailCard}>
          <Text style={styles.detailTitle}>Detailed Analysis</Text>
          {detailRows.map((row) => (
            <TouchableOpacity
              key={row.code}
              style={styles.detailRow}
              activeOpacity={0.7}
              onPress={() => setOpenDetail(openDetail === row.code ? null : row.code)}
            >
              <View
                style={[
                  styles.detailIcon,
                  row.code === "warning" && { backgroundColor: colors.errorBg },
                ]}
              >
                <Text style={{ fontSize: 15 }}>{DETAIL_EMOJI[row.code] ?? "🍽️"}</Text>
              </View>
              <View style={{ flex: 1, marginLeft: 12 }}>
                <Text style={[styles.detailLabel, row.code === "warning" && { color: colors.error }]}>
                  {row.label}
                </Text>
                {openDetail === row.code && row.body ? (
                  <Text style={styles.detailBody}>{row.body}</Text>
                ) : null}
              </View>
              <Ionicons
                name={openDetail === row.code ? "chevron-down" : "chevron-forward"}
                size={16}
                color={colors.tertiaryText}
              />
            </TouchableOpacity>
          ))}
        </View>

        {meal.disclaimer ? <Text style={styles.disclaimer}>{meal.disclaimer}</Text> : null}

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
  detailLabel: { fontSize: 13.5, fontWeight: "500", color: colors.text },
  detailBody: { fontSize: 12, color: colors.secondaryText, lineHeight: 18, marginTop: 4 },
  disclaimer: {
    fontSize: 11,
    color: colors.tertiaryText,
    lineHeight: 16,
    marginTop: 18,
    textAlign: "center",
  },
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
