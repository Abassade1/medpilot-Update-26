import React from "react";
import { RefreshControl, ScrollView, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import ScreenContainer from "../../components/ScreenContainer";
import AppHeader from "../../components/AppHeader";
import Button from "../../components/Button";
import ListStateView from "../../components/ListStateView";
import StatusPill from "../../components/StatusPill";
import { useMyProvider, useProviderDashboard } from "../../api/queries";
import { colors, radii, spacing } from "../../theme";
import { RootScreenProps } from "../../navigation/types";

type Icon = React.ComponentProps<typeof Ionicons>["name"];

export default function ProviderHomeScreen({ navigation }: RootScreenProps<"ProviderHome">) {
  const me = useMyProvider();
  const provider = me.data?.provider;
  const dash = useProviderDashboard(!!provider);

  if (me.isLoading) return <Shell><ListStateView kind="loading" message="Loading your provider account…" /></Shell>;
  if (me.isError) return <Shell><ListStateView kind="error" message="We couldn't load your provider account." onRetry={() => void me.refetch()} /></Shell>;

  if (!provider) {
    return (
      <Shell>
        <View style={styles.center}>
          <Ionicons name="storefront-outline" size={44} color={colors.primary} />
          <Text style={styles.title}>Offer your services on MedPilot</Text>
          <Text style={styles.body}>
            Hospitals, clinics, transport companies, nurses, vets and independent specialists can publish services and
            packages here. Members find them in the app and book directly.
          </Text>
          <Button label="Set up provider profile" variant="pill" onPress={() => navigation.navigate("ProviderOnboarding")} style={{ marginTop: 20, alignSelf: "stretch" }} />
        </View>
      </Shell>
    );
  }

  const d = dash.data;
  const tiles: { label: string; value: number | string; icon: Icon; go: () => void }[] = [
    { label: "Pending requests", value: d?.bookings.pending ?? "–", icon: "time-outline", go: () => navigation.navigate("ProviderBookings", { status: "pending" }) },
    { label: "Upcoming", value: d?.bookings.upcoming ?? "–", icon: "calendar-outline", go: () => navigation.navigate("ProviderBookings", { status: "confirmed" }) },
    { label: "Completed", value: d?.bookings.completed ?? "–", icon: "checkmark-done-outline", go: () => navigation.navigate("ProviderBookings", { status: "completed" }) },
    { label: "Published services", value: d?.services.published ?? "–", icon: "medkit-outline", go: () => navigation.navigate("ProviderListings", { kind: "service" }) },
    { label: "Published packages", value: d?.packages.published ?? "–", icon: "albums-outline", go: () => navigation.navigate("ProviderListings", { kind: "package" }) },
    { label: "Drafts", value: d ? d.services.draft + d.packages.draft : "–", icon: "create-outline", go: () => navigation.navigate("ProviderListings") },
  ];

  return (
    <Shell>
      <ScrollView contentContainerStyle={styles.content} refreshControl={<RefreshControl refreshing={dash.isRefetching} onRefresh={() => { void dash.refetch(); void me.refetch(); }} />}>
        <View style={styles.head}>
          <View style={{ flex: 1 }}>
            <Text style={styles.name}>{provider.name}</Text>
            <Text style={styles.sub}>{provider.typeLabel}</Text>
          </View>
          <StatusPill status={provider.verificationStatus} />
        </View>

        {provider.verificationStatus !== "verified" ? (
          <View style={styles.note}>
            <Text style={styles.noteText}>
              {provider.verificationStatus === "pending"
                ? "Your verification is being reviewed. Services you publish now go to review and appear to members once approved."
                : provider.verificationStatus === "rejected"
                ? `Verification wasn't approved${provider.verificationNote ? `: ${provider.verificationNote}` : "."} Update your details and resubmit.`
                : "Submit your verification details so your services can go live."}
            </Text>
            <TouchableOpacity onPress={() => navigation.navigate("ProviderProfile")} accessibilityRole="button">
              <Text style={styles.link}>Open profile</Text>
            </TouchableOpacity>
          </View>
        ) : null}
        {!provider.profileComplete ? (
          <View style={styles.note}>
            <Text style={styles.noteText}>Complete your profile to publish: {Object.values(provider.profileGaps).join(", ")}.</Text>
          </View>
        ) : null}

        {dash.isError ? <ListStateView kind="error" message="Couldn't load your figures." onRetry={() => void dash.refetch()} /> : null}

        <View style={styles.grid}>
          {tiles.map((t) => (
            <TouchableOpacity key={t.label} style={styles.tile} onPress={t.go} accessibilityRole="button" accessibilityLabel={`${t.label}: ${t.value}`}>
              <Ionicons name={t.icon} size={20} color={colors.primary} />
              <Text style={styles.tileValue}>{t.value}</Text>
              <Text style={styles.tileLabel}>{t.label}</Text>
            </TouchableOpacity>
          ))}
        </View>

        {d?.completedValueLabel ? (
          <View style={styles.card}>
            <Text style={styles.cardTitle}>Completed bookings value</Text>
            <Text style={styles.big}>{d.completedValueLabel}</Text>
            <Text style={styles.hint}>{d.completedValueNote}</Text>
          </View>
        ) : null}

        {d && d.topListings.length ? (
          <View style={styles.card}>
            <Text style={styles.cardTitle}>Most viewed</Text>
            {d.topListings.map((l) => (
              <View key={l.id} style={styles.topRow}>
                <Text style={styles.topName} numberOfLines={1}>{l.name}</Text>
                <Text style={styles.hint}>{l.views} views · {l.bookings} bookings</Text>
              </View>
            ))}
          </View>
        ) : null}

        <Button label="Create a service" variant="pill" onPress={() => navigation.navigate("ListingForm", { kind: "service" })} style={{ marginTop: 6 }} />
        <Button label="Create a package" variant="outlinePill" onPress={() => navigation.navigate("ListingForm", { kind: "package" })} style={{ marginTop: 10 }} />

        <Text style={styles.section}>Manage</Text>
        {([
          ["Bookings", "calendar-outline", () => navigation.navigate("ProviderBookings")],
          ["Services", "medkit-outline", () => navigation.navigate("ProviderListings", { kind: "service" })],
          ["Packages", "albums-outline", () => navigation.navigate("ProviderListings", { kind: "package" })],
          ["Business profile", "business-outline", () => navigation.navigate("ProviderProfile")],
          ["Notifications", "notifications-outline", () => navigation.navigate("Notifications")],
        ] as [string, Icon, () => void][]).map(([label, icon, go]) => (
          <TouchableOpacity key={label} style={styles.navRow} onPress={go} accessibilityRole="button">
            <Ionicons name={icon} size={20} color={colors.primary} />
            <Text style={styles.navText}>{label}</Text>
            <Ionicons name="chevron-forward" size={16} color={colors.tertiaryText} />
          </TouchableOpacity>
        ))}
        <Text style={styles.hint}>Availability is set per service or package, from its Availability action.</Text>
      </ScrollView>
    </Shell>
  );
}

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <ScreenContainer>
      <AppHeader title="Provider portal" />
      {children}
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  content: { paddingHorizontal: spacing.lg, paddingBottom: 40 },
  center: { flex: 1, alignItems: "center", justifyContent: "center", paddingHorizontal: 28 },
  title: { fontSize: 19, fontWeight: "700", color: colors.text, marginTop: 14, textAlign: "center" },
  body: { fontSize: 14, color: colors.secondaryText, marginTop: 8, textAlign: "center", lineHeight: 21 },
  head: { flexDirection: "row", alignItems: "center", marginTop: 6, marginBottom: 12 },
  name: { fontSize: 20, fontWeight: "700", color: colors.text },
  sub: { fontSize: 13, color: colors.secondaryText, marginTop: 2 },
  note: { backgroundColor: "#FFF1D6", borderRadius: radii.sm, padding: 12, marginBottom: 10 },
  noteText: { fontSize: 12.5, lineHeight: 18, color: "#7A4A00" },
  link: { fontSize: 13, fontWeight: "600", color: colors.primary, marginTop: 6 },
  grid: { flexDirection: "row", flexWrap: "wrap", justifyContent: "space-between", marginTop: 4 },
  tile: { width: "31.5%", backgroundColor: colors.surfaceAlt, borderRadius: radii.md, padding: 12, marginBottom: 10 },
  tileValue: { fontSize: 22, fontWeight: "700", color: colors.text, marginTop: 6 },
  tileLabel: { fontSize: 11.5, color: colors.secondaryText, marginTop: 2 },
  card: { backgroundColor: colors.surfaceAlt, borderRadius: radii.md, padding: 14, marginBottom: 10 },
  cardTitle: { fontSize: 13, fontWeight: "600", color: colors.text, marginBottom: 6 },
  big: { fontSize: 22, fontWeight: "700", color: colors.text },
  hint: { fontSize: 12, color: colors.secondaryText, marginTop: 4, lineHeight: 17 },
  topRow: { paddingVertical: 4 },
  topName: { fontSize: 14, color: colors.text },
  section: { fontSize: 13, fontWeight: "600", color: colors.secondaryText, marginTop: 22, marginBottom: 4 },
  navRow: { flexDirection: "row", alignItems: "center", paddingVertical: 13, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.border },
  navText: { flex: 1, fontSize: 15, color: colors.text, marginLeft: 12 },
});
