import React from "react";
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Image } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import ScreenContainer from "../../components/ScreenContainer";
import AppHeader from "../../components/AppHeader";
import LogoMark from "../../components/LogoMark";
import { colors, radii, shadows, spacing } from "../../theme";
import { images } from "../../data/mock";
import { RootScreenProps } from "../../navigation/types";

const basicFeatures = [
  "1 meal Analysis",
  "10  access to local medical clinic",
  "2 access to medical evacuation services",
  "Upgrade Anytime",
];

const proFeatures = [
  "Unlimited meal Analysis",
  "Unlimited Access to medical clinic",
  "Unlimited access to medical evacuation services",
  "Cancel Anytime",
];

export default function UpgradeScreen({ navigation }: RootScreenProps<"Upgrade">) {
  return (
    <ScreenContainer>
      <AppHeader title="Upgrade" right={<LogoMark size={26} />} />
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.content}>
        <View style={styles.card}>
          <Image source={images.woman1} style={styles.cardImage} />
          <View style={styles.cardBody}>
            <Text style={styles.cardTitle}>
              MedPilot Basic <Text style={styles.cardPrice}>(Free)</Text>
            </Text>
            {basicFeatures.map((f) => (
              <View key={f} style={styles.bulletRow}>
                <Text style={styles.bullet}>•</Text>
                <Text style={styles.bulletText}>{f}</Text>
              </View>
            ))}
            <View style={styles.cardFooter}>
              <Text style={styles.footerLink}>Your current plan</Text>
            </View>
          </View>
        </View>

        <View style={styles.card}>
          <Image source={images.woman2} style={styles.cardImage} />
          <View style={styles.cardBody}>
            <Text style={styles.cardTitle}>
              Get MedPilot Pro <Text style={styles.cardPrice}>($10/monthly)</Text>
            </Text>
            {proFeatures.map((f) => (
              <View key={f} style={styles.bulletRow}>
                <Text style={styles.bullet}>•</Text>
                <Text style={styles.bulletText}>{f}</Text>
              </View>
            ))}
            <TouchableOpacity style={styles.cardFooter} onPress={() => navigation.goBack()}>
              <Ionicons name="shield-checkmark-outline" size={14} color={colors.primary} />
              <Text style={[styles.footerLink, { marginLeft: 5 }]}>Upgrade Now</Text>
            </TouchableOpacity>
          </View>
        </View>
      </ScrollView>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  content: { paddingHorizontal: spacing.lg, paddingTop: 16, paddingBottom: 32 },
  card: {
    backgroundColor: "#fff",
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: colors.borderLight,
    marginBottom: 18,
    overflow: "hidden",
    ...shadows.card,
  },
  cardImage: { position: "absolute", right: 0, top: 0, bottom: 0, width: 118, height: "100%" },
  cardBody: { padding: 14, paddingRight: 126 },
  cardTitle: { fontSize: 15.5, fontWeight: "700", color: colors.primary },
  cardPrice: { fontSize: 13, fontWeight: "500", color: colors.primary },
  bulletRow: { flexDirection: "row", marginTop: 7 },
  bullet: { fontSize: 12.5, color: colors.text, marginRight: 6, lineHeight: 17 },
  bulletText: { flex: 1, fontSize: 12.5, color: colors.text, lineHeight: 17 },
  cardFooter: {
    flexDirection: "row",
    alignItems: "center",
    borderTopWidth: 1,
    borderTopColor: colors.borderLight,
    marginTop: 12,
    paddingTop: 10,
  },
  footerLink: { fontSize: 13, fontWeight: "600", color: colors.primary },
});
