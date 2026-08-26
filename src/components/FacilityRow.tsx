import React from "react";
import { View, Text, StyleSheet, TouchableOpacity } from "react-native";
import LogoBox from "./LogoBox";
import { assetSource } from "../api/assets";
import type { HospitalCard } from "../api/types";
import { colors } from "../theme";

interface Props {
  hospital: HospitalCard;
  onPress?: () => void;
}

/** Fallback monogram when a catalog row has no logo asset. */
function initials(name: string): string {
  return name.split(/\s+/).slice(0, 2).map((w) => w[0] ?? "").join("").toUpperCase();
}

export default function FacilityRow({ hospital, onPress }: Props) {
  return (
    <TouchableOpacity
      style={styles.row}
      activeOpacity={0.7}
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`${hospital.name}, ${hospital.specialty}, ${hospital.country}, ${hospital.specialistCount} specialists`}
    >
      <LogoBox text={initials(hospital.name)} color={colors.surfaceAlt} image={assetSource(hospital.logoAsset)} />
      <View style={styles.info}>
        <Text style={styles.name} numberOfLines={1}>
          {hospital.name}
        </Text>
        <Text style={styles.specialty} numberOfLines={1}>
          {hospital.specialty}
        </Text>
      </View>
      <View style={styles.meta}>
        <Text style={styles.country}>{hospital.country}</Text>
        <Text style={styles.specialists}>{hospital.specialistCount} Specialists</Text>
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: colors.borderLight,
  },
  info: { flex: 1, marginLeft: 12 },
  name: { fontSize: 14, fontWeight: "600", color: colors.text },
  specialty: { fontSize: 12, color: colors.secondaryText, marginTop: 3 },
  meta: { alignItems: "flex-end", marginLeft: 8 },
  country: { fontSize: 12, fontWeight: "500", color: colors.text },
  specialists: { fontSize: 12, color: colors.secondaryText, marginTop: 3 },
});
