import React, { useEffect } from "react";
import { View, Text, StyleSheet, TouchableOpacity, Image } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import ScreenContainer from "../../components/ScreenContainer";
import Button from "../../components/Button";
import { colors, spacing } from "../../theme";
import { RootScreenProps } from "../../navigation/types";
import { images } from "../../data/mock";
import { useSession } from "../../state/Session";
import { useMe } from "../../api/queries";

interface ChecklistItem {
  index: number;
  title: string;
  subtitle?: string;
  done: boolean;
  duration?: string;
}

export default function SetupChecklistScreen({ navigation }: RootScreenProps<"SetupChecklist">) {
  const { setup, refreshSetup } = useSession();
  const { data: me } = useMe();
  const passwordDone = setup?.passwordSet ?? false;
  const historyDone = setup?.historyComplete ?? false;

  // The checklist reflects persisted state, so it survives a reinstall.
  useEffect(() => { void refreshSetup(); }, [refreshSetup]);

  const items: ChecklistItem[] = [
    { index: 1, title: "Account created and verified", done: setup?.emailVerified ?? true },
    {
      index: 2,
      title: passwordDone ? "Set Password" : "Create Password",
      subtitle: "Create a unique password for your account",
      done: passwordDone,
      duration: "1 min",
    },
    {
      index: 3,
      title: "Medical History",
      subtitle: "Compliance with medical privacy regulations",
      done: historyDone,
      duration: "1 min",
    },
  ];

  const allDone = passwordDone && historyDone;

  const proceed = () => {
    if (!passwordDone) navigation.navigate("CreatePassword");
    else if (!historyDone) navigation.navigate("MedicalHistory");
    else navigation.replace("MainTabs");
  };

  return (
    <ScreenContainer>
      <View style={styles.body}>
        <Image source={images.illusRecords} style={styles.illustration} resizeMode="contain" />
        <Text style={styles.hello}>Hey, {me?.profile?.firstName ?? "there"} 👋🏽</Text>
        <Text style={styles.subtitle}>Let's finish setting up your account!</Text>

        <View style={styles.list}>
          {items.map((item) => (
            <View key={item.index} style={styles.item}>
              <View style={[styles.indexCircle, item.done && styles.indexDone]}>
                {item.done ? (
                  <Ionicons name="checkmark" size={11} color="#fff" />
                ) : (
                  <Text style={styles.indexText}>{item.index}</Text>
                )}
              </View>
              <View style={styles.itemBody}>
                <Text style={styles.itemTitle}>{item.title}</Text>
                {item.subtitle ? <Text style={styles.itemSubtitle}>{item.subtitle}</Text> : null}
              </View>
              {item.done ? (
                <View style={styles.doneDot} />
              ) : item.duration ? (
                <Text style={styles.duration}>{item.duration}</Text>
              ) : null}
            </View>
          ))}
        </View>

        <View style={styles.bottom}>
          <Button label="Proceed" variant="pill" onPress={proceed} />
          {!allDone && passwordDone && (
            <TouchableOpacity style={styles.skip} onPress={() => navigation.replace("MainTabs")}>
              <Text style={styles.skipText}>Skip</Text>
            </TouchableOpacity>
          )}
        </View>
      </View>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  body: { flex: 1, paddingHorizontal: spacing.xl, paddingTop: 30 },
  illustration: { width: 230, height: 180, alignSelf: "center" },
  hello: { fontSize: 17, fontWeight: "700", color: colors.primary, marginTop: 26 },
  subtitle: { fontSize: 14.5, fontWeight: "600", color: colors.text, marginTop: 4 },
  list: { marginTop: 18 },
  item: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: colors.borderLight,
  },
  indexCircle: {
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: colors.surfaceAlt,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: "center",
    justifyContent: "center",
  },
  indexDone: { backgroundColor: colors.primary, borderColor: colors.primary },
  indexText: { fontSize: 10.5, fontWeight: "600", color: colors.secondaryText },
  itemBody: { flex: 1, marginLeft: 12 },
  itemTitle: { fontSize: 13.5, fontWeight: "600", color: colors.text },
  itemSubtitle: { fontSize: 11.5, color: colors.secondaryText, marginTop: 3 },
  doneDot: { width: 9, height: 9, borderRadius: 5, backgroundColor: colors.success },
  duration: { fontSize: 11, color: colors.secondaryText },
  bottom: { marginTop: "auto", paddingBottom: 30 },
  skip: { alignItems: "center", marginTop: 16 },
  skipText: { fontSize: 13.5, fontWeight: "600", color: colors.text, textDecorationLine: "underline" },
});
