import React from "react";
import { View, Text, StyleSheet, TouchableOpacity } from "react-native";
import LogoBox from "./LogoBox";
import { Hospital } from "../data/mock";
import { colors } from "../theme";

interface Props {
  hospital: Hospital;
  onPress?: () => void;
}

export default function FacilityRow({ hospital, onPress }: Props) {
  return (
    <TouchableOpacity
      style={styles.row}
      activeOpacity={0.7}
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`${hospital.name}, ${hospital.specialty}, ${hospital.country}, ${hospital.specialists} specialists`}
    >
      <LogoBox text={hospital.logoText} color={hospital.logoColor} image={hospital.logo} />
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
        <Text style={styles.specialists}>{hospital.specialists} Specialists</Text>
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
