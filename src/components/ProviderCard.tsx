import React from "react";
import { View, Text, StyleSheet, TouchableOpacity, Image, ImageSourcePropType } from "react-native";
import { MaterialIcons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import Rating from "./Rating";
import { colors, radii, shadows } from "../theme";

interface Props {
  image: ImageSourcePropType;
  price: string;
  logo: React.ReactNode;
  name: string;
  location: string;
  rating: number | null;
  verified?: boolean;
  description: string;
  routesLabel: string;
  routes: string;
  onPress?: () => void;
}

/** Large service-provider card: photo w/ price overlay, provider row, description, routes. */
export default function ProviderCard({
  image,
  price,
  logo,
  name,
  location,
  rating,
  verified,
  description,
  routesLabel,
  routes,
  onPress,
}: Props) {
  return (
    <TouchableOpacity
      style={styles.card}
      activeOpacity={0.85}
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`${name}, ${location}, ${rating == null ? "no reviews yet" : `rated ${rating.toFixed(1)}`}, from ${price}`}
    >
      <View style={styles.imageWrap}>
        <Image source={image} style={styles.image} />
        <LinearGradient colors={["transparent", "rgba(2,8,20,0.75)"]} style={styles.scrim} />
        <View style={styles.priceOverlay}>
          <Text style={styles.priceLabel}>Service from</Text>
          <Text style={styles.price}>{price}</Text>
        </View>
      </View>
      <View style={styles.body}>
        <View style={styles.providerRow}>
          {logo}
          <View style={styles.providerInfo}>
            <View style={styles.nameRow}>
              <Text style={styles.name} numberOfLines={1}>
                {name}
              </Text>
              {verified && <MaterialIcons name="verified" size={15} color={colors.success} style={{ marginLeft: 4 }} />}
            </View>
            <Text style={styles.location}>{location}</Text>
          </View>
          <Rating value={rating} />
        </View>
        <Text style={styles.description} numberOfLines={2}>
          {description}
        </Text>
        <Text style={styles.routesLabel}>{routesLabel}</Text>
        <Text style={styles.routes} numberOfLines={1}>
          {routes}
        </Text>
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: "#fff",
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: colors.borderLight,
    marginBottom: 18,
    overflow: "hidden",
    ...shadows.card,
  },
  imageWrap: { height: 168 },
  image: { width: "100%", height: "100%" },
  scrim: { position: "absolute", left: 0, right: 0, bottom: 0, height: "55%" },
  priceOverlay: {
    position: "absolute",
    left: 12,
    bottom: 10,
  },
  priceLabel: { color: "#E5E7EB", fontSize: 11 },
  price: { color: "#fff", fontSize: 20, fontWeight: "700", marginTop: 1 },
  body: { padding: 12 },
  providerRow: { flexDirection: "row", alignItems: "center" },
  providerInfo: { flex: 1, marginHorizontal: 10 },
  nameRow: { flexDirection: "row", alignItems: "center" },
  name: { fontSize: 13.5, fontWeight: "700", color: colors.text, flexShrink: 1 },
  location: { fontSize: 12, color: colors.secondaryText, marginTop: 2 },
  description: { fontSize: 13, color: colors.text, lineHeight: 18, marginTop: 10 },
  routesLabel: { fontSize: 13, fontWeight: "700", color: colors.text, marginTop: 10 },
  routes: { fontSize: 12.5, color: colors.primary, marginTop: 4, fontWeight: "500" },
});
