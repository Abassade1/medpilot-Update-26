import React from "react";
import { StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import ScreenContainer from "../../components/ScreenContainer";
import AppHeader from "../../components/AppHeader";
import Button from "../../components/Button";
import { colors, spacing } from "../../theme";
import { RootScreenProps } from "../../navigation/types";

/** A service that is announced but not yet offered: clearly labelled, not bookable, with a way out. */
export default function ComingSoonScreen({ navigation, route }: RootScreenProps<"ComingSoon">) {
  const { title, description } = route.params;
  return (
    <ScreenContainer>
      <AppHeader title={title} />
      <View style={styles.body}>
        <View style={styles.icon}><Ionicons name="hourglass-outline" size={38} color={colors.primary} /></View>
        <View style={styles.pill}><Text style={styles.pillText}>Coming soon</Text></View>
        <Text style={styles.title}>{title}</Text>
        <Text style={styles.text}>{description}</Text>
        <Text style={styles.note}>This service isn't available to book yet. We'll let you know when it launches.</Text>
        <Button label="Back to Home" variant="pill" onPress={() => navigation.navigate("MainTabs")} style={{ marginTop: 26 }} />
        <Button label="Browse other services" variant="outlinePill" onPress={() => navigation.navigate("Services")} style={{ marginTop: 10 }} />
      </View>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  body: { flex: 1, alignItems: "center", justifyContent: "center", paddingHorizontal: spacing.xl },
  icon: { width: 84, height: 84, borderRadius: 42, backgroundColor: colors.primaryLight, alignItems: "center", justifyContent: "center" },
  pill: { marginTop: 18, backgroundColor: colors.primaryLight, borderRadius: 14, paddingHorizontal: 12, paddingVertical: 4 },
  pillText: { fontSize: 12, fontWeight: "700", color: colors.primary, textTransform: "uppercase", letterSpacing: 0.5 },
  title: { fontSize: 22, fontWeight: "700", color: colors.text, marginTop: 12, textAlign: "center" },
  text: { fontSize: 14, color: colors.secondaryText, textAlign: "center", lineHeight: 20, marginTop: 8 },
  note: { fontSize: 12.5, color: colors.tertiaryText, textAlign: "center", lineHeight: 18, marginTop: 14 },
});
