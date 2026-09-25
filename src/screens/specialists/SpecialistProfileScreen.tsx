import React from "react";
import { Image, ScrollView, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { Ionicons, MaterialIcons } from "@expo/vector-icons";
import ScreenContainer from "../../components/ScreenContainer";
import AppHeader from "../../components/AppHeader";
import Button from "../../components/Button";
import ReviewsList from "../../components/ReviewsList";
import Rating from "../../components/Rating";
import ListStateView from "../../components/ListStateView";
import { useSpecialistProfile } from "../../api/queries";
import { assetSource } from "../../api/assets";
import { ApiError } from "../../api/errors";
import { colors, radii, spacing } from "../../theme";
import { RootScreenProps } from "../../navigation/types";

export default function SpecialistProfileScreen({ navigation, route }: RootScreenProps<"SpecialistProfile">) {
  const { specialistId } = route.params;
  const query = useSpecialistProfile(specialistId);
  const s = query.data;

  if (!s) {
    const notFound = (query.error as ApiError | null)?.status === 404;
    return (
      <ScreenContainer>
        <AppHeader title="Specialist" />
        {query.isError ? (
          <ListStateView kind="error" title={notFound ? "Specialist not found" : undefined}
            message={notFound ? "This profile is no longer available." : "We couldn't load this profile."}
            onRetry={notFound ? undefined : () => void query.refetch()} />
        ) : <ListStateView kind="loading" />}
      </ScreenContainer>
    );
  }

  const book = (serviceId?: string) => navigation.navigate("SpecialistRequest", { specialistId, kind: "booking", serviceId });

  return (
    <ScreenContainer>
      <AppHeader title="Specialist" />
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.head}>
          <Image source={assetSource(s.photoAsset)} style={styles.photo} />
          <View style={styles.nameRow}>
            <Text style={styles.name}>{s.name}</Text>
            {s.verified ? <MaterialIcons name="verified" size={16} color={colors.success} style={{ marginLeft: 5 }} /> : null}
          </View>
          <Text style={styles.role}>{s.role}</Text>
          <View style={{ marginTop: 6 }}><Rating value={s.rating} /></View>
        </View>

        <View style={styles.card}>
          <Row icon="location-outline" text={s.locationLabel} />
          <Row icon="time-outline" text={s.availabilityLabel} />
          {s.languages ? <Row icon="language-outline" text={s.languages} /> : null}
          {s.yearsExperience ? <Row icon="ribbon-outline" text={`${s.yearsExperience} years' experience`} /> : null}
        </View>

        {s.bio ? (<><Text style={styles.section}>About</Text><Text style={styles.bio}>{s.bio}</Text></>) : null}

        <Text style={styles.section}>Services</Text>
        {s.services.length === 0 ? <Text style={styles.empty}>No services listed yet. You can still send a message.</Text> : s.services.map((sv) => (
          <TouchableOpacity key={sv.id} style={styles.svc} disabled={!s.acceptingRequests} onPress={() => book(sv.id)}
            accessibilityRole="button" accessibilityLabel={`${sv.name}, ${sv.priceLabel ?? "price on request"}. Book`}>
            <View style={{ flex: 1 }}>
              <Text style={styles.svcName}>{sv.name}</Text>
              <Text style={styles.svcDesc}>{sv.description}</Text>
              <Text style={styles.svcMeta}>{sv.durationLabel}</Text>
            </View>
            <View style={{ alignItems: "flex-end" }}>
              <Text style={styles.price}>{sv.priceLabel ?? "On request"}</Text>
              {s.acceptingRequests ? <Ionicons name="chevron-forward" size={16} color={colors.tertiaryText} /> : null}
            </View>
          </TouchableOpacity>
        ))}

        <Text style={styles.section}>Reviews</Text>
        <ReviewsList targetType="independent_specialist" targetId={s.id} />

        <View style={{ marginTop: 18 }}>
          {s.acceptingRequests ? (
            <>
              {s.services.length > 0 ? <Button label="Book a service" variant="pill" onPress={() => book()} /> : null}
              <Button label="Connect with specialist" variant={s.services.length > 0 ? "outlinePill" : "pill"}
                onPress={() => navigation.navigate("SpecialistRequest", { specialistId, kind: "connect" })} style={{ marginTop: s.services.length > 0 ? 10 : 0 }} />
            </>
          ) : (
            <Text style={styles.unavailable}>{s.name} isn't accepting new requests right now. Check back soon or browse other specialists.</Text>
          )}
          <Button label="Browse other specialists" variant="outlinePill" onPress={() => navigation.navigate("Specialists", { categoryId: s.categoryId, title: s.categoryTitle })} style={{ marginTop: 10 }} />
        </View>
      </ScrollView>
    </ScreenContainer>
  );
}

function Row({ icon, text }: { icon: React.ComponentProps<typeof Ionicons>["name"]; text: string }) {
  return (
    <View style={styles.row}>
      <Ionicons name={icon} size={16} color={colors.primary} />
      <Text style={styles.rowText}>{text}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  content: { paddingHorizontal: spacing.lg, paddingBottom: 32 },
  head: { alignItems: "center", paddingTop: 4 },
  photo: { width: 96, height: 96, borderRadius: 48, backgroundColor: colors.surfaceAlt },
  nameRow: { flexDirection: "row", alignItems: "center", marginTop: 10 },
  name: { fontSize: 19, fontWeight: "700", color: colors.text },
  role: { fontSize: 13.5, color: colors.secondaryText, marginTop: 2 },
  card: { backgroundColor: "#fff", borderRadius: radii.md, borderWidth: 1, borderColor: colors.borderLight, paddingHorizontal: 14, paddingVertical: 6, marginTop: 16 },
  row: { flexDirection: "row", alignItems: "center", paddingVertical: 8 },
  rowText: { fontSize: 13.5, color: colors.text, marginLeft: 10, flex: 1 },
  section: { fontSize: 13, fontWeight: "700", color: colors.secondaryText, textTransform: "uppercase", letterSpacing: 0.4, marginTop: 20, marginBottom: 8 },
  bio: { fontSize: 13.5, color: colors.text, lineHeight: 20 },
  empty: { fontSize: 13, color: colors.secondaryText },
  svc: { flexDirection: "row", backgroundColor: "#fff", borderRadius: radii.md, borderWidth: 1, borderColor: colors.borderLight, padding: 14, marginBottom: 10 },
  svcName: { fontSize: 14.5, fontWeight: "600", color: colors.text },
  svcDesc: { fontSize: 12.5, color: colors.secondaryText, marginTop: 3, lineHeight: 17 },
  svcMeta: { fontSize: 11.5, color: colors.tertiaryText, marginTop: 4 },
  price: { fontSize: 13.5, fontWeight: "700", color: colors.primary },
  unavailable: { fontSize: 13, color: colors.secondaryText, lineHeight: 19, textAlign: "center" },
});
