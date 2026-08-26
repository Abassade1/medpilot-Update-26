import React, { useState } from "react";
import { View, Text, StyleSheet, ScrollView, TouchableOpacity } from "react-native";
import { useNavigation } from "@react-navigation/native";
import AssistantInputBar from "../../components/AssistantInputBar";
import ScreenContainer from "../../components/ScreenContainer";
import AppHeader from "../../components/AppHeader";
import LogoMark from "../../components/LogoMark";
import { colors, radii, spacing } from "../../theme";
import { currentUser, diagnosisConditions, diagnosisSymptoms } from "../../data/mock";

type Stage = "home" | "symptoms" | "conditions";

const homeChips = [
  { label: "Meal Analysis", icon: "🍔" },
  { label: "Medical Activities", icon: "🍎" },
];

const symptomIcons: Record<string, string> = {
  Coughing: "😮‍💨",
  "Chest pain": "🫀",
  "Difficult breathing": "😮‍💨",
  "Severe headache": "🤕",
};

const conditionIcons: Record<string, string> = {
  Cancer: "🎗️",
  Diabetics: "🩸",
  Tuberculosis: "🫁",
  "High Blood Pressure": "🫀",
  None: "🚫",
};

export default function AuxChatScreen() {
  const navigation = useNavigation();
  const [stage, setStage] = useState<Stage>("home");

  const onHomeChip = (label: string) => {
    if (label === "Meal Analysis") navigation.navigate("MealCamera");
    else setStage("symptoms");
  };

  const onSymptom = () => setStage("conditions");
  const onCondition = () => {
    setStage("home");
    navigation.navigate("DiagnosisResult");
  };

  return (
    <ScreenContainer backgroundColor={colors.surface}>
      {stage !== "home" ? (
        <AppHeader onBack={() => setStage(stage === "conditions" ? "symptoms" : "home")} />
      ) : (
        <View style={{ height: 48 }} />
      )}

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.center}>
          <LogoMark size={40} />
          {stage === "home" && (
            <>
              <Text style={styles.title}>Hello {currentUser.fullName} ,</Text>
              <Text style={styles.subtitle}>How may I be of help today!</Text>
            </>
          )}
          {stage === "symptoms" && (
            <>
              <Text style={styles.title}>Diagnosis!</Text>
              <Text style={styles.subtitle}>What symptoms do you need help with?</Text>
            </>
          )}
          {stage === "conditions" && (
            <>
              <Text style={styles.title}>Chest pain!</Text>
              <Text style={styles.subtitle}>Sorry to hear that! Do you have any of the following?</Text>
            </>
          )}
        </View>
      </ScrollView>

      <View style={styles.chipsWrap}>
        {stage === "home" &&
          homeChips.map((c) => (
            <TouchableOpacity key={c.label} style={styles.chip} onPress={() => onHomeChip(c.label)}>
              <Text style={styles.chipIcon}>{c.icon}</Text>
              <Text style={styles.chipLabel}>{c.label}</Text>
            </TouchableOpacity>
          ))}
        {stage === "symptoms" &&
          diagnosisSymptoms.map((s) => (
            <TouchableOpacity key={s} style={styles.chip} onPress={onSymptom}>
              <Text style={styles.chipIcon}>{symptomIcons[s] ?? "🩺"}</Text>
              <Text style={styles.chipLabel}>{s}</Text>
            </TouchableOpacity>
          ))}
        {stage === "conditions" &&
          diagnosisConditions.map((c) => (
            <TouchableOpacity key={c} style={styles.chip} onPress={onCondition}>
              <Text style={styles.chipIcon}>{conditionIcons[c] ?? "🩺"}</Text>
              <Text style={styles.chipLabel}>{c}</Text>
            </TouchableOpacity>
          ))}
      </View>

      <AssistantInputBar tone="filled" />
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  content: { flexGrow: 1, justifyContent: "center" },
  center: { alignItems: "flex-start", paddingHorizontal: spacing.xl },
  title: { fontSize: 16.5, fontWeight: "700", color: colors.text, marginTop: 16 },
  subtitle: { fontSize: 14, color: colors.text, marginTop: 4, lineHeight: 20 },
  chipsWrap: {
    flexDirection: "row",
    flexWrap: "wrap",
    paddingHorizontal: spacing.lg,
    paddingBottom: 10,
  },
  chip: {
    flexDirection: "row",
    alignItems: "center",
    borderWidth: 1,
    borderColor: colors.primary,
    borderRadius: radii.pill,
    paddingHorizontal: 12,
    height: 34,
    marginRight: 10,
    marginBottom: 10,
    backgroundColor: "#fff",
  },
  chipIcon: { fontSize: 13 },
  chipLabel: { fontSize: 12.5, fontWeight: "500", color: colors.primary, marginLeft: 6 },
});
