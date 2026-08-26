import React, { useState } from "react";
import { View, Text, StyleSheet, FlatList, TouchableOpacity } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import ListStateView from "../../components/ListStateView";
import ScreenContainer from "../../components/ScreenContainer";
import AppHeader from "../../components/AppHeader";
import SegmentTabs from "../../components/SegmentTabs";
import ProviderCard from "../../components/ProviderCard";
import LogoBox from "../../components/LogoBox";
import { transportProviders } from "../../data/mock";
import { colors, radii, spacing } from "../../theme";
import { RootScreenProps } from "../../navigation/types";

const TABS = ["Private Jet", "Medical Ambulance", "Speed Boat"];

export default function MedicalTransportScreen({ navigation }: RootScreenProps<"MedicalTransport">) {
  const [tab, setTab] = useState(1);

  return (
    <ScreenContainer>
      <AppHeader
        title="Medical Transportation"
        right={
          <TouchableOpacity hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
            <Ionicons name="search" size={20} color={colors.primary} />
          </TouchableOpacity>
        }
      />
      <View style={styles.locationWrap}>
        <View style={styles.locationPill}>
          <Ionicons name="location-sharp" size={15} color={colors.text} />
          <Text style={styles.locationText}>123 Main Street, Toronto, ON</Text>
        </View>
      </View>
      <SegmentTabs tabs={TABS} active={tab} onChange={setTab} />
      <FlatList
        data={transportProviders}
        keyExtractor={(p) => p.id}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.list}
        ListEmptyComponent={<ListStateView kind="empty" title="Nothing to show" message="No providers are available right now." />}
        renderItem={({ item }) => (
          <ProviderCard
            image={item.image}
            price={item.price}
            logo={<LogoBox text={item.logoText} color={item.logoColor} size={38} dark={item.logoDark} image={item.logo} />}
            name={item.name}
            location={item.location}
            rating={item.rating}
            verified={item.verified}
            description={item.description}
            routesLabel="Routes"
            routes={item.routes}
            onPress={() => navigation.navigate("TransportDetail", { providerId: item.id })}
          />
        )}
      />
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  locationWrap: { paddingHorizontal: spacing.lg, paddingTop: 4, paddingBottom: 12 },
  locationPill: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: colors.surfaceAlt,
    borderRadius: radii.sm,
    height: 40,
    paddingHorizontal: 12,
  },
  locationText: { fontSize: 13, color: colors.text, marginLeft: 8 },
  list: { paddingHorizontal: spacing.lg, paddingTop: 16, paddingBottom: 32 },
});
