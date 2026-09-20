import React, { useState } from "react";
import { View, Text, StyleSheet, FlatList, TouchableOpacity } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import ListStateView from "../../components/ListStateView";
import ScreenContainer from "../../components/ScreenContainer";
import AppHeader from "../../components/AppHeader";
import SegmentTabs from "../../components/SegmentTabs";
import ProviderCard from "../../components/ProviderCard";
import SearchBar from "../../components/SearchBar";
import { useMe, usePetClinics } from "../../api/queries";
import { assetSource } from "../../api/assets";
import { colors, radii, spacing } from "../../theme";
import { RootScreenProps } from "../../navigation/types";

const TABS = ["Vet Doctors", "Pet Pedicure", "Pet Sitters"];

export default function PetSpecialistScreen({ navigation }: RootScreenProps<"PetSpecialist">) {
  const [tab, setTab] = useState(1);
  const category = (["vet", "pedicure", "sitters"] as const)[tab] ?? "pedicure";
  const clinicsQuery = usePetClinics(category);
  const me = useMe();
  const [showSearch, setShowSearch] = useState(false);
  const [q, setQ] = useState("");
  const needle = q.trim().toLowerCase();
  const rows = (clinicsQuery.data ?? []).filter(
    (c) => !needle || `${c.name} ${c.location} ${c.description}`.toLowerCase().includes(needle),
  );

  return (
    <ScreenContainer>
      <AppHeader
        title="Pet Specialist"
        right={
          <TouchableOpacity
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            onPress={() => { setShowSearch((v) => !v); setQ(""); }}
            accessibilityRole="button"
            accessibilityLabel={showSearch ? "Close search" : "Search pet services"}
          >
            <Ionicons name={showSearch ? "close" : "search"} size={20} color={colors.primary} />
          </TouchableOpacity>
        }
      />
      <View style={styles.locationWrap}>
        {showSearch ? (
          <SearchBar placeholder="Search vets, groomers, sitters" value={q} onChangeText={setQ} />
        ) : (
          <View style={styles.locationPill}>
            <Ionicons name="location-sharp" size={15} color={colors.text} />
            <Text style={styles.locationText}>{me.data?.profile?.locationLabel ?? "Your location"}</Text>
          </View>
        )}
      </View>
      <SegmentTabs tabs={TABS} active={tab} onChange={setTab} />
      <FlatList
        data={rows}
        keyExtractor={(p) => p.id}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.list}
        ListEmptyComponent={
          clinicsQuery.isPending ? <ListStateView kind="loading" /> :
          clinicsQuery.isError ? <ListStateView kind="error" onRetry={() => void clinicsQuery.refetch()} /> :
          <ListStateView kind="empty" title="Nothing to show" message={needle ? "No providers match your search." : "No pet services are available in this category."} />
        }
        renderItem={({ item }) => (
          <ProviderCard
            image={assetSource(item.heroAsset)!}
            price={item.priceFromLabel ?? ""}
            logo={<Text style={styles.logoEmoji}>{item.logoEmoji}</Text>}
            name={item.name}
            location={item.location}
            rating={item.rating}
            verified={item.verified}
            description={item.description}
            routesLabel="Open to Locations"
            routes={item.openTo}
            onPress={() => navigation.navigate("PetClinicDetail", { clinicId: item.id })}
          />
        )}
      />
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  locationWrap: { paddingHorizontal: spacing.lg, paddingTop: 4, paddingBottom: 12 },
  locationPill: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: colors.surfaceAlt,
    borderRadius: radii.sm,
    height: 40,
    paddingHorizontal: 12,
  },
  locationText: { fontSize: 13, color: colors.text, marginLeft: 8 },
  list: { paddingHorizontal: spacing.lg, paddingTop: 16, paddingBottom: 32 },
  logoEmoji: { fontSize: 26 },
});
