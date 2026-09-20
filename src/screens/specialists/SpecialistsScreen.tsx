import React, { useState } from "react";
import { FlatList, Image, ScrollView, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { MaterialIcons } from "@expo/vector-icons";
import ScreenContainer from "../../components/ScreenContainer";
import AppHeader from "../../components/AppHeader";
import SearchBar from "../../components/SearchBar";
import Rating from "../../components/Rating";
import ListStateView from "../../components/ListStateView";
import { useSpecialistCategories, useSpecialists } from "../../api/queries";
import { assetSource } from "../../api/assets";
import { colors, radii, spacing } from "../../theme";
import { RootScreenProps } from "../../navigation/types";

export default function SpecialistsScreen({ navigation, route }: RootScreenProps<"Specialists">) {
  const [categoryId, setCategoryId] = useState<string | undefined>(route.params?.categoryId);
  const [q, setQ] = useState("");
  const [debounced, setDebounced] = useState("");
  React.useEffect(() => {
    const t = setTimeout(() => setDebounced(q.trim()), 300);
    return () => clearTimeout(t);
  }, [q]);
  const categories = useSpecialistCategories();
  const list = useSpecialists(categoryId, debounced || undefined);

  return (
    <ScreenContainer>
      <AppHeader title="Independent Specialists" />
      <View style={styles.searchWrap}>
        <SearchBar placeholder="Search by name or specialty" value={q} onChangeText={setQ} />
      </View>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.chips} contentContainerStyle={{ paddingHorizontal: spacing.lg }}>
        {[{ id: undefined as string | undefined, title: "All" }, ...(categories.data ?? [])].map((c) => {
          const on = c.id === categoryId;
          return (
            <TouchableOpacity key={c.id ?? "all"} onPress={() => setCategoryId(c.id)} accessibilityRole="radio" accessibilityState={{ selected: on }}
              style={[styles.chip, on && styles.chipOn]}>
              <Text style={[styles.chipText, on && { color: colors.primary }]}>{c.title}</Text>
            </TouchableOpacity>
          );
        })}
      </ScrollView>
      <FlatList
        data={list.data ?? []}
        keyExtractor={(s) => s.id}
        contentContainerStyle={styles.list}
        showsVerticalScrollIndicator={false}
        ListEmptyComponent={
          list.isPending ? <ListStateView kind="loading" /> :
          list.isError ? <ListStateView kind="error" onRetry={() => void list.refetch()} /> :
          <ListStateView kind="empty" title="No specialists found" message={debounced || categoryId ? "Try a different search or category." : "No specialists are listed yet."} />
        }
        renderItem={({ item }) => (
          <TouchableOpacity style={styles.card} activeOpacity={0.85}
            onPress={() => navigation.navigate("SpecialistProfile", { specialistId: item.id })}
            accessibilityRole="button" accessibilityLabel={`${item.name}, ${item.role}. ${item.availabilityLabel}`}>
            <Image source={assetSource(item.photoAsset)} style={styles.photo} />
            <View style={{ flex: 1, marginLeft: 12 }}>
              <View style={styles.nameRow}>
                <Text style={styles.name} numberOfLines={1}>{item.name}</Text>
                {item.verified ? <MaterialIcons name="verified" size={14} color={colors.success} style={{ marginLeft: 4 }} /> : null}
              </View>
              <Text style={styles.role}>{item.role}</Text>
              <Text style={styles.loc}>{item.locationLabel}</Text>
              <View style={styles.footer}>
                <Rating value={item.rating} />
                <Text style={[styles.avail, !item.acceptingRequests && { color: colors.secondaryText }]}>
                  {item.acceptingRequests ? item.availabilityLabel : "Not accepting requests"}
                </Text>
              </View>
            </View>
          </TouchableOpacity>
        )}
      />
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  searchWrap: { paddingHorizontal: spacing.lg, paddingTop: 4 },
  chips: { flexGrow: 0, marginTop: 12 },
  chip: { paddingHorizontal: 14, paddingVertical: 7, borderRadius: 18, borderWidth: 1, borderColor: colors.borderLight, marginRight: 8, backgroundColor: "#fff" },
  chipOn: { borderColor: colors.primary, backgroundColor: colors.primaryLight },
  chipText: { fontSize: 12.5, fontWeight: "600", color: colors.secondaryText },
  list: { paddingHorizontal: spacing.lg, paddingTop: 14, paddingBottom: 28 },
  card: { flexDirection: "row", backgroundColor: "#fff", borderRadius: radii.md, borderWidth: 1, borderColor: colors.borderLight, padding: 12, marginBottom: 12 },
  photo: { width: 72, height: 72, borderRadius: 12, backgroundColor: colors.surfaceAlt },
  nameRow: { flexDirection: "row", alignItems: "center" },
  name: { fontSize: 15, fontWeight: "700", color: colors.text, flexShrink: 1 },
  role: { fontSize: 12.5, color: colors.secondaryText, marginTop: 2 },
  loc: { fontSize: 12, color: colors.tertiaryText, marginTop: 1 },
  footer: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginTop: 6 },
  avail: { fontSize: 11.5, fontWeight: "600", color: colors.success },
});
