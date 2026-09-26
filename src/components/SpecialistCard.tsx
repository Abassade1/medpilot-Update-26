import React from "react";
import { View, Text, StyleSheet, TouchableOpacity, Image } from "react-native";
import { assetSource } from "../api/assets";
import { images } from "../data/assets";
import type { HospitalSpecialistDto } from "../api/types";
import { colors, radii, shadows } from "../theme";

interface Props {
  specialist: HospitalSpecialistDto;
  onPress?: () => void;
}

export default function SpecialistCard({ specialist, onPress }: Props) {
  return (
    <TouchableOpacity
      style={styles.card}
      activeOpacity={0.8}
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`${specialist.name}, ${specialist.role}`}
    >
      <Image source={assetSource(specialist.photoAsset, images.doctor1)} style={styles.photo} />
      <View style={styles.body}>
        <Text style={styles.name} numberOfLines={1}>
          {specialist.cardName}
        </Text>
        <Text style={styles.role} numberOfLines={2}>
          {specialist.role}
        </Text>
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  card: {
    width: 148,
    backgroundColor: "#fff",
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: colors.borderLight,
    marginRight: 12,
    overflow: "hidden",
    ...shadows.card,
  },
  photo: { width: "100%", height: 88 },
  body: { padding: 10 },
  name: { fontSize: 12.5, fontWeight: "700", color: colors.text },
  role: { fontSize: 11.5, color: colors.secondaryText, marginTop: 4, lineHeight: 15 },
});
