import React, { useRef, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  Image,
  TouchableOpacity,
  FlatList,
  useWindowDimensions,
  NativeScrollEvent,
  NativeSyntheticEvent,
  ScrollView,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { useNavigation } from "@react-navigation/native";
import ScreenContainer from "../../components/ScreenContainer";
import SectionHeader from "../../components/SectionHeader";
import FacilityRow from "../../components/FacilityRow";
import { images } from "../../data/assets";
import { assetSource } from "../../api/assets";
import { useHome, useMe, useNotifications } from "../../api/queries";
import ListStateView from "../../components/ListStateView";
import { openService } from "../../utils/serviceRoutes";
import type { ServiceDto } from "../../api/types";
import { colors, MAX_CONTENT_WIDTH, radii, spacing } from "../../theme";

export default function HomeScreen() {
  const navigation = useNavigation();
  const home = useHome();
  const me = useMe();
  const notifications = useNotifications();
  const { width: windowWidth } = useWindowDimensions();
  // Card sizes scale from the content column, which is capped on tablets.
  const width = Math.min(windowWidth, MAX_CONTENT_WIDTH);
  const heroWidth = width - spacing.lg * 2;
  // Card geometry is kept proportional to the 430pt Figma frame so the
  // composition holds its designed ratios on any screen width.
  const heroHeight = Math.round(heroWidth / 1.378);
  const svcWidth = Math.round(width * 0.395);
  const svcHeight = Math.round(svcWidth * 1.294);
  const pkgWidth = Math.round(width * 0.744);
  const pkgHeight = Math.round(pkgWidth * 0.816);
  const indieWidth = Math.round(width * 0.43);
  const indieHeight = Math.round(indieWidth * 1.054);
  const [heroIndex, setHeroIndex] = useState(0);

  const onHeroScroll = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    const i = Math.round(e.nativeEvent.contentOffset.x / (heroWidth + 12));
    if (i !== heroIndex) setHeroIndex(i);
  };

  const goService = (service: ServiceDto) => openService(navigation, service);

  return (
    <ScreenContainer scroll backgroundColor={colors.background}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity
          onPress={() => navigation.navigate("Profile")}
          accessibilityRole="button"
          accessibilityLabel="Open your profile"
        >
          <Image source={assetSource(me.data?.profile?.avatarAsset, images.avatar)} style={styles.avatar} />
        </TouchableOpacity>
        <View style={styles.headerInfo}>
          <Text style={styles.hello}>
            👋🏽 Hi, {me.data?.profile?.fullName ?? "there"}
          </Text>
          <TouchableOpacity
            style={styles.locationRow}
            activeOpacity={0.7}
            onPress={() => navigation.navigate("EditProfile")}
            accessibilityRole="button"
            accessibilityLabel="Change your location"
          >
            <Ionicons name="location-sharp" size={13} color={colors.primary} />
            <Text style={styles.location}>{me.data?.profile?.locationLabel ?? "—"}</Text>
            <Ionicons name="chevron-down" size={13} color={colors.text} style={{ marginLeft: 14 }} />
          </TouchableOpacity>
        </View>
        <TouchableOpacity
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          onPress={() => navigation.navigate("Notifications")}
          accessibilityRole="button"
          accessibilityLabel={
            notifications.data?.unreadCount
              ? `Notifications, ${notifications.data.unreadCount} unread`
              : "Notifications"
          }
        >
          <Ionicons name="notifications" size={22} color={colors.primary} />
          {!!notifications.data?.unreadCount && <View style={styles.badge} />}
        </TouchableOpacity>
      </View>

      {/* Hero carousel */}
      <FlatList
        data={home.data?.heroSlides ?? []}
        horizontal
        pagingEnabled={false}
        snapToInterval={heroWidth + 12}
        decelerationRate="fast"
        showsHorizontalScrollIndicator={false}
        keyExtractor={(s) => s.id}
        onScroll={onHeroScroll}
        scrollEventThrottle={16}
        contentContainerStyle={{ paddingHorizontal: spacing.lg }}
        renderItem={({ item }) => (
          <TouchableOpacity
            activeOpacity={0.9}
            style={[styles.hero, { width: heroWidth, height: heroHeight }]}
            onPress={() =>
              item.packageId
                ? navigation.navigate("PackageDetail", { packageId: item.packageId })
                : navigation.navigate("MedicalPackages")
            }
          >
            <Image source={assetSource(item.imageAsset, images.cancer)} style={styles.heroImage} />
            <LinearGradient
              colors={["transparent", "rgba(2,8,20,0.85)"]}
              style={styles.heroGradient}
            />
            <View style={styles.heroTextWrap}>
              <View style={styles.heroTitleRow}>
                <Text style={styles.heroTitle} numberOfLines={1}>
                  {item.title}
                </Text>
                <Text style={styles.heroPrice}>{item.priceLabel}</Text>
              </View>
              <Text style={styles.heroSubtitle}>{item.subtitle}</Text>
            </View>
          </TouchableOpacity>
        )}
      />
      <View style={styles.dots}>
        {(home.data?.heroSlides ?? []).map((s, i) => (
          <View key={s.id} style={[styles.dot, i === heroIndex ? styles.dotActive : styles.dotInactive]} />
        ))}
      </View>

      {/* Services */}
      <View style={styles.section}>
        <SectionHeader title="Services" onViewAll={() => navigation.navigate("Services")} />
      </View>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={{ paddingHorizontal: spacing.lg }}
      >
        {(home.data?.services ?? []).map((service) => (
          <TouchableOpacity
            key={service.id}
            style={[styles.serviceCard, { backgroundColor: service.color, width: svcWidth, height: svcHeight }]}
            activeOpacity={0.85}
            onPress={() => goService(service)}
          >
            <View>
              <Text style={styles.serviceTitle}>{service.title}</Text>
              <Text style={styles.serviceDesc}>{service.description}</Text>
            </View>
            <Image source={assetSource(service.imageAsset)} style={styles.serviceImage} resizeMode="contain" />
          </TouchableOpacity>
        ))}
      </ScrollView>

      {/* Medical Packages */}
      <View style={styles.section}>
        <SectionHeader title="Medical Packages" onViewAll={() => navigation.navigate("MedicalPackages")} />
      </View>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={{ paddingHorizontal: spacing.lg }}
      >
        {(home.data?.packages ?? []).map((pkg) => (
          <TouchableOpacity
            key={pkg.id}
            style={[styles.packageCard, { width: pkgWidth, height: pkgHeight }]}
            activeOpacity={0.9}
            onPress={() => navigation.navigate("PackageDetail", { packageId: pkg.id })}
          >
            <Image source={assetSource(pkg.heroAsset, images.cardiacTreatment)} style={styles.packageImage} />
            <LinearGradient colors={["transparent", "rgba(2,8,20,0.85)"]} style={styles.heroGradient} />
            <View style={styles.packageTextWrap}>
              <Text style={styles.packageTitle}>{pkg.title.replace(" specialist", " Treatment")}</Text>
              <Text style={styles.packageSubtitle}>{pkg.hospital?.name ?? "View package"}</Text>
            </View>
          </TouchableOpacity>
        ))}
      </ScrollView>

      {/* Independent Specialist */}
      <View style={styles.section}>
        <SectionHeader title="Independent Specialist" onViewAll={() => navigation.navigate("Specialists")} />
      </View>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={{ paddingHorizontal: spacing.lg }}
      >
        {(home.data?.independentSpecialists ?? []).map((cat) => (
          <TouchableOpacity
            key={cat.id}
            style={[styles.indieCard, { width: indieWidth, height: indieHeight }]}
            activeOpacity={0.9}
            onPress={() => navigation.navigate("Specialists", { categoryId: cat.id, title: cat.title })}
            accessibilityRole="button"
            accessibilityLabel={`${cat.title}, ${cat.count}`}
          >
            <Image source={assetSource(cat.imageAsset, images.privateNurse)} style={styles.indieImage} />
            <LinearGradient colors={["transparent", "rgba(2,8,20,0.85)"]} style={styles.heroGradient} />
            <View style={styles.indieTextWrap}>
              <Text style={styles.indieTitle}>{cat.title}</Text>
              <Text style={styles.indieCount}>{cat.count}</Text>
            </View>
          </TouchableOpacity>
        ))}
      </ScrollView>

      {/* Top Facilities */}
      <View style={[styles.section, { marginBottom: 0 }]}>
        <SectionHeader title="Top Facilities" onViewAll={() => navigation.navigate("Hospitals")} />
        {home.isPending && <ListStateView kind="loading" message="Loading facilities…" />}
        {home.isError && <ListStateView kind="error" onRetry={() => void home.refetch()} />}
        {(home.data?.hospitals ?? []).map((h) => (
          <FacilityRow
            key={h.id}
            hospital={h}
            onPress={() => navigation.navigate("HospitalDetail", { hospitalId: h.id })}
          />
        ))}
      </View>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: spacing.lg,
    paddingTop: 8,
    paddingBottom: 14,
  },
  avatar: { width: 42, height: 42, borderRadius: 21 },
  headerInfo: { flex: 1, marginLeft: 12 },
  hello: { fontSize: 16.5, fontWeight: "600", color: colors.text },
  locationRow: { flexDirection: "row", alignItems: "center", marginTop: 3 },
  location: { fontSize: 13, fontWeight: "500", color: colors.primary, marginLeft: 3 },
  badge: {
    position: "absolute", top: -1, right: -1,
    width: 9, height: 9, borderRadius: 5,
    backgroundColor: colors.error, borderWidth: 1.5, borderColor: colors.background,
  },
  hero: {
    borderRadius: radii.md,
    overflow: "hidden",
    marginRight: 12,
  },
  heroImage: { width: "100%", height: "100%" },
  heroGradient: { position: "absolute", left: 0, right: 0, bottom: 0, height: "55%" },
  heroTextWrap: { position: "absolute", left: 14, right: 14, bottom: 12 },
  heroTitleRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  heroTitle: { color: "#fff", fontSize: 18.5, fontWeight: "700", flexShrink: 1, marginRight: 10 },
  heroPrice: { color: "#fff", fontSize: 18, fontWeight: "700" },
  heroSubtitle: { color: "#D8DEE7", fontSize: 13, marginTop: 5 },
  dots: { flexDirection: "row", justifyContent: "center", marginTop: 12 },
  dot: { width: 8, height: 8, borderRadius: 4, marginHorizontal: 4 },
  dotActive: { backgroundColor: colors.primary },
  dotInactive: { borderWidth: 1.5, borderColor: colors.primary, backgroundColor: "transparent" },
  section: { paddingHorizontal: spacing.lg, marginTop: 26, marginBottom: 2 },
  serviceCard: {
    borderRadius: radii.md,
    padding: 14,
    marginRight: 15,
    overflow: "hidden",
  },
  serviceTitle: { fontSize: 16.5, fontWeight: "700", color: colors.text, lineHeight: 21 },
  serviceDesc: { fontSize: 12, color: "#3F4753", marginTop: 6, lineHeight: 16 },
  serviceImage: { flex: 1, width: "100%", marginTop: 6, alignSelf: "flex-end" },
  packageCard: {
    borderRadius: radii.md,
    overflow: "hidden",
    marginRight: 12,
  },
  packageImage: { width: "100%", height: "100%" },
  packageTextWrap: { position: "absolute", left: 14, bottom: 12 },
  packageTitle: { color: "#fff", fontSize: 17.5, fontWeight: "700" },
  packageSubtitle: { color: "#D8DEE7", fontSize: 12.5, marginTop: 4 },
  indieCard: {
    borderRadius: radii.md,
    overflow: "hidden",
    marginRight: 12,
  },
  indieImage: { width: "100%", height: "100%" },
  indieTextWrap: { position: "absolute", left: 10, bottom: 10 },
  indieTitle: { color: "#fff", fontSize: 14, fontWeight: "700" },
  indieCount: { color: "#D8DEE7", fontSize: 11.5, marginTop: 2 },
});
