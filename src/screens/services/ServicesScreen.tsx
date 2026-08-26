import React from "react";
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Image } from "react-native";
import { useNavigation } from "@react-navigation/native";
import ScreenContainer from "../../components/ScreenContainer";
import AppHeader from "../../components/AppHeader";
import SearchBar from "../../components/SearchBar";
import { services, ServiceItem } from "../../data/mock";
import { colors, radii, spacing } from "../../theme";

export default function ServicesScreen() {
  const navigation = useNavigation();

  const open = (service: ServiceItem) => {
    switch (service.id) {
      case "transport":
        navigation.navigate("MedicalTransport");
        break;
      case "specialist":
        navigation.navigate("SpecialistTreatments");
        break;
      case "pet":
        navigation.navigate("PetSpecialist");
        break;
      default:
        navigation.navigate("MedicalPackages");
    }
  };

  return (
    <ScreenContainer>
      <AppHeader />
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.content}>
        <Text style={styles.title}>Services</Text>
        <SearchBar style={{ marginTop: 14, marginBottom: 18 }} />
        <View style={styles.grid}>
          {services.map((service) => (
            <TouchableOpacity
              key={service.id}
              style={[styles.card, { backgroundColor: service.color }]}
              activeOpacity={0.85}
              onPress={() => open(service)}
            >
              <View>
                <Text style={styles.cardTitle}>{service.title}</Text>
                <Text style={styles.cardDesc}>{service.description}</Text>
              </View>
              <Image source={service.image} style={styles.cardImage} resizeMode="contain" />
            </TouchableOpacity>
          ))}
        </View>
      </ScrollView>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  content: { paddingHorizontal: spacing.lg, paddingBottom: 32 },
  title: { fontSize: 28, fontWeight: "700", color: colors.text, marginTop: 4 },
  grid: { flexDirection: "row", flexWrap: "wrap", justifyContent: "space-between" },
  card: {
    width: "48.2%",
    aspectRatio: 0.773,
    borderRadius: radii.md,
    padding: 14,
    marginBottom: 14,
    overflow: "hidden",
  },
  cardTitle: { fontSize: 16.5, fontWeight: "700", color: colors.text, lineHeight: 21 },
  cardDesc: { fontSize: 12, color: "#3F4753", marginTop: 6, lineHeight: 16 },
  cardImage: { flex: 1, width: "100%", marginTop: 6, alignSelf: "flex-end" },
});
