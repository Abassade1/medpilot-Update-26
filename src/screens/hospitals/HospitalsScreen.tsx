import React, { useMemo, useState } from "react";
import { View, Text, StyleSheet, FlatList, TouchableOpacity } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import ScreenContainer from "../../components/ScreenContainer";
import AppHeader from "../../components/AppHeader";
import SearchBar from "../../components/SearchBar";
import FacilityRow from "../../components/FacilityRow";
import ListStateView from "../../components/ListStateView";
import { useSimulatedFetch } from "../../hooks/useSimulatedFetch";
import { hospitals } from "../../data/mock";
import { colors, spacing } from "../../theme";
import { RootScreenProps } from "../../navigation/types";

export default function HospitalsScreen({ navigation }: RootScreenProps<"Hospitals">) {
  const [query, setQuery] = useState("");
  const { status, retry } = useSimulatedFetch();

  const data = useMemo(() => {
    // Repeat entries so the list matches the fuller Figma listing
    if (status !== "success") return [];
    const base = [...hospitals, ...hospitals.slice(0, 4)];
    const q = query.trim().toLowerCase();
    if (!q) return base;
    return base.filter(
      (h) =>
        h.name.toLowerCase().includes(q) ||
        h.specialty.toLowerCase().includes(q) ||
        h.country.toLowerCase().includes(q)
    );
  }, [query, status]);

  return (
    <ScreenContainer>
      <AppHeader
        right={
          <TouchableOpacity hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
            <Ionicons name="options-outline" size={20} color={colors.text} />
          </TouchableOpacity>
        }
      />
      <View style={styles.headerBlock}>
        <Text style={styles.title}>Hospitals</Text>
        <SearchBar value={query} onChangeText={setQuery} style={{ marginTop: 14 }} />
      </View>
      <FlatList
        data={data}
        keyExtractor={(h, i) => `${h.id}-${i}`}
        contentContainerStyle={styles.list}
        showsVerticalScrollIndicator={false}
        renderItem={({ item }) => (
          <FacilityRow
            hospital={item}
            onPress={() => navigation.navigate("HospitalDetail", { hospitalId: item.id })}
          />
        )}
        ListEmptyComponent={
          status === "loading" ? (
            <ListStateView kind="loading" message="Loading hospitals…" />
          ) : status === "error" ? (
            <ListStateView kind="error" onRetry={retry} />
          ) : (
            <ListStateView
              kind="empty"
              title="No hospitals found"
              message={`Nothing matched “${query.trim()}”. Try a different search.`}
            />
          )
        }
      />
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  headerBlock: { paddingHorizontal: spacing.lg, paddingTop: 4, paddingBottom: 10 },
  title: { fontSize: 28, fontWeight: "700", color: colors.text },
  list: { paddingHorizontal: spacing.lg, paddingBottom: 32 },
});
