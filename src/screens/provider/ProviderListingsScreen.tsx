import React, { useState } from "react";
import { Alert, FlatList, RefreshControl, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import ScreenContainer from "../../components/ScreenContainer";
import AppHeader from "../../components/AppHeader";
import Button from "../../components/Button";
import StatusPill from "../../components/StatusPill";
import ListStateView from "../../components/ListStateView";
import { useListingAction, useProviderListings } from "../../api/queries";
import { ApiError } from "../../api/errors";
import type { ListingDto } from "../../api/types";
import { colors, radii, spacing } from "../../theme";
import { RootScreenProps } from "../../navigation/types";
import { useT } from "../../i18n";

const STATUSES = [["", "All"], ["draft", "Draft"], ["review", "In review"], ["published", "Published"], ["unpublished", "Unpublished"], ["archived", "Archived"]] as const;

export default function ProviderListingsScreen({ navigation, route }: RootScreenProps<"ProviderListings">) {
  const tr = useT();
  const [kind, setKind] = useState<"service" | "package">(route.params?.kind ?? "service");
  const [status, setStatus] = useState("");
  const q = useProviderListings(kind, status || undefined);
  const act = useListingAction();
  const [error, setError] = useState<string | null>(null);

  const run = (l: ListingDto, action: "publish" | "unpublish" | "archive" | "duplicate" | "delete") => {
    if (act.isPending) return;
    setError(null);
    act.mutate({ id: l.id, action }, {
      onError: (e) => { const x = e as ApiError; setError(x.fields ? Object.values(x.fields).join(" ") : x.message || tr("That didn't work.")); },
    });
  };
  const confirm = (l: ListingDto, action: "unpublish" | "archive" | "delete") =>
    Alert.alert(
      action === "delete" ? tr("Delete this draft?") : action === "archive" ? tr("Archive this listing?") : tr("Unpublish this listing?"),
      action === "unpublish" ? tr("Members will no longer be able to find or book it.") : action === "archive" ? tr("It is hidden from members. Existing bookings are unaffected.") : tr("This can't be undone."),
      [{ text: tr("Keep it"), style: "cancel" }, { text: action === "delete" ? tr("Delete") : action === "archive" ? tr("Archive") : tr("Unpublish"), style: "destructive", onPress: () => run(l, action) }],
    );

  const actions = (l: ListingDto): [string, () => void][] => {
    const a: [string, () => void][] = [];
    const live = l.status === "published" || l.status === "review";
    a.push(["View", () => navigation.navigate("ListingDetail", { listingId: l.id, preview: true })]);
    if (!live) a.push(["Edit", () => navigation.navigate("ListingForm", { listingId: l.id })]);
    a.push(["Availability", () => navigation.navigate("ListingAvailability", { listingId: l.id })]);
    if (l.status === "draft" || l.status === "unpublished") a.push(["Publish", () => run(l, "publish")]);
    if (live) a.push(["Unpublish", () => confirm(l, "unpublish")]);
    a.push(["Duplicate", () => run(l, "duplicate")]);
    if (l.status !== "archived") a.push(["Archive", () => confirm(l, "archive")]);
    if (!live) a.push(["Delete", () => confirm(l, "delete")]);
    return a;
  };

  return (
    <ScreenContainer>
      <AppHeader title={kind === "service" ? tr("Services") : tr("Packages")} />
      <View style={styles.tabs}>
        {(["service", "package"] as const).map((k) => (
          <TouchableOpacity key={k} style={[styles.tab, kind === k && styles.tabOn]} onPress={() => setKind(k)} accessibilityRole="tab" accessibilityState={{ selected: kind === k }}>
            <Text style={[styles.tabText, kind === k && styles.tabTextOn]}>{k === "service" ? tr("Services") : tr("Packages")}</Text>
          </TouchableOpacity>
        ))}
      </View>
      <View style={styles.chips}>
        {STATUSES.map(([v, label]) => (
          <TouchableOpacity key={v} style={[styles.chip, status === v && styles.chipOn]} onPress={() => setStatus(v)} accessibilityRole="button" accessibilityState={{ selected: status === v }}>
            <Text style={[styles.chipText, status === v && styles.chipTextOn]}>{tr(label)}</Text>
          </TouchableOpacity>
        ))}
      </View>
      {error ? <Text style={styles.err} accessibilityLiveRegion="polite">{error}</Text> : null}
      {q.isLoading ? <ListStateView kind="loading" message={tr("Loading…")} /> : q.isError ? (
        <ListStateView kind="error" message={tr("We couldn't load your listings.")} onRetry={() => void q.refetch()} />
      ) : (
        <FlatList
          data={q.data}
          keyExtractor={(l) => l.id}
          contentContainerStyle={{ paddingHorizontal: spacing.lg, paddingBottom: 90, flexGrow: 1 }}
          refreshControl={<RefreshControl refreshing={q.isRefetching} onRefresh={() => void q.refetch()} />}
          ListEmptyComponent={<ListStateView kind="empty" title={tr("No {kind}s here yet", { kind: tr(kind) })} message={tr("Create one and publish it so members can find and book it.")} actionLabel={tr("Create a {kind}", { kind: tr(kind) })} onAction={() => navigation.navigate("ListingForm", { kind })} />}
          renderItem={({ item: l }) => (
            <View style={styles.card}>
              <View style={styles.top}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.name}>{l.name}</Text>
                  <Text style={styles.meta}>{l.categoryLabel || tr("No category")} · {l.priceLabel}</Text>
                  <Text style={styles.meta}>{l.bookable ? tr("Bookable") : tr("No availability set")} · {tr("{n} bookings", { n: l.bookingCount })}</Text>
                </View>
                <StatusPill status={l.status} />
              </View>
              {l.rejectionNote ? <Text style={styles.err}>{l.rejectionNote}</Text> : null}
              <View style={styles.acts}>
                {actions(l).map(([label, go]) => (
                  <TouchableOpacity key={label} onPress={go} style={styles.act} disabled={act.isPending} accessibilityRole="button" accessibilityLabel={`${tr(label)} ${l.name}`}>
                    <Text style={[styles.actText, label === "Delete" && { color: colors.error }]}>{label}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>
          )}
        />
      )}
      <View style={styles.fab}>
        <Button label={tr("New {kind}", { kind: tr(kind) })} variant="pill" onPress={() => navigation.navigate("ListingForm", { kind })} />
      </View>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  tabs: { flexDirection: "row", marginHorizontal: spacing.lg, backgroundColor: colors.surfaceAlt, borderRadius: radii.md, padding: 3, marginBottom: 10 },
  tab: { flex: 1, alignItems: "center", paddingVertical: 9, borderRadius: radii.sm },
  tabOn: { backgroundColor: "#fff" },
  tabText: { fontSize: 13.5, color: colors.secondaryText },
  tabTextOn: { color: colors.text, fontWeight: "600" },
  chips: { flexDirection: "row", flexWrap: "wrap", paddingHorizontal: spacing.lg, marginBottom: 8 },
  chip: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 16, backgroundColor: colors.surfaceAlt, marginRight: 6, marginBottom: 6 },
  chipOn: { backgroundColor: colors.primary },
  chipText: { fontSize: 12.5, color: colors.secondaryText },
  chipTextOn: { color: "#fff", fontWeight: "600" },
  card: { borderWidth: 1, borderColor: colors.border, borderRadius: radii.md, padding: 14, marginBottom: 10 },
  top: { flexDirection: "row", alignItems: "flex-start" },
  name: { fontSize: 15.5, fontWeight: "600", color: colors.text },
  meta: { fontSize: 12.5, color: colors.secondaryText, marginTop: 3 },
  acts: { flexDirection: "row", flexWrap: "wrap", marginTop: 10 },
  act: { paddingVertical: 6, paddingRight: 16 },
  actText: { fontSize: 13.5, fontWeight: "600", color: colors.primary },
  err: { fontSize: 12.5, color: colors.error, marginHorizontal: spacing.lg, marginBottom: 6 },
  fab: { position: "absolute", left: spacing.lg, right: spacing.lg, bottom: 20 },
});
