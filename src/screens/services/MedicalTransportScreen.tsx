import React, { useEffect, useState } from "react";
import { View, Text, StyleSheet, ScrollView } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import ListStateView from "../../components/ListStateView";
import ScreenContainer from "../../components/ScreenContainer";
import AppHeader from "../../components/AppHeader";
import SegmentTabs from "../../components/SegmentTabs";
import ProviderCard from "../../components/ProviderCard";
import LogoBox from "../../components/LogoBox";
import Button from "../../components/Button";
import LocationPicker, { deepest, describeLocation, EMPTY_LOCATION, LocationSel } from "../../components/LocationPicker";
import AvailabilityPanel from "../../components/AvailabilityPanel";
import { useAvailability } from "../../api/queries";
import { assetSource } from "../../api/assets";
import { colors, spacing } from "../../theme";
import { RootScreenProps } from "../../navigation/types";

const TABS = ["Private Jet", "Medical Ambulance", "Speed Boat"];
const CATEGORIES = ["jet", "ambulance", "boat"] as const;

export default function MedicalTransportScreen({ navigation }: RootScreenProps<"MedicalTransport">) {
  const [tab, setTab] = useState(1);
  const [sel, setSel] = useState<LocationSel>(EMPTY_LOCATION);
  const place = deepest(sel);
  const availability = useAvailability(place?.id ?? null);
  const data = availability.data;

  // When a new place is chosen, land on a service that is actually available there.
  useEffect(() => {
    if (!data) return;
    const current = data.services.find((s) => s.category === CATEGORIES[tab]);
    if (current?.available) return;
    const first = data.services.findIndex((s) => s.available);
    if (first >= 0) setTab(CATEGORIES.indexOf(data.services[first]!.category));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data]);

  const category = CATEGORIES[tab]!;
  const current = data?.services.find((s) => s.category === category);
  const placeName = describeLocation(sel);
  const alternatives = (data?.services ?? []).filter((s) => s.available && s.category !== category);

  return (
    <ScreenContainer>
      <AppHeader title="Medical Transportation" />
      <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled" contentContainerStyle={styles.content}>
        <Text style={styles.lead}>Tell us where you are and we'll show the transport that can reach you.</Text>
        <LocationPicker value={sel} onChange={setSel} detect />
        {place ? (
          <AvailabilityPanel place={placeName} loading={availability.isPending && availability.isFetching} error={availability.isError} data={data} onRetry={() => void availability.refetch()} />
        ) : null}

        {!place ? (
          <ListStateView kind="empty" title="Choose your location" message="Pick a country (and a province or city if you can) to see which services are available." />
        ) : data ? (
          <>
            <SegmentTabs tabs={TABS} active={tab} onChange={setTab} style={{ marginHorizontal: -spacing.lg }} />
            {current && current.available ? (
              <View style={{ marginTop: 14 }}>
                {current.coverage === "partial" ? (
                  <View style={styles.hint}>
                    <Ionicons name="information-circle" size={16} color="#9A5B00" />
                    <Text style={styles.hintText}>Only covers part of {placeName}. Add your city to confirm it reaches you.</Text>
                  </View>
                ) : null}
                {current.providers.map((p) => (
                  <ProviderCard
                    key={p.id}
                    image={assetSource(p.heroAsset)!}
                    price={p.priceFromLabel ?? ""}
                    logo={<LogoBox text={p.name.slice(0, 2).toUpperCase()} color={colors.surfaceAlt} size={38} image={assetSource(p.logoAsset)} />}
                    name={p.name}
                    location={p.servedVia}
                    rating={p.rating}
                    verified={p.verified}
                    description={p.tags}
                    routesLabel="Coverage"
                    routes={p.coverage === "full" ? `All of ${placeName}` : `Part of ${placeName}`}
                    onPress={() => navigation.navigate("TransportDetail", { providerId: p.id })}
                  />
                ))}
              </View>
            ) : (
              <View style={styles.unavailable}>
                <Ionicons name="close-circle-outline" size={30} color={colors.tertiaryText} />
                <Text style={styles.unTitle}>{TABS[tab]} isn't available in {placeName}</Text>
                <Text style={styles.unText}>
                  {alternatives.length ? "These services can reach you instead:" : "No transport service covers this place yet. Try a nearby city or another province/state."}
                </Text>
                {alternatives.map((s) => (
                  <Button key={s.category} label={s.label} variant="outlinePill" onPress={() => setTab(CATEGORIES.indexOf(s.category))} style={{ marginTop: 10, alignSelf: "stretch" }} />
                ))}
              </View>
            )}
          </>
        ) : null}
      </ScrollView>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  content: { paddingHorizontal: spacing.lg, paddingTop: 4, paddingBottom: 32 },
  lead: { fontSize: 13, color: colors.secondaryText, lineHeight: 18, marginBottom: 12 },
  hint: { flexDirection: "row", backgroundColor: "#FFF1D6", borderRadius: 10, padding: 10, marginBottom: 12 },
  hintText: { flex: 1, fontSize: 12.5, color: "#7A4A00", marginLeft: 8, lineHeight: 17 },
  unavailable: { alignItems: "center", paddingVertical: 28 },
  unTitle: { fontSize: 15, fontWeight: "700", color: colors.text, marginTop: 10, textAlign: "center" },
  unText: { fontSize: 13, color: colors.secondaryText, textAlign: "center", lineHeight: 19, marginTop: 6 },
});
