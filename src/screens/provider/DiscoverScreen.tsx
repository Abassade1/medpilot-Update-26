import React, { useEffect, useState } from "react";
import { FlatList, RefreshControl, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import ScreenContainer from "../../components/ScreenContainer";
import AppHeader from "../../components/AppHeader";
import TextField from "../../components/TextField";
import ListStateView from "../../components/ListStateView";
import { useDiscover, useListingFacets } from "../../api/queries";
import { colors, radii, spacing } from "../../theme";
import { RootScreenProps } from "../../navigation/types";

export default function DiscoverScreen({ navigation, route }: RootScreenProps<"Discover">) {
  const p = route.params;
  const [text, setText] = useState(p?.q ?? "");
  const [q, setQ] = useState(p?.q ?? "");
  const [kind, setKind] = useState<string>(p?.kind ?? "");
  const [type, setType] = useState<string>(p?.type ?? "");
  const [category, setCategory] = useState<string>(p?.category ?? "");
  const [city, setCity] = useState("");
  const [cityQ, setCityQ] = useState("");
  const [priceMax, setPriceMax] = useState("");
  const [priceQ, setPriceQ] = useState("");
  const [bookable, setBookable] = useState(false);
  const [sort, setSort] = useState("newest");
  const facets = useListingFacets();

  // Debounce typing so each keystroke doesn't fire a search.
  useEffect(() => { const t = setTimeout(() => { setQ(text.trim()); setCityQ(city.trim()); setPriceQ(priceMax); }, 350); return () => clearTimeout(t); }, [text, city, priceMax]);

  const res = useDiscover({ q: q || undefined, kind: kind || undefined, type: type || undefined, category: category || undefined, city: cityQ || undefined, priceMax: priceQ || undefined, bookable: bookable ? "true" : undefined, sort: sort === "newest" ? undefined : sort });
  const cats = (facets.data?.categories ?? []).filter((c) => !type || c.type === type);
  const active = [kind, type, category, cityQ, priceQ, bookable ? "b" : ""].filter(Boolean).length;
  const clear = () => { setKind(""); setType(""); setCategory(""); setCity(""); setCityQ(""); setPriceMax(""); setPriceQ(""); setBookable(false); setText(""); setQ(""); };

  const Chip = ({ on, label, onPress }: { on: boolean; label: string; onPress: () => void }) => (
    <TouchableOpacity style={[styles.chip, on && styles.chipOn]} onPress={onPress} accessibilityRole="button" accessibilityState={{ selected: on }}>
      <Text style={[styles.chipText, on && styles.chipTextOn]}>{label}</Text>
    </TouchableOpacity>
  );

  return (
    <ScreenContainer>
      <AppHeader title="Find services" />
      <FlatList
        data={res.data}
        keyExtractor={(l) => l.id}
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={{ paddingHorizontal: spacing.lg, paddingBottom: 30, flexGrow: 1 }}
        refreshControl={<RefreshControl refreshing={res.isRefetching} onRefresh={() => void res.refetch()} />}
        ListHeaderComponent={
          <View>
            <TextField placeholder="Search services, providers, specialities" value={text} onChangeText={setText} returnKeyType="search" containerStyle={{ marginBottom: 8 }} />
            <View style={styles.chips}>
              <Chip on={!kind} label="All" onPress={() => setKind("")} />
              <Chip on={kind === "service"} label="Services" onPress={() => setKind("service")} />
              <Chip on={kind === "package"} label="Packages" onPress={() => setKind("package")} />
              <Chip on={bookable} label="Bookable now" onPress={() => setBookable((b) => !b)} />
            </View>
            <View style={styles.chips}>
              {(facets.data?.types ?? []).map((t) => (
                <Chip key={t.code} on={type === t.code} label={`${t.label} (${t.count})`} onPress={() => { setType(type === t.code ? "" : t.code); setCategory(""); }} />
              ))}
            </View>
            {cats.length ? (
              <View style={styles.chips}>
                {cats.map((c) => <Chip key={`${c.type}-${c.code}`} on={category === c.code} label={c.label} onPress={() => setCategory(category === c.code ? "" : c.code)} />)}
              </View>
            ) : null}
            <View style={styles.two}>
              <TextField placeholder="City" value={city} onChangeText={setCity} containerStyle={{ flex: 1, marginRight: 8 }} />
              <TextField placeholder="Max price" value={priceMax} onChangeText={(t) => setPriceMax(t.replace(/\D/g, ""))} keyboardType="number-pad" maxLength={6} containerStyle={{ flex: 1 }} />
            </View>
            <View style={styles.chips}>
              <Chip on={sort === "newest"} label="Newest" onPress={() => setSort("newest")} />
              <Chip on={sort === "price_asc"} label="Price: low to high" onPress={() => setSort("price_asc")} />
              <Chip on={sort === "price_desc"} label="Price: high to low" onPress={() => setSort("price_desc")} />
              {active ? <Chip on={false} label="Clear filters" onPress={clear} /> : null}
            </View>
            {res.isError ? <ListStateView kind="error" message="We couldn't load results." onRetry={() => void res.refetch()} /> : null}
            {res.isLoading ? <ListStateView kind="loading" message="Searching…" /> : null}
          </View>
        }
        ListEmptyComponent={res.isLoading || res.isError ? null : <ListStateView kind="empty" title="Nothing matches yet" message={active ? "Try removing a filter." : "No provider has published a service yet."} actionLabel={active ? "Clear filters" : undefined} onAction={active ? clear : undefined} />}
        renderItem={({ item: l }) => (
          <TouchableOpacity style={styles.card} onPress={() => navigation.navigate("ListingDetail", { listingId: l.id })} accessibilityRole="button" accessibilityLabel={`${l.name}, ${l.provider.name}, ${l.priceLabel}`}>
            <View style={{ flex: 1 }}>
              <Text style={styles.kind}>{l.kind === "package" ? "PACKAGE" : l.categoryLabel.toUpperCase()}</Text>
              <Text style={styles.name}>{l.name}</Text>
              <Text style={styles.meta}>{l.provider.name}{l.provider.verified ? " · Verified" : ""} · {l.provider.typeLabel}</Text>
              <Text style={styles.meta}>{[l.city, l.country].filter(Boolean).join(", ") || "Location on request"}</Text>
              <Text style={styles.price}>{l.priceLabel}{l.durationMinutes ? ` · ${l.durationMinutes} min` : ""}</Text>
              {!l.bookable ? <Text style={styles.meta}>Not bookable online yet</Text> : null}
            </View>
          </TouchableOpacity>
        )}
      />
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  chips: { flexDirection: "row", flexWrap: "wrap", marginBottom: 4 },
  two: { flexDirection: "row" },
  chip: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 16, backgroundColor: colors.surfaceAlt, marginRight: 6, marginBottom: 6 },
  chipOn: { backgroundColor: colors.primary },
  chipText: { fontSize: 12.5, color: colors.secondaryText },
  chipTextOn: { color: "#fff", fontWeight: "600" },
  card: { flexDirection: "row", borderWidth: 1, borderColor: colors.border, borderRadius: radii.md, padding: 14, marginBottom: 10 },
  kind: { fontSize: 10.5, fontWeight: "700", letterSpacing: 0.6, color: colors.primary },
  name: { fontSize: 16, fontWeight: "600", color: colors.text, marginTop: 3 },
  meta: { fontSize: 12.5, color: colors.secondaryText, marginTop: 3 },
  price: { fontSize: 14, fontWeight: "600", color: colors.text, marginTop: 6 },
});
