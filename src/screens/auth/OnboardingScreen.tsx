import React from "react";
import { View, Text, StyleSheet, Image, TouchableOpacity, StatusBar } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { LinearGradient } from "expo-linear-gradient";
import { images } from "../../data/mock";
import { colors, radii } from "../../theme";
import { RootScreenProps } from "../../navigation/types";

/**
 * Onboarding — the Figma frame uses a full-screen video clip of a medical
 * procedure (placeholder: static surgery photo with dark overlay).
 */
export default function OnboardingScreen({ navigation }: RootScreenProps<"Onboarding">) {
  const insets = useSafeAreaInsets();
  return (
    <View style={styles.root}>
      <StatusBar barStyle="light-content" />
      <Image source={images.surgery} style={styles.bg} resizeMode="cover" />
      <LinearGradient
        colors={["rgba(4,16,32,0.2)", "rgba(2,10,22,0.35)", "rgba(1,6,14,0.85)"]}
        locations={[0, 0.62, 1]}
        style={StyleSheet.absoluteFill}
      />
      <View style={[styles.content, { paddingBottom: insets.bottom + 28 }]}>
        <Text style={styles.title}>Executive medical solutions</Text>
        <Text style={styles.subtitle}>
          Exclusive access to trustworthy medical solutions. Together, with our partners, we
          create accessible medical services.
        </Text>
        <TouchableOpacity
          style={styles.cta}
          activeOpacity={0.85}
          onPress={() => navigation.replace("SignIn")}
        >
          <Text style={styles.ctaLabel}>Start Exploring</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: "#04101f", justifyContent: "flex-end" },
  bg: { position: "absolute", top: 0, left: 0, right: 0, bottom: 0, width: "100%", height: "100%" },
  content: { paddingHorizontal: 28, alignItems: "center" },
  title: { color: "#fff", fontSize: 22, fontWeight: "700", textAlign: "center" },
  subtitle: {
    color: "#E3E8EF",
    fontSize: 13.5,
    lineHeight: 20,
    textAlign: "center",
    marginTop: 12,
    marginBottom: 24,
  },
  cta: {
    backgroundColor: "#fff",
    borderRadius: radii.pill,
    paddingHorizontal: 32,
    height: 44,
    alignItems: "center",
    justifyContent: "center",
  },
  ctaLabel: { color: colors.primary, fontSize: 14.5, fontWeight: "700" },
});
