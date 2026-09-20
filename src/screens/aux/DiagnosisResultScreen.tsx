import React from "react";
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Alert } from "react-native";
import { Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";
import AssistantInputBar from "../../components/AssistantInputBar";
import ScreenContainer from "../../components/ScreenContainer";
import AppHeader from "../../components/AppHeader";
import { colors, radii, spacing } from "../../theme";
import ListStateView from "../../components/ListStateView";
import { useQuery } from "@tanstack/react-query";
import { endpoints } from "../../api/endpoints";
import { RootScreenProps } from "../../navigation/types";

export default function DiagnosisResultScreen({
  navigation,
  route,
}: RootScreenProps<"DiagnosisResult">) {
  const { sessionId } = route.params;
  const query = useQuery({
    queryKey: ["auxSession", sessionId],
    queryFn: () => endpoints.aux.session(sessionId),
  });
  const [translation, setTranslation] = React.useState<Record<string, string> | null>(null);
  const [translating, setTranslating] = React.useState(false);
  const result = query.data;

  /** Escalation is a server-side action; the chips are not just navigation. */
  const escalate = async (kind: "doctor" | "hospital" | "evacuation", go: () => void) => {
    try {
      await endpoints.aux.escalate(sessionId, kind);
    } catch {
      // The referral is best-effort; never block the member from reaching care.
    }
    go();
  };

  const toggleTranslation = async () => {
    if (translation) {
      setTranslation(null);
      return;
    }
    setTranslating(true);
    try {
      setTranslation(await endpoints.aux.translate(sessionId, "fr"));
    } catch {
      Alert.alert("Translation unavailable", "Please try again in a moment.");
    } finally {
      setTranslating(false);
    }
  };

  if (!result) {
    return (
      <ScreenContainer>
        <AppHeader title="Diagnosis" />
        {query.isError ? (
          <ListStateView kind="error" onRetry={() => void query.refetch()} />
        ) : (
          <ListStateView kind="loading" message="Preparing your assessment…" />
        )}
      </ScreenContainer>
    );
  }

  const field = (key: keyof typeof result) =>
    (translation?.[key as string] ?? result[key]) as string;

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
          <Text style={styles.title}>{field("title")}</Text>
          <TouchableOpacity onPress={() => void toggleTranslation()} disabled={translating}>
            <Text style={styles.translate}>
              {translating ? "Translating…" : translation ? "Original" : "Translation"}
            </Text>
          </TouchableOpacity>
        </View>
        <Text style={styles.paragraph}>{field("summary")}</Text>

        <Text style={styles.sectionTitle}>Possible Causes</Text>
        <Text style={styles.paragraph}>{field("possibleCauses")}</Text>

        <Text style={[styles.sectionTitle, { color: colors.warning }]}>Recommended Treatment</Text>
        <View style={styles.treatmentBox}>
          <Text style={styles.paragraph}>{field("recommendedTreatment")}</Text>
        </View>

        <View style={styles.chipsWrap}>
          <TouchableOpacity style={styles.chip} onPress={() => void escalate("doctor", () => navigation.navigate("Hospitals"))}>
            <MaterialCommunityIcons name="doctor" size={13} color={colors.error} />
            <Text style={styles.chipLabel}>Connect my Doctor</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.chip} onPress={() => void escalate("hospital", () => navigation.navigate("Hospitals"))}>
            <MaterialCommunityIcons name="hospital-building" size={13} color={colors.primary} />
            <Text style={styles.chipLabel}>Connect to Hospital</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.chip} onPress={() => void escalate("evacuation", () => navigation.navigate("MedicalTransport"))}>
            <MaterialCommunityIcons name="helicopter" size={13} color={colors.text} />
            <Text style={styles.chipLabel}>Request Emergency Evac</Text>
          </TouchableOpacity>
        </View>

        <Text style={styles.disclaimer}>{result.disclaimer}</Text>
      </ScrollView>

      <AssistantInputBar tone="outline" onSend={(ask) => navigation.navigate("MainTabs", { screen: "AuxTab", params: { ask } } as never)} />
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
  disclaimer: { fontSize: 11, color: colors.tertiaryText, lineHeight: 16, marginTop: 6 },
});
