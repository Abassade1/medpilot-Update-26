import React from "react";
import { View, Text, StyleSheet, FlatList, Image, TouchableOpacity } from "react-native";
import { Ionicons, MaterialIcons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import ListStateView from "../../components/ListStateView";
import ScreenContainer from "../../components/ScreenContainer";
import AppHeader from "../../components/AppHeader";
import SearchBar from "../../components/SearchBar";
import Rating from "../../components/Rating";
import LogoBox from "../../components/LogoBox";
import { hospitals, medicalPackages } from "../../data/mock";
import { colors, radii, shadows, spacing } from "../../theme";
import { RootScreenProps } from "../../navigation/types";

export default function MedicalPackagesScreen({ navigation }: RootScreenProps<"MedicalPackages">) {
  return (
    <ScreenContainer>
      <AppHeader
        right={
          <TouchableOpacity hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
            <Ionicons name="options-outline" size={20} color={colors.text} />
          </TouchableOpacity>
        }
      />
      <FlatList
        data={medicalPackages}
        keyExtractor={(p) => p.id}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.list}
        ListEmptyComponent={<ListStateView kind="empty" title="Nothing to show" message="No packages are available right now." />}
        ListHeaderComponent={
          <View>
            <Text style={styles.title}>Medical Packages</Text>
            <SearchBar style={{ marginTop: 14, marginBottom: 18 }} />
          </View>
        }
        renderItem={({ item }) => {
          const hospital = hospitals.find((h) => h.id === item.hospitalId)!;
          return (
            <TouchableOpacity
              style={styles.card}
              activeOpacity={0.9}
              onPress={() => navigation.navigate("PackageDetail", { packageId: item.id })}
            >
              <View style={styles.imageWrap}>
                <Image source={item.image} style={styles.image} />
                <LinearGradient colors={["transparent", "rgba(2,8,20,0.75)"]} style={styles.scrim} />
                <View style={styles.overlayRow}>
                  <Text style={styles.overlayTitle}>{item.title}</Text>
                  <Text style={styles.overlayPrice}>{item.price}</Text>
                </View>
              </View>
              <View style={styles.body}>
                <View style={styles.hospitalRow}>
                  <LogoBox text={hospital.logoText} color={hospital.logoColor} size={30} image={hospital.logo} />
                  <Text style={styles.hospitalName} numberOfLines={1}>
                    {hospital.name}
                  </Text>
                  <MaterialIcons name="verified" size={14} color={colors.success} />
                  <View style={{ marginLeft: 8 }}>
                    <Rating value={item.rating} size={12} />
                  </View>
                </View>
                <Text style={styles.location}>{item.location}</Text>
                <Text style={styles.desc} numberOfLines={2}>
                  {item.description}
                </Text>
                <Text style={styles.includeLabel}>Package Include</Text>
                <Text style={styles.include}>{item.packageInclude.join(" | ")}</Text>
              </View>
            </TouchableOpacity>
          );
        }}
      />
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  list: { paddingHorizontal: spacing.lg, paddingBottom: 32 },
  title: { fontSize: 24, fontWeight: "700", color: colors.text, marginTop: 4 },
  card: {
    backgroundColor: "#fff",
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: colors.borderLight,
    marginBottom: 18,
    overflow: "hidden",
    ...shadows.card,
  },
  imageWrap: { height: 150 },
  image: { width: "100%", height: "100%" },
  scrim: { position: "absolute", left: 0, right: 0, bottom: 0, height: "55%" },
  overlayRow: {
    position: "absolute",
    left: 12,
    right: 12,
    bottom: 10,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  overlayTitle: { color: "#fff", fontSize: 14.5, fontWeight: "700", flexShrink: 1 },
  overlayPrice: { color: "#fff", fontSize: 14.5, fontWeight: "700" },
  body: { padding: 12 },
  hospitalRow: { flexDirection: "row", alignItems: "center" },
  hospitalName: { fontSize: 12.5, fontWeight: "600", color: colors.text, marginHorizontal: 6, flexShrink: 1 },
  location: { fontSize: 11.5, color: colors.secondaryText, marginTop: 4, marginLeft: 38 },
  desc: { fontSize: 12.5, color: colors.secondaryText, lineHeight: 17, marginTop: 8 },
  includeLabel: { fontSize: 12.5, fontWeight: "700", color: colors.text, marginTop: 8 },
  include: { fontSize: 12, color: colors.primary, marginTop: 3, fontWeight: "500" },
});
