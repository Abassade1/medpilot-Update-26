import React, { useEffect, useRef, useState } from "react";
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, ActivityIndicator, KeyboardAvoidingView, Platform } from "react-native";
import { useNavigation, useRoute } from "@react-navigation/native";
import AssistantInputBar from "../../components/AssistantInputBar";
import ScreenContainer from "../../components/ScreenContainer";
import AppHeader from "../../components/AppHeader";
import LogoMark from "../../components/LogoMark";
import { colors, radii, spacing } from "../../theme";
import { endpoints } from "../../api/endpoints";
import { useMe, useReference } from "../../api/queries";
import { ApiError } from "../../api/errors";
import { RootNavigation } from "../../navigation/types";
import type { ChatAction, ChatSuggestion } from "../../api/types";

type Stage = "home" | "symptoms" | "conditions";

interface Msg {
  id: string; role: "user" | "assistant"; text: string;
  suggestions?: ChatSuggestion[]; urgent?: boolean; failed?: boolean;
}

const homeChips = [
  { label: "Meal Analysis", icon: "🍔" },
];

export default function AuxChatScreen() {
  const navigation = useNavigation<RootNavigation>();
  const route = useRoute<any>();
  const [stage, setStage] = useState<Stage>("home");
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [symptomLabel, setSymptomLabel] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [messages, setMessages] = useState<Msg[]>([]);
  const [replying, setReplying] = useState(false);
  const [chatSession, setChatSession] = useState<string | null>(null);
  const scroller = useRef<ScrollView>(null);
  const seq = useRef(0);
  const nextId = () => `local-${++seq.current}`;

  // Pick the conversation back up after leaving the tab or restarting the app.
  useEffect(() => {
    let alive = true;
    endpoints.aux.latestChat().then((h) => {
      if (!alive || !h.messages.length) return;
      setChatSession(h.sessionId);
      setMessages((cur) => (cur.length ? cur : h.messages.map((m) => ({
        id: m.id, role: m.role, text: m.text, suggestions: m.suggestions, urgent: m.urgent,
      }))));
    }).catch(() => { /* an empty start is fine; sending a message will surface real errors */ });
    return () => { alive = false; };
  }, []);

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

  const runAction = (action: ChatAction) => {
    const go = (name: string, params?: object) => (navigation as any).navigate(name, params);
    switch (action) {
      case "triage": return setStage("symptoms");
      case "meal": return go("MealCamera");
      case "hospitals": return go("Hospitals");
      case "appointments": return go("AppointmentsTab");
      case "transport": return go("MedicalTransport");
      case "pet": return go("PetSpecialist");
      case "specialists": return go("Specialists");
      case "upgrade": return go("Upgrade");
      case "packages": return go("MedicalPackages");
      case "profile": return go("Profile");
    }
  };

  const send = async (text: string, retryId?: string) => {
    if (replying) return;
    setStage("home");
    setError(null);
    setMessages((m) => [
      ...m.filter((x) => x.id !== retryId).map((x) => (x.failed ? { ...x, failed: false } : x)),
      { id: retryId ?? nextId(), role: "user", text },
    ]);
    setReplying(true);
    try {
      const res = await endpoints.aux.chat(text, chatSession ?? undefined);
      setChatSession(res.sessionId);
      setMessages((m) => [...m, {
        id: res.reply.id, role: "assistant", text: res.reply.text,
        suggestions: res.reply.suggestions, urgent: res.reply.urgent,
      }]);
    } catch (err) {
      setMessages((m) => m.map((x) => (x.id === (retryId ?? `local-${seq.current}`) ? { ...x, failed: true } : x)));
      setError(describe(err));
    } finally {
      setReplying(false);
    }
  };

  // A question typed elsewhere (e.g. on the diagnosis screen) arrives as a route param; send it once.
  const ask: string | undefined = route.params?.ask;
  useEffect(() => {
    if (!ask) return;
    (navigation as any).setParams({ ask: undefined });
    void send(ask);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ask]);

  const newChat = () => {
    setMessages([]);
    setChatSession(null);
    setError(null);
    setStage("home");
  };

  const firstName = me.data?.profile?.firstName ?? "there";
  const inConversation = messages.length > 0 && stage === "home";

  return (
    <ScreenContainer backgroundColor={colors.surface}>
      {stage !== "home" ? (
        <AppHeader onBack={() => setStage(stage === "conditions" ? "symptoms" : "home")} />
      ) : messages.length > 0 ? (
        <AppHeader
          title="AUX"
          showBack={false}
          right={
            <TouchableOpacity onPress={newChat} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }} accessibilityRole="button" accessibilityLabel="Start a new conversation">
              <Text style={styles.newChat}>New chat</Text>
            </TouchableOpacity>
          }
        />
      ) : (
        <View style={{ height: 48 }} />
      )}

      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : undefined} keyboardVerticalOffset={Platform.OS === "ios" ? 90 : 0}>
      <ScrollView
        ref={scroller}
        onContentSizeChange={() => scroller.current?.scrollToEnd({ animated: true })}
        contentContainerStyle={inConversation ? styles.thread : styles.content}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {inConversation ? (
          <>
            {messages.map((m, i) => (
              <View key={m.id}>
                {/* A row (not alignItems) so a long user message wraps inside its bubble instead of clipping. */}
                <View style={{ flexDirection: "row", justifyContent: m.role === "user" ? "flex-end" : "flex-start" }}>
                  <View style={[styles.bubble, m.role === "user" ? styles.userBubble : styles.botBubble, m.urgent && styles.urgentBubble]}>
                    {m.urgent ? <Text style={styles.urgentTag}>Urgent</Text> : null}
                    <Text style={[styles.bubbleText, m.role === "user" && { color: "#fff" }]}>{m.text}</Text>
                  </View>
                </View>
                {m.failed ? (
                  <TouchableOpacity onPress={() => void send(m.text, m.id)} accessibilityRole="button" accessibilityLabel="Retry sending this message">
                    <Text style={styles.retry}>Not sent. Tap to retry</Text>
                  </TouchableOpacity>
                ) : null}
                {m.role === "assistant" && m.suggestions?.length && i === messages.length - 1 ? (
                  <View style={styles.suggestWrap}>
                    {m.suggestions.map((sg) => (
                      <TouchableOpacity key={`${sg.action}-${sg.label}`} style={styles.chip} onPress={() => runAction(sg.action)} accessibilityRole="button">
                        <Text style={styles.chipLabel}>{sg.label}</Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                ) : null}
              </View>
            ))}
            {replying ? (
              <View style={[styles.bubble, styles.botBubble, { flexDirection: "row", alignItems: "center" }]} accessibilityLiveRegion="polite">
                <ActivityIndicator size="small" color={colors.primary} />
                <Text style={[styles.bubbleText, { marginLeft: 8, color: colors.secondaryText }]}>AUX is thinking…</Text>
              </View>
            ) : null}
            {error && !messages.some((m) => m.failed) ? <Text style={styles.error}>{error}</Text> : null}
            <Text style={styles.disclaimer}>AUX gives general guidance, not a diagnosis. In an emergency call your local emergency number.</Text>
          </>
        ) : (
        <>
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
        </>
        )}
      </ScrollView>

      <View style={styles.chipsWrap}>
        {stage === "home" && messages.length === 0 &&
          [
            { label: "Symptom check", icon: "🩺" },
            ...homeChips,
            { label: "Find a hospital", icon: "🏥" },
          ].map((c) => (
            <TouchableOpacity key={c.label} style={styles.chip} onPress={() => (c.label === "Find a hospital" ? runAction("hospitals") : onHomeChip(c.label))}>
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

      <AssistantInputBar tone="filled" onSend={(t) => void send(t)} />
      </KeyboardAvoidingView>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  thread: { paddingHorizontal: spacing.lg, paddingVertical: 12 },
  bubble: { maxWidth: "84%", borderRadius: 16, paddingHorizontal: 14, paddingVertical: 10, marginBottom: 10 },
  userBubble: { backgroundColor: colors.primary, borderBottomRightRadius: 4 },
  botBubble: { backgroundColor: "#fff", borderWidth: 1, borderColor: colors.borderLight, borderBottomLeftRadius: 4 },
  urgentBubble: { borderColor: colors.error, backgroundColor: colors.errorBg },
  urgentTag: { fontSize: 11, fontWeight: "700", color: colors.error, textTransform: "uppercase", marginBottom: 4 },
  bubbleText: { fontSize: 14, lineHeight: 20, color: colors.text },
  retry: { fontSize: 12, color: colors.error, marginBottom: 10, textDecorationLine: "underline" },
  suggestWrap: { flexDirection: "row", flexWrap: "wrap", marginBottom: 6 },
  disclaimer: { fontSize: 11.5, color: colors.tertiaryText, textAlign: "center", marginTop: 8, lineHeight: 16 },
  newChat: { fontSize: 13, fontWeight: "600", color: colors.primary },
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
