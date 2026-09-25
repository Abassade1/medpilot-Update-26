import React, { useState } from "react";
import { View, Text, StyleSheet, ScrollView, Image, TouchableOpacity, Linking } from "react-native";
import { Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";
import ScreenContainer from "../../components/ScreenContainer";
import AppHeader from "../../components/AppHeader";
import PlaceBadges from "../../components/PlaceBadges";
import ExpandableText from "../../components/ExpandableText";
import Button from "../../components/Button";
import ReviewsList from "../../components/ReviewsList";
import BottomSheet from "../../components/BottomSheet";
import InfoRow from "../../components/InfoRow";
import LogoBox from "../../components/LogoBox";
import { useProvider } from "../../api/queries";
import { assetSource } from "../../api/assets";
import ListStateView from "../../components/ListStateView";
import type { AircraftDto } from "../../api/types";
import { colors, radii, shadows, spacing } from "../../theme";
import { RootScreenProps } from "../../navigation/types";

export default function TransportDetailScreen({ navigation, route }: RootScreenProps<"TransportDetail">) {
  const query = useProvider(route.params.providerId);
  const provider = query.data;
  const [selectedAircraft, setSelectedAircraft] = useState<AircraftDto | null>(null);
  const [expanded, setExpanded] = useState(false);

  return (
    <ScreenContainer backgroundColor={colors.surface}>
      <View style={styles.headerBar}>
        <AppHeader />
      </View>
      {!provider ? (
        query.isError ? (
          <ListStateView kind="error" onRetry={() => void query.refetch()} />
        ) : (
          <ListStateView kind="loading" message="Loading provider…" />
        )
      ) : (
      <>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 24 }}>
        <View style={styles.body}>
          <View style={styles.titleRow}>
            <LogoBox text={provider.name.slice(0, 2).toUpperCase()} color={colors.surfaceAlt} size={52} image={assetSource(provider.logoAsset)} />
            <View style={{ flex: 1, marginLeft: 14 }}>
              <Text style={styles.name}>{provider.name}</Text>
              <Text style={styles.tags}>{provider.tags}</Text>
            </View>
          </View>

          <PlaceBadges name={provider.name} location={provider.location} rating={provider.rating} verified={provider.verified} />

          <Text style={styles.sectionTitle}>About</Text>
          <ExpandableText text={provider.description} style={styles.about} />

          <Text style={styles.sectionTitle}>Route</Text>
          <Text style={styles.routes}>{provider.routes}</Text>

          <Text style={styles.sectionTitle}>Aircraft in Service</Text>
        </View>

        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={{ paddingHorizontal: spacing.lg, paddingTop: 12 }}
        >
          {provider.aircraft.map((a) => (
            <TouchableOpacity
              key={a.id}
              style={styles.aircraftCard}
              activeOpacity={0.85}
              onPress={() => setSelectedAircraft(a)}
            >
              <Image source={assetSource(a.heroAsset)} style={styles.aircraftImage} />
              <View style={{ padding: 10 }}>
                <Text style={styles.aircraftName}>{a.name}</Text>
                <Text style={styles.aircraftCapacity}>{a.capacity}</Text>
              </View>
            </TouchableOpacity>
          ))}
        </ScrollView>

        <View style={styles.body}>
          <Text style={styles.sectionTitle}>Reviews</Text>
          <View style={{ marginTop: 10 }}>
            <ReviewsList targetType="transport_provider" targetId={provider.id} />
          </View>
        </View>
      </ScrollView>

      <View style={styles.footer}>
        <Button
          label="Book Appointment"
          variant="pill"
          onPress={() => navigation.navigate("TravelBooking", { providerId: provider.id })}
          style={styles.cta}
        />
      </View>
      </>
      )}

      <BottomSheet visible={!!selectedAircraft} onClose={() => setSelectedAircraft(null)} maxHeightRatio={0.8}>
        {selectedAircraft && (
          <View style={{ paddingBottom: 8 }}>
            <View style={styles.sheetHeader}>
              <Image source={assetSource(selectedAircraft.heroAsset)} style={styles.sheetThumb} />
              <View style={{ marginLeft: 14 }}>
                <Text style={styles.sheetName}>{selectedAircraft.name}</Text>
                <Text style={styles.sheetAvailable}>Available</Text>
              </View>
            </View>

            <View style={styles.pricePill}>
              <Text style={styles.priceFrom}>From </Text>
              <Text style={styles.priceValue}>{selectedAircraft.priceLabel}</Text>
            </View>

            <InfoRow label="Capacity:" value="1 intensive Care Patient" subValue={selectedAircraft.capacityNote ?? undefined} />
            <InfoRow
              label="Medical Crew:"
              value={selectedAircraft.medicalCrew ?? "—"}
              subLabel={selectedAircraft.paramedic ?? undefined}
              subValue={selectedAircraft.medicalCrewNote ?? undefined}
            />
            <InfoRow
              label="Max Cruising Altitude:"
              value={selectedAircraft.maxAltitude ?? "—"}
              subValue={selectedAircraft.maxAltitudeFt ?? undefined}
            />

            <Text style={styles.facilitiesTitle}>Facilities</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginTop: 12 }}>
              {selectedAircraft.facilities.map((f) => (
                <View key={f.label} style={styles.facilityCard}>
                  <Image source={assetSource(f.imageAsset)} style={styles.facilityImage} />
                  <Text style={styles.facilityLabel}>{f.label}</Text>
                </View>
              ))}
            </ScrollView>
          </View>
        )}
      </BottomSheet>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  headerBar: { backgroundColor: colors.background },
  body: { paddingHorizontal: spacing.lg },
  titleRow: { flexDirection: "row", alignItems: "center", marginTop: 20 },
  name: { fontSize: 17, fontWeight: "700", color: colors.text },
  tags: { fontSize: 12.5, fontWeight: "500", color: colors.primary, marginTop: 4 },
  chipRow: { flexDirection: "row", alignItems: "center", marginTop: 18 },
  sectionTitle: { fontSize: 16, fontWeight: "700", color: colors.text, marginTop: 22 },
  about: { fontSize: 13.5, color: colors.text, lineHeight: 20, marginTop: 8 },
  readMore: { color: colors.primary, fontWeight: "600" },
  routes: { fontSize: 13, color: colors.primary, fontWeight: "500", marginTop: 8 },
  aircraftCard: {
    width: 168,
    backgroundColor: "#fff",
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: colors.borderLight,
    marginRight: 12,
    overflow: "hidden",
    ...shadows.card,
  },
  aircraftImage: { width: "100%", height: 84 },
  aircraftName: { fontSize: 13, fontWeight: "700", color: colors.text },
  aircraftCapacity: { fontSize: 11, color: colors.secondaryText, marginTop: 4, lineHeight: 15 },
  footer: {
    backgroundColor: colors.background,
    borderTopWidth: 1,
    borderTopColor: colors.borderLight,
    paddingTop: 12,
    paddingBottom: 20,
  },
  cta: { minWidth: 260 },
  sheetHeader: { flexDirection: "row", alignItems: "center" },
  sheetThumb: { width: 56, height: 42, borderRadius: 6 },
  sheetName: { fontSize: 16.5, fontWeight: "700", color: colors.text },
  sheetAvailable: { fontSize: 12.5, fontWeight: "600", color: colors.success, marginTop: 2 },
  pricePill: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.primaryLight,
    borderRadius: radii.pill,
    height: 46,
    marginTop: 16,
    marginBottom: 6,
  },
  priceFrom: { fontSize: 12.5, color: colors.secondaryText },
  priceValue: { fontSize: 19, fontWeight: "700", color: colors.text },
  facilitiesTitle: { fontSize: 15.5, fontWeight: "700", color: colors.text, marginTop: 16 },
  facilityCard: {
    width: 132,
    backgroundColor: "#fff",
    borderRadius: radii.sm,
    borderWidth: 1,
    borderColor: colors.borderLight,
    marginRight: 12,
    overflow: "hidden",
  },
  facilityImage: { width: "100%", height: 72 },
  facilityLabel: { fontSize: 11.5, fontWeight: "600", color: colors.text, padding: 8 },
});
