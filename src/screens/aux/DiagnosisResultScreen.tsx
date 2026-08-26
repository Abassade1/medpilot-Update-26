import React from "react";
import { View, Text, StyleSheet, ScrollView, TouchableOpacity } from "react-native";
import { Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";
import AssistantInputBar from "../../components/AssistantInputBar";
import ScreenContainer from "../../components/ScreenContainer";
import AppHeader from "../../components/AppHeader";
import { colors, radii, spacing } from "../../theme";
import { diagnosisResult } from "../../data/mock";
import { RootScreenProps } from "../../navigation/types";

export default function DiagnosisResultScreen({ navigation }: RootScreenProps<"DiagnosisResult">) {
  return (
    <ScreenContainer>
      <AppHeader title="Diagnosis" />
      <View style={styles.emergencyBanner}>
        <Ionicons name="warning" size={13} color="#fff" />
        <Text style={styles.emergencyText}>
          For medical emergency call 911 or your local emergency
        </Text>
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.content}>
        <View style={styles.titleRow}>
          <Text style={styles.title}>{diagnosisResult.title}</Text>
          <TouchableOpacity>
            <Text style={styles.translate}>Translation</Text>
          </TouchableOpacity>
        </View>
        <Text style={styles.paragraph}>{diagnosisResult.summary}</Text>

        <Text style={styles.sectionTitle}>Possible Causes</Text>
        <Text style={styles.paragraph}>{diagnosisResult.possibleCauses}</Text>

        <Text style={[styles.sectionTitle, { color: colors.warning }]}>Recommended Treatment</Text>
        <View style={styles.treatmentBox}>
          <Text style={styles.paragraph}>{diagnosisResult.recommendedTreatment}</Text>
        </View>

        <View style={styles.chipsWrap}>
          <TouchableOpacity style={styles.chip} onPress={() => navigation.navigate("Hospitals")}>
            <MaterialCommunityIcons name="doctor" size={13} color={colors.error} />
            <Text style={styles.chipLabel}>Connect my Doctor</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.chip} onPress={() => navigation.navigate("Hospitals")}>
            <MaterialCommunityIcons name="hospital-building" size={13} color={colors.primary} />
            <Text style={styles.chipLabel}>Connect to Hospital</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.chip} onPress={() => navigation.navigate("MedicalTransport")}>
            <MaterialCommunityIcons name="helicopter" size={13} color={colors.text} />
            <Text style={styles.chipLabel}>Request Emergency Evac</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>

      <AssistantInputBar tone="outline" />
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  emergencyBanner: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.emergency,
    paddingVertical: 7,
    paddingHorizontal: 12,
  },
  emergencyText: { color: "#fff", fontSize: 11.5, fontWeight: "600", marginLeft: 6 },
  content: { paddingHorizontal: spacing.lg, paddingTop: 16, paddingBottom: 16 },
  titleRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  title: { fontSize: 18, fontWeight: "700", color: colors.text },
  translate: { fontSize: 13, fontWeight: "600", color: colors.primary },
  paragraph: { fontSize: 12.5, color: colors.text, lineHeight: 19, marginTop: 8 },
  sectionTitle: { fontSize: 14, fontWeight: "700", color: colors.text, marginTop: 18 },
  treatmentBox: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radii.sm,
    padding: 12,
    marginTop: 8,
    backgroundColor: colors.surface,
  },
  chipsWrap: { flexDirection: "row", flexWrap: "wrap", marginTop: 18 },
  chip: {
    flexDirection: "row",
    alignItems: "center",
    borderWidth: 1,
    borderColor: colors.primary,
    borderRadius: radii.pill,
    paddingHorizontal: 10,
    height: 32,
    marginRight: 8,
    marginBottom: 10,
    backgroundColor: "#fff",
  },
  chipLabel: { fontSize: 11.5, fontWeight: "500", color: colors.text, marginLeft: 5 },
});
