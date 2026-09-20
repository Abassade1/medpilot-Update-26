import React, { useState } from "react";
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Image } from "react-native";
import { useNavigation } from "@react-navigation/native";
import ScreenContainer from "../../components/ScreenContainer";
import AppHeader from "../../components/AppHeader";
import SearchBar from "../../components/SearchBar";
import { useServices } from "../../api/queries";
import { assetSource } from "../../api/assets";
import ListStateView from "../../components/ListStateView";
import { openService } from "../../utils/serviceRoutes";
import type { ServiceDto } from "../../api/types";
import { colors, radii, spacing } from "../../theme";

export default function ServicesScreen() {
  const navigation = useNavigation();
  const servicesQuery = useServices();

  const [q, setQ] = useState("");
  const open = (service: ServiceDto) => openService(navigation, service);
  const shown = (servicesQuery.data ?? []).filter((x) =>
    `${x.title} ${x.description}`.toLowerCase().includes(q.trim().toLowerCase()),
  );

  return (
    <ScreenContainer>
      <AppHeader />
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.content}>
        <Text style={styles.title}>Services</Text>
        <SearchBar placeholder="Search services" value={q} onChangeText={setQ} style={{ marginTop: 14, marginBottom: 18 }} />
        {servicesQuery.isPending && <ListStateView kind="loading" message="Loading services…" />}
        {servicesQuery.isError && <ListStateView kind="error" onRetry={() => void servicesQuery.refetch()} />}
        {!servicesQuery.isPending && !servicesQuery.isError && shown.length === 0 ? (
          <ListStateView kind="empty" title="No matching services" message="Try a different search." />
        ) : null}
        <View style={styles.grid}>
          {shown.map((service) => (
            <TouchableOpacity
              key={service.id}
              style={[styles.card, { backgroundColor: service.color }]}
              activeOpacity={0.85}
              onPress={() => open(service)}
            >
              <View>
                <Text style={styles.cardTitle}>{service.title}</Text>
                <Text style={styles.cardDesc}>{service.description}</Text>
              </View>
              <Image source={assetSource(service.imageAsset)} style={styles.cardImage} resizeMode="contain" />
            </TouchableOpacity>
          ))}
        </View>
      </ScrollView>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  content: { paddingHorizontal: spacing.lg, paddingBottom: 32 },
  title: { fontSize: 28, fontWeight: "700", color: colors.text, marginTop: 4 },
  grid: { flexDirection: "row", flexWrap: "wrap", justifyContent: "space-between" },
  card: {
    width: "48.2%",
    aspectRatio: 0.773,
    borderRadius: radii.md,
    padding: 14,
    marginBottom: 14,
    overflow: "hidden",
  },
  cardTitle: { fontSize: 16.5, fontWeight: "700", color: colors.text, lineHeight: 21 },
  cardDesc: { fontSize: 12, color: "#3F4753", marginTop: 6, lineHeight: 16 },
  cardImage: { flex: 1, width: "100%", marginTop: 6, alignSelf: "flex-end" },
});
