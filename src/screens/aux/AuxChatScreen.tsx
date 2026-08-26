import React, { useState } from "react";
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, ActivityIndicator } from "react-native";
import { useNavigation } from "@react-navigation/native";
import AssistantInputBar from "../../components/AssistantInputBar";
import ScreenContainer from "../../components/ScreenContainer";
import AppHeader from "../../components/AppHeader";
import LogoMark from "../../components/LogoMark";
import { colors, radii, spacing } from "../../theme";
import { endpoints } from "../../api/endpoints";
import { useMe, useReference } from "../../api/queries";
import { ApiError } from "../../api/errors";
import { RootNavigation } from "../../navigation/types";

type Stage = "home" | "symptoms" | "conditions";

const homeChips = [
  { label: "Meal Analysis", icon: "🍔" },
  { label: "Medical Activities", icon: "🍎" },
];

export default function AuxChatScreen() {
  const navigation = useNavigation<RootNavigation>();
  const [stage, setStage] = useState<Stage>("home");
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [symptomLabel, setSymptomLabel] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const me = useMe();
  const reference = useReference();
  // The condition list comes back with the triage session; reference data is the
  // fallback while that round trip is in flight.
  const [conditions, setConditions] = useState(reference.data?.triageConditions ?? []);
  const symptoms = reference.data?.triageSymptoms ?? [];

  const onHomeChip = (label: string) => {
    if (label === "Meal Analysis") navigation.navigate("MealCamera");
    else setStage("symptoms");
  };

  const describe = (err: unknown) => {
    const e = err as ApiError;
    return e.isOffline
      ? "You appear to be offline. Check your connection and try again."
      : e.isQuota
      ? "You've used all the assistant sessions on your current plan."
      : e.message || "The assistant is unavailable right now. Please try again.";
  };

  const onSymptom = async (code: string, label: string) => {
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      const step = await endpoints.aux.startTriage(code);
      if ("result" in step) {
        setStage("home");
        navigation.navigate("DiagnosisResult", { sessionId: step.sessionId });
        return;
      }
      setSessionId(step.sessionId);
      setSymptomLabel(label);
      setConditions(step.conditions.map((c) => ({ id: c.code, ...c })));
      setStage("conditions");
    } catch (err) {
      setError(describe(err));
    } finally {
      setBusy(false);
    }
  };

  const onCondition = async (code: string) => {
    if (busy || !sessionId) return;
    setBusy(true);
    setError(null);
    try {
      const step = await endpoints.aux.continueTriage(sessionId, code);
      setStage("home");
      navigation.navigate("DiagnosisResult", { sessionId: step.sessionId });
    } catch (err) {
      setError(describe(err));
    } finally {
      setBusy(false);
    }
  };

  const firstName = me.data?.profile?.firstName ?? "there";

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
              <Text style={styles.title}>Hello {firstName} ,</Text>
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
              <Text style={styles.title}>{symptomLabel}!</Text>
              <Text style={styles.subtitle}>
                Sorry to hear that! Do you have any of the following?
              </Text>
            </>
          )}
          {error ? <Text style={styles.error}>{error}</Text> : null}
          {busy ? <ActivityIndicator color={colors.primary} style={{ marginTop: 14 }} /> : null}
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
          symptoms.map((s) => (
            <TouchableOpacity
              key={s.code}
              style={styles.chip}
              disabled={busy}
              onPress={() => void onSymptom(s.code, s.label)}
            >
              <Text style={styles.chipIcon}>{s.emoji ?? "🩺"}</Text>
              <Text style={styles.chipLabel}>{s.label}</Text>
            </TouchableOpacity>
          ))}
        {stage === "conditions" &&
          conditions.map((c) => (
            <TouchableOpacity
              key={c.code}
              style={styles.chip}
              disabled={busy}
              onPress={() => void onCondition(c.code)}
            >
              <Text style={styles.chipIcon}>{c.emoji ?? "🩺"}</Text>
              <Text style={styles.chipLabel}>{c.label}</Text>
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
  error: { fontSize: 12.5, color: colors.error, marginTop: 12, lineHeight: 18 },
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
