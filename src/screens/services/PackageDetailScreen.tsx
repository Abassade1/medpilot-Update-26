import React, { useState } from "react";
import { View, Text, StyleSheet, ScrollView, Image, TouchableOpacity } from "react-native";
import { Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import ScreenContainer from "../../components/ScreenContainer";
import Chip from "../../components/Chip";
import InfoRow from "../../components/InfoRow";
import Button from "../../components/Button";
import SpecialistCard from "../../components/SpecialistCard";
import LogoBox from "../../components/LogoBox";
import { usePackage } from "../../api/queries";
import { assetSource } from "../../api/assets";
import ListStateView from "../../components/ListStateView";
import { colors, radii, shadows, spacing } from "../../theme";
import { RootScreenProps } from "../../navigation/types";

const TABS = ["Hospital", "Transportation", "Cost summary"] as const;

export default function PackageDetailScreen({ navigation, route }: RootScreenProps<"PackageDetail">) {
  const query = usePackage(route.params.packageId);
  const pkg = query.data;
  const hospital = pkg?.hospital;
  const provider = pkg?.transportProvider ?? null;
  const insets = useSafeAreaInsets();
  const [tab, setTab] = useState(0);

  return (
    <ScreenContainer edgesTop={false} barStyle="light-content">
      {!pkg || !hospital ? (
        query.isError ? (
          <ListStateView kind="error" onRetry={() => void query.refetch()} />
        ) : (
          <ListStateView kind="loading" message="Loading package…" />
        )
      ) : (
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 28 }}>
        <View style={styles.heroWrap}>
          <Image source={assetSource(pkg.heroAsset)} style={styles.hero} />
          <LinearGradient colors={["transparent", "rgba(2,8,20,0.8)"]} style={styles.heroGradient} />
          <TouchableOpacity
            style={[styles.backBtn, { top: insets.top + 8 }]}
            onPress={() => navigation.goBack()}
          >
            <Ionicons name="chevron-back" size={20} color={colors.primary} />
          </TouchableOpacity>
          <View style={styles.heroText}>
            <Text style={styles.heroTitle}>{pkg.title}</Text>
            <Text style={styles.heroSubtitle}>{pkg.location}</Text>
          </View>
        </View>

        <View style={styles.tabsCard}>
          {TABS.map((t, i) => (
            <TouchableOpacity key={t} style={[styles.tab, i === tab && styles.tabActive]} onPress={() => setTab(i)}>
              <Text style={[styles.tabLabel, i === tab && styles.tabLabelActive]}>{t}</Text>
            </TouchableOpacity>
          ))}
        </View>

        {tab === 0 && (
          <View style={styles.body}>
            <View style={styles.titleRow}>
              <LogoBox text={hospital.name.slice(0, 2).toUpperCase()} color={colors.surfaceAlt} size={48} image={assetSource(hospital.logoAsset)} />
              <View style={{ flex: 1, marginLeft: 12 }}>
                <Text style={styles.name}>{hospital.name}</Text>
                <Text style={styles.tags}>
                  {hospital.specialty.split(" ")[0]} | {hospital.country}
                </Text>
              </View>
            </View>
            <View style={styles.chipRow}>
              <Chip label="Direction" elevated icon={<MaterialCommunityIcons name="compass" size={16} color="#8C2B1E" />} />
              <Chip
                label="Membership"
                elevated
                style={{ marginLeft: 10 }}
                icon={<MaterialCommunityIcons name="shield-check" size={16} color={colors.success} />}
              />
              <Chip
                label={String(hospital.rating)}
                elevated
                style={{ marginLeft: 10 }}
                icon={<Ionicons name="star" size={14} color={colors.warning} />}
              />
            </View>
            <Text style={styles.sectionTitle}>About us</Text>
            <Text style={styles.about}>
              {hospital.about} <Text style={styles.readMore}>Read More</Text>
            </Text>
            <View style={{ marginTop: 12 }}>
              <InfoRow label="Care system" value={hospital.careSystem} />
              <InfoRow
                label="Open Hours"
                value={hospital.openHours}
                valueColor={colors.success}
                subValue={hospital.openHoursNote ?? undefined}
              />
              <InfoRow label="Helipad:" value={hospital.helipadCode ?? "—"} />
            </View>
            <Text style={styles.sectionTitle}>Specialists</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginTop: 12 }}>
              {hospital.specialists.map((sp) => (
                <SpecialistCard key={sp.id} specialist={sp} />
              ))}
            </ScrollView>
          </View>
        )}

        {tab === 1 && (
          <View style={styles.body}>
            <View style={styles.titleRow}>
              <LogoBox text={(provider?.name ?? "").slice(0, 2).toUpperCase()} color={colors.surfaceAlt} size={48} image={assetSource(provider?.logoAsset)} />
              <View style={{ flex: 1, marginLeft: 12 }}>
                <Text style={styles.name}>{provider?.name}</Text>
                <Text style={styles.tags}>{provider?.tags}</Text>
              </View>
            </View>
            <View style={styles.chipRow}>
              <Chip label="Direction" elevated icon={<MaterialCommunityIcons name="compass" size={16} color="#8C2B1E" />} />
              <Chip
                label="Membership"
                elevated
                style={{ marginLeft: 10 }}
                icon={<MaterialCommunityIcons name="shield-check" size={16} color={colors.success} />}
              />
              <Chip
                label="4.6"
                elevated
                style={{ marginLeft: 10 }}
                icon={<Ionicons name="star" size={14} color={colors.warning} />}
              />
            </View>
            <Text style={styles.sectionTitle}>About</Text>
            <Text style={styles.about}>
              {provider?.description} <Text style={styles.readMore}>Read More</Text>
            </Text>
            <Text style={styles.sectionTitle}>Route</Text>
            <Text style={styles.routes}>USA | Mexico | UK | India | Italy | South Korea | China</Text>
            <Text style={styles.sectionTitle}>Available Aircrafts</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginTop: 12 }}>
              {(provider?.aircraft ?? []).map((a) => (
                <View key={a.id} style={styles.aircraftCard}>
                  <Image source={assetSource(a.heroAsset)} style={styles.aircraftImage} />
                  <View style={{ padding: 10 }}>
                    <Text style={styles.aircraftName}>{a.name}</Text>
                    <Text style={styles.aircraftCapacity}>{a.capacity}</Text>
                  </View>
                </View>
              ))}
            </ScrollView>
          </View>
        )}

        {tab === 2 && (
          <View style={styles.body}>
            <Text style={styles.sectionTitle}>Cost summary</Text>
            <View style={{ marginTop: 8 }}>
              <InfoRow label="Treatment package" value={pkg.costSummary.treatmentLabel} />
              <InfoRow label="Transportation" value={pkg.costSummary.transportationLabel} />
              <InfoRow label="Accommodation" value={pkg.costSummary.accommodation} valueColor={colors.success} />
              <InfoRow label="Feeding" value={pkg.costSummary.feeding} valueColor={colors.success} />
              <InfoRow label="Total (estimate)" value={pkg.costSummary.totalLabel} />
            </View>
          </View>
        )}

        <Button
          label="Book Appointment"
          onPress={() => navigation.navigate("BookAppointment", { hospitalId: hospital.id })}
          style={styles.cta}
        />
      </ScrollView>
      )}
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  heroWrap: { height: 230 },
  hero: { width: "100%", height: "100%" },
  heroGradient: { position: "absolute", left: 0, right: 0, bottom: 0, height: "60%" },
  backBtn: {
    position: "absolute",
    left: 16,
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: "#fff",
    alignItems: "center",
    justifyContent: "center",
    ...shadows.card,
  },
  heroText: { position: "absolute", left: 18, bottom: 14 },
  heroTitle: { color: "#fff", fontSize: 19, fontWeight: "700" },
  heroSubtitle: { color: "#D8DEE7", fontSize: 12.5, marginTop: 4 },
  tabsCard: {
    flexDirection: "row",
    marginHorizontal: spacing.lg,
    marginTop: 14,
    backgroundColor: colors.surfaceAlt,
    borderRadius: radii.sm,
    padding: 4,
  },
  tab: { flex: 1, height: 34, alignItems: "center", justifyContent: "center", borderRadius: radii.xs },
  tabActive: { backgroundColor: "#fff", ...shadows.card },
  tabLabel: { fontSize: 12.5, fontWeight: "500", color: colors.secondaryText },
  tabLabelActive: { color: colors.primary, fontWeight: "600" },
  body: { paddingHorizontal: spacing.lg, paddingTop: 18 },
  titleRow: { flexDirection: "row", alignItems: "center" },
  name: { fontSize: 16, fontWeight: "700", color: colors.text },
  tags: { fontSize: 12.5, fontWeight: "500", color: colors.primary, marginTop: 4 },
  chipRow: { flexDirection: "row", alignItems: "center", marginTop: 16 },
  sectionTitle: { fontSize: 15.5, fontWeight: "700", color: colors.text, marginTop: 20 },
  about: { fontSize: 13, color: colors.text, lineHeight: 19, marginTop: 8 },
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
  aircraftName: { fontSize: 12.5, fontWeight: "700", color: colors.text },
  aircraftCapacity: { fontSize: 11, color: colors.secondaryText, marginTop: 4, lineHeight: 15 },
  cta: { marginHorizontal: spacing.xxl, marginTop: 30, borderRadius: 24 },
});
