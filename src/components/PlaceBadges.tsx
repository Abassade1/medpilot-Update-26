import React from "react";
import { Linking, View } from "react-native";
import { Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";
import Chip from "./Chip";
import { colors } from "../theme";
import { useT } from "../i18n";

/** Directions (opens Maps), an optional Verified badge, and the rating. Only real data is shown. */
export default function PlaceBadges({
  name, location, rating, verified,
}: { name: string; location?: string; rating: number | null; verified?: boolean }) {
  const tr = useT();
  const query = encodeURIComponent([name, location].filter(Boolean).join(" "));
  return (
    <View style={{ flexDirection: "row", marginTop: 14 }}>
      <Chip
        label={tr("Directions")}
        elevated
        onPress={() => void Linking.openURL(`http://maps.apple.com/?q=${query}`)}
        icon={<MaterialCommunityIcons name="compass" size={16} color="#8C2B1E" />}
      />
      {verified ? (
        <Chip label={tr("Verified")} elevated style={{ marginLeft: 10 }} icon={<MaterialCommunityIcons name="shield-check" size={16} color={colors.success} />} />
      ) : null}
      <Chip
        label={rating == null ? tr("No reviews yet") : rating.toFixed(1)}
        elevated
        style={{ marginLeft: 10 }}
        icon={<Ionicons name={rating == null ? "star-outline" : "star"} size={14} color={rating == null ? colors.tertiaryText : colors.warning} />}
      />
    </View>
  );
}
