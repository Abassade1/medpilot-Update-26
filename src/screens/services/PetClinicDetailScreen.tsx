import React from "react";
import { Image, ScrollView, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import ScreenContainer from "../../components/ScreenContainer";
import AppHeader from "../../components/AppHeader";
import Button from "../../components/Button";
import ReviewsList from "../../components/ReviewsList";
import Rating from "../../components/Rating";
import ListStateView from "../../components/ListStateView";
import { usePetClinic } from "../../api/queries";
import { assetSource } from "../../api/assets";
import { ApiError } from "../../api/errors";
import { colors, radii, spacing } from "../../theme";
import { RootScreenProps } from "../../navigation/types";

export default function PetClinicDetailScreen({ navigation, route }: RootScreenProps<"PetClinicDetail">) {
  const { clinicId } = route.params;
  const query = usePetClinic(clinicId);
  const c = query.data;

  if (!c) {
    const notFound = (query.error as ApiError | null)?.status === 404;
    return (
      <ScreenContainer>
        <AppHeader title="Pet Specialist" />
        {query.isError ? (
          <ListStateView kind="error" title={notFound ? "Provider not found" : undefined}
            message={notFound ? "This provider is no longer listed." : "We couldn't load this provider."}
            onRetry={notFound ? undefined : () => void query.refetch()} />
        ) : <ListStateView kind="loading" />}
      </ScreenContainer>
    );
  }

  const go = (kind: "appointment" | "sitting", serviceId?: string) =>
    navigation.navigate("PetRequest", { clinicId, kind, serviceId });

  return (
    <ScreenContainer>
      <AppHeader title="Pet Specialist" />
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        {c.heroAsset ? <Image source={assetSource(c.heroAsset)} style={styles.hero} /> : null}
        <View style={styles.headRow}>
          <Text style={styles.emoji}>{c.logoEmoji}</Text>
          <View style={{ flex: 1, marginLeft: 10 }}>
            <Text style={styles.name}>{c.name}</Text>
            <Text style={styles.sub}>{c.location}</Text>
          </View>
          <Rating value={c.rating} />
        </View>
        <Text style={styles.desc}>{c.description}</Text>
        <Text style={styles.meta}>Open to: {c.openTo}</Text>

        <Text style={styles.section}>Services</Text>
        {c.services.length === 0 ? (
          <Text style={styles.empty}>This provider hasn't listed any services yet.</Text>
        ) : (
          c.services.map((sv) => {
            const kind = sv.kind ?? "appointment";
            const allowed = kind === "sitting" ? c.canRequestSitting : c.canBookAppointment;
            return (
              <TouchableOpacity
                key={sv.id}
                style={[styles.svc, !allowed && { opacity: 0.5 }]}
                disabled={!allowed}
                onPress={() => go(kind, sv.id)}
                accessibilityRole="button"
                accessibilityLabel={`${sv.name}, ${sv.priceLabel ?? "price on request"}. ${kind === "sitting" ? "Request sitting" : "Book appointment"}`}
              >
                <View style={{ flex: 1 }}>
                  <Text style={styles.svcName}>{sv.name}</Text>
                  <Text style={styles.svcDesc}>{sv.description}</Text>
                  <Text style={styles.svcMeta}>{sv.durationLabel}{kind === "sitting" ? " · Sitting request" : ""}</Text>
                </View>
                <View style={{ alignItems: "flex-end" }}>
                  <Text style={styles.price}>{sv.priceLabel ?? "On request"}</Text>
                  <Ionicons name="chevron-forward" size={16} color={colors.tertiaryText} />
                </View>
              </TouchableOpacity>
            );
          })
        )}

        <Text style={styles.section}>Reviews</Text>
        <ReviewsList targetType="pet_clinic" targetId={c.id} />

        <View style={{ marginTop: 20 }}>
          {c.canBookAppointment ? <Button label="Book appointment" variant="pill" onPress={() => go("appointment")} /> : null}
          {c.canRequestSitting ? (
            <Button label="Request pet sitting" variant={c.canBookAppointment ? "outlinePill" : "pill"} onPress={() => go("sitting")} style={{ marginTop: 10 }} />
          ) : null}
          {!c.canBookAppointment && !c.canRequestSitting ? (
            <Text style={styles.empty}>This provider isn't accepting requests right now.</Text>
          ) : null}
        </View>
      </ScrollView>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  content: { paddingHorizontal: spacing.lg, paddingBottom: 32 },
  hero: { width: "100%", height: 170, borderRadius: radii.md, marginBottom: 14, backgroundColor: colors.surfaceAlt },
  headRow: { flexDirection: "row", alignItems: "center" },
  emoji: { fontSize: 32 },
  name: { fontSize: 18, fontWeight: "700", color: colors.text },
  sub: { fontSize: 13, color: colors.secondaryText, marginTop: 2 },
  desc: { fontSize: 13.5, color: colors.text, lineHeight: 20, marginTop: 12 },
  meta: { fontSize: 12.5, color: colors.secondaryText, marginTop: 8 },
  section: { fontSize: 13, fontWeight: "700", color: colors.secondaryText, textTransform: "uppercase", letterSpacing: 0.4, marginTop: 20, marginBottom: 8 },
  empty: { fontSize: 13, color: colors.secondaryText, paddingVertical: 8 },
  svc: { flexDirection: "row", backgroundColor: "#fff", borderRadius: radii.md, borderWidth: 1, borderColor: colors.borderLight, padding: 14, marginBottom: 10 },
  svcName: { fontSize: 14.5, fontWeight: "600", color: colors.text },
  svcDesc: { fontSize: 12.5, color: colors.secondaryText, marginTop: 3, lineHeight: 17 },
  svcMeta: { fontSize: 11.5, color: colors.tertiaryText, marginTop: 4 },
  price: { fontSize: 13.5, fontWeight: "700", color: colors.primary },
});
