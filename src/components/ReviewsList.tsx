import React from "react";
import { ActivityIndicator, StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useReviews } from "../api/queries";
import type { ReviewTargetType } from "../api/types";
import { formatDate } from "../utils/dates";
import { colors, radii } from "../theme";
import { useT } from "../i18n";

function Stars({ value, size = 13 }: { value: number; size?: number }) {
  const tr = useT();
  return (
    <View style={styles.stars} accessibilityLabel={tr("{n} out of 5 stars", { n: value })}>
      {[1, 2, 3, 4, 5].map((n) => (
        <Ionicons key={n} name={n <= value ? "star" : "star-outline"} size={size} color={colors.warning} />
      ))}
    </View>
  );
}

/** Rating summary and the newest member reviews for a hospital, clinic, provider or specialist. */
export default function ReviewsList({ targetType, targetId }: { targetType: ReviewTargetType; targetId: string }) {
  const tr = useT();
  const query = useReviews(targetType, targetId);

  if (query.isLoading) return <ActivityIndicator color={colors.primary} style={{ marginVertical: 12 }} />;
  // Reviews are supplementary; a failed load shouldn't take over a booking screen.
  if (query.isError || !query.data) return <Text style={styles.muted}>{tr("Reviews aren't available right now.")}</Text>;

  const { total, average, items } = query.data;
  if (total === 0) return <Text style={styles.muted}>{tr("No reviews yet. Members can rate a visit once it's complete.")}</Text>;

  return (
    <View>
      <View style={styles.summary}>
        <Text style={styles.average}>{average?.toFixed(1)}</Text>
        <View style={{ marginLeft: 10 }}>
          <Stars value={Math.round(average ?? 0)} size={15} />
          <Text style={styles.count}>{total === 1 ? tr("1 review") : tr("{n} reviews", { n: total })}</Text>
        </View>
      </View>
      {items.map((r) => (
        <View key={r.id} style={styles.item}>
          <View style={styles.itemHead}>
            <Stars value={r.rating} />
            <Text style={styles.meta}>{r.reviewer} · {formatDate(r.createdAt)}</Text>
          </View>
          {r.comment ? <Text style={styles.comment}>{r.comment}</Text> : null}
        </View>
      ))}
      {total > items.length ? <Text style={styles.muted}>{tr("Showing the {shown} most recent of {total} reviews.", { shown: items.length, total })}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  stars: { flexDirection: "row" },
  summary: { flexDirection: "row", alignItems: "center", marginBottom: 10 },
  average: { fontSize: 28, fontWeight: "700", color: colors.text },
  count: { fontSize: 12.5, color: colors.secondaryText, marginTop: 2 },
  item: { backgroundColor: "#fff", borderRadius: radii.md, borderWidth: 1, borderColor: colors.borderLight, padding: 12, marginBottom: 8 },
  itemHead: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  meta: { fontSize: 12, color: colors.secondaryText },
  comment: { fontSize: 13.5, color: colors.text, lineHeight: 19, marginTop: 6 },
  muted: { fontSize: 13, color: colors.secondaryText, paddingVertical: 6 },
});
