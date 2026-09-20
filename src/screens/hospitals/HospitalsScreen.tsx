import React, { useEffect, useMemo, useState } from "react";
import { View, Text, StyleSheet, FlatList, TouchableOpacity } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import ScreenContainer from "../../components/ScreenContainer";
import AppHeader from "../../components/AppHeader";
import SearchBar from "../../components/SearchBar";
import FacilityRow from "../../components/FacilityRow";
import ListStateView from "../../components/ListStateView";
import { useHospitals } from "../../api/queries";

import { colors, spacing } from "../../theme";
import { RootScreenProps } from "../../navigation/types";

export default function HospitalsScreen({ navigation }: RootScreenProps<"Hospitals">) {
  const [query, setQuery] = useState("");
  const [debounced, setDebounced] = useState("");

  // Debounced so each keystroke doesn't fire a request.
  useEffect(() => {
    const t = setTimeout(() => setDebounced(query.trim()), 300);
    return () => clearTimeout(t);
  }, [query]);

  const hospitalsQuery = useHospitals(debounced || undefined);
  const data = hospitalsQuery.data ?? [];

  const unused = useMemo(() => {
    return null;
  }, []);
  void unused;

  return (
    <ScreenContainer>
      <AppHeader
      />
      <View style={styles.headerBlock}>
        <Text style={styles.title}>Hospitals</Text>
        <SearchBar value={query} onChangeText={setQuery} style={{ marginTop: 14 }} />
      </View>
      <FlatList
        data={data}
        keyExtractor={(h) => h.id}
        contentContainerStyle={styles.list}
        showsVerticalScrollIndicator={false}
        renderItem={({ item }) => (
          <FacilityRow
            hospital={item}
            onPress={() => navigation.navigate("HospitalDetail", { hospitalId: item.id })}
          />
        )}
        ListEmptyComponent={
          hospitalsQuery.isPending ? (
            <ListStateView kind="loading" message="Loading hospitals…" />
          ) : hospitalsQuery.isError ? (
            <ListStateView kind="error" onRetry={() => void hospitalsQuery.refetch()} />
          ) : (
            <ListStateView
              kind="empty"
              title="No hospitals found"
              message={debounced ? `Nothing matched “${debounced}”. Try a different search.` : "No hospitals are available right now."}
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
