import React from "react";
import { Linking, View } from "react-native";
import { Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";
import Chip from "./Chip";
import { colors } from "../theme";

/** Directions (opens Maps), an optional Verified badge, and the rating. Only real data is shown. */
export default function PlaceBadges({
  name, location, rating, verified,
}: { name: string; location?: string; rating: number; verified?: boolean }) {
  const query = encodeURIComponent([name, location].filter(Boolean).join(" "));
  return (
    <View style={{ flexDirection: "row", marginTop: 14 }}>
      <Chip
        label="Directions"
        elevated
        onPress={() => void Linking.openURL(`http://maps.apple.com/?q=${query}`)}
        icon={<MaterialCommunityIcons name="compass" size={16} color="#8C2B1E" />}
      />
      {verified ? (
        <Chip label="Verified" elevated style={{ marginLeft: 10 }} icon={<MaterialCommunityIcons name="shield-check" size={16} color={colors.success} />} />
      ) : null}
      <Chip label={rating.toFixed(1)} elevated style={{ marginLeft: 10 }} icon={<Ionicons name="star" size={14} color={colors.warning} />} />
    </View>
  );
}
