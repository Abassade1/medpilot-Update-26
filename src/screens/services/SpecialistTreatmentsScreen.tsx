import React from "react";
import { View, Text, StyleSheet, FlatList, Image, TouchableOpacity } from "react-native";
import { MaterialIcons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import ListStateView from "../../components/ListStateView";
import ScreenContainer from "../../components/ScreenContainer";
import AppHeader from "../../components/AppHeader";
import SearchBar from "../../components/SearchBar";
import Rating from "../../components/Rating";
import LogoBox from "../../components/LogoBox";
import { usePackages } from "../../api/queries";
import { assetSource } from "../../api/assets";
import { colors, radii, shadows, spacing } from "../../theme";
import { RootScreenProps } from "../../navigation/types";

export default function SpecialistTreatmentsScreen({ navigation }: RootScreenProps<"SpecialistTreatments">) {
  const packagesQuery = usePackages();
  return (
    <ScreenContainer>
      <AppHeader />
      <FlatList
        data={packagesQuery.data ?? []}
        keyExtractor={(p) => p.id}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.list}
        ListEmptyComponent={
          packagesQuery.isPending ? <ListStateView kind="loading" /> :
          packagesQuery.isError ? <ListStateView kind="error" onRetry={() => void packagesQuery.refetch()} /> :
          <ListStateView kind="empty" title="Nothing to show" message="No treatments are available right now." />
        }
        ListHeaderComponent={
          <View>
            <Text style={styles.title}>Specialist Treatments</Text>
            <SearchBar style={{ marginTop: 14, marginBottom: 18 }} />
          </View>
        }
        renderItem={({ item }) => {
          const hospital = item.hospital;
          return (
            <TouchableOpacity
              style={styles.card}
              activeOpacity={0.9}
              onPress={() => navigation.navigate("PackageDetail", { packageId: item.id })}
            >
              <View style={styles.imageWrap}>
                <Image source={assetSource(item.heroAsset)} style={styles.image} />
                <LinearGradient colors={["transparent", "rgba(2,8,20,0.75)"]} style={styles.scrim} />
                <View style={styles.overlayRow}>
                  <Text style={styles.overlayTitle}>{item.title}</Text>
                  <Text style={styles.overlayPrice}>{item.priceLabel.toUpperCase()}</Text>
                </View>
              </View>
              <View style={styles.body}>
                <View style={styles.hospitalRow}>
                  <LogoBox text={hospital.name.slice(0, 2).toUpperCase()} color={colors.surfaceAlt} size={30} image={assetSource(hospital.logoAsset)} />
                  <Text style={styles.hospitalName} numberOfLines={1}>
                    {hospital.name}
                  </Text>
                  {hospital.accredited ? <MaterialIcons name="verified" size={14} color={colors.success} /> : null}
                  <View style={{ marginLeft: 8 }}>
                    <Rating value={item.rating} size={12} />
                  </View>
                </View>
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
  desc: { fontSize: 12.5, color: colors.secondaryText, lineHeight: 17, marginTop: 8 },
  includeLabel: { fontSize: 12.5, fontWeight: "700", color: colors.text, marginTop: 8 },
  include: { fontSize: 12, color: colors.primary, marginTop: 3, fontWeight: "500" },
});
