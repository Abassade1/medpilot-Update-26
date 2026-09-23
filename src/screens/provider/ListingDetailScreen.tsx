import React from "react";
import { Image, ScrollView, StyleSheet, Text, View } from "react-native";
import ScreenContainer from "../../components/ScreenContainer";
import AppHeader from "../../components/AppHeader";
import Button from "../../components/Button";
import ListStateView from "../../components/ListStateView";
import { useListingDetail } from "../../api/queries";
import { formatTime } from "../../utils/dates";
import { colors, radii, spacing } from "../../theme";
import { RootScreenProps } from "../../navigation/types";

const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

export default function ListingDetailScreen({ navigation, route }: RootScreenProps<"ListingDetail">) {
  const { listingId, preview } = route.params;
  const q = useListingDetail(listingId, !!preview);
  const l = q.data;
  if (!l) {
    return (
      <ScreenContainer>
        <AppHeader title="Details" />
        {q.isError ? <ListStateView kind="error" title="Not available" message="This listing isn't available. It may have been unpublished." onRetry={() => void q.refetch()} /> : <ListStateView kind="loading" message="Loading…" />}
      </ScreenContainer>
    );
  }
  const p = l.providerProfile;
  const live = l.status === "published";
  const Section = ({ title, text }: { title: string; text?: string }) => (text ? <View style={styles.sec}><Text style={styles.h}>{title}</Text><Text style={styles.body}>{text}</Text></View> : null);

  return (
    <ScreenContainer>
      <AppHeader title={l.kind === "package" ? "Package" : "Service"} />
      <ScrollView contentContainerStyle={styles.content}>
        {l.preview && !live ? <Text style={styles.banner}>Preview only. Members can't see this until it's published.</Text> : null}
        {l.images[0] ? <Image source={{ uri: l.images[0] }} style={styles.img} accessibilityIgnoresInvertColors /> : null}
        <Text style={styles.cat}>{l.category.label}{l.subcategory.label ? ` · ${l.subcategory.label}` : ""}</Text>
        <Text style={styles.name}>{l.name}</Text>
        <Text style={styles.price}>{l.priceLabel}{l.durationMinutes ? ` · ${l.durationMinutes} min` : ""}</Text>
        <Text style={styles.meta}>{p.name}{p.verified ? " · Verified" : ""} · {p.typeLabel}</Text>
        <Text style={styles.meta}>{[l.city, l.region, l.country].filter(Boolean).join(", ")}</Text>
        {l.locationLabels.length ? <Text style={styles.meta}>{l.locationLabels.join(" · ")}{l.serviceRadiusKm ? ` · within ${l.serviceRadiusKm} km` : ""}</Text> : null}

        <Section title="About" text={l.description} />
        {l.details.length ? (
          <View style={styles.sec}>
            <Text style={styles.h}>Details</Text>
            {l.details.map((d) => <View key={d.label} style={styles.kv}><Text style={styles.k}>{d.label}</Text><Text style={styles.v}>{d.value}</Text></View>)}
          </View>
        ) : null}
        {l.includes.length ? (
          <View style={styles.sec}>
            <Text style={styles.h}>What's included</Text>
            {l.includes.map((i, n) => <Text key={n} style={styles.body}>• {i.label}</Text>)}
          </View>
        ) : null}
        {l.availability.length ? (
          <View style={styles.sec}>
            <Text style={styles.h}>Availability</Text>
            {l.availability.map((w, n) => <Text key={n} style={styles.body}>{DAYS[w.weekday]}  {formatTime(w.start)} – {formatTime(w.end)}</Text>)}
          </View>
        ) : <Text style={styles.warn}>No availability has been set, so this can't be booked online.</Text>}
        <Section title="What you need" text={l.requirements} />
        <Section title="Preparation" text={l.preparation} />
        <Section title="Cancellation policy" text={l.cancellationPolicy} />
        <Section title="Terms" text={l.terms} />
        <View style={styles.sec}>
          <Text style={styles.h}>About the provider</Text>
          <Text style={styles.body}>{p.description || p.name}</Text>
          {p.languages.length ? <Text style={styles.meta}>Languages: {p.languages.join(", ")}</Text> : null}
          {p.operatingHours ? <Text style={styles.meta}>Hours: {p.operatingHours}</Text> : null}
          {p.certifications ? <Text style={styles.meta}>Certifications: {p.certifications}</Text> : null}
          {p.phone ? <Text style={styles.meta}>Phone: {p.phone}</Text> : null}
        </View>

        {l.preview ? (
          <Button label="Back to editing" variant="outlinePill" onPress={() => navigation.goBack()} style={{ marginTop: 16 }} />
        ) : l.isOwner ? (
          <Text style={styles.warn}>This is your own listing, so it can't be booked from this account.</Text>
        ) : (
          <Button label={l.bookable ? "Book now" : "Not bookable yet"} variant="pill" disabled={!l.bookable} onPress={() => navigation.navigate("ListingBook", { listingId })} style={{ marginTop: 16 }} />
        )}
      </ScrollView>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  content: { paddingHorizontal: spacing.lg, paddingBottom: 40 },
  banner: { backgroundColor: "#FFF1D6", color: "#7A4A00", padding: 10, borderRadius: radii.sm, fontSize: 12.5, marginBottom: 12, overflow: "hidden" },
  img: { width: "100%", height: 180, borderRadius: radii.md, marginBottom: 12, backgroundColor: colors.surfaceAlt },
  cat: { fontSize: 12, fontWeight: "700", color: colors.primary, letterSpacing: 0.5 },
  name: { fontSize: 22, fontWeight: "700", color: colors.text, marginTop: 4 },
  price: { fontSize: 16, fontWeight: "600", color: colors.text, marginTop: 6 },
  meta: { fontSize: 13, color: colors.secondaryText, marginTop: 4, lineHeight: 18 },
  sec: { marginTop: 20 },
  h: { fontSize: 15, fontWeight: "700", color: colors.text, marginBottom: 6 },
  body: { fontSize: 14, color: colors.text, lineHeight: 21 },
  kv: { flexDirection: "row", paddingVertical: 4 },
  k: { width: 130, fontSize: 13, color: colors.secondaryText },
  v: { flex: 1, fontSize: 13.5, color: colors.text },
  warn: { fontSize: 13, color: "#7A4A00", backgroundColor: "#FFF1D6", padding: 10, borderRadius: radii.sm, marginTop: 16, overflow: "hidden" },
});
