import React from "react";
import { View, Text, StyleSheet, Image } from "react-native";
import ScreenContainer from "../../components/ScreenContainer";
import Button from "../../components/Button";
import { images } from "../../data/mock";
import { colors, spacing } from "../../theme";
import { RootScreenProps } from "../../navigation/types";

export default function VerifyEmailScreen({ navigation }: RootScreenProps<"VerifyEmail">) {
  return (
    <ScreenContainer>
      <View style={styles.body}>
        <Image source={images.illusMailbox} style={styles.illustration} resizeMode="contain" />
        <Text style={styles.title}>Verify your email</Text>
        <Text style={styles.subtitle}>
          We sent verification mail to your contacts.{"\n"}Please tap the link inside that mail to
          continue!
        </Text>
        <Button
          label="Go to Inbox"
          variant="pill"
          onPress={() => navigation.navigate("SetupChecklist")}
          style={{ marginTop: 26 }}
        />
      </View>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  body: { flex: 1, alignItems: "center", justifyContent: "center", paddingHorizontal: spacing.xl },
  illustration: { width: 260, height: 220 },
  title: { fontSize: 20, fontWeight: "700", color: colors.text, marginTop: 34 },
  subtitle: {
    fontSize: 13,
    color: colors.secondaryText,
    textAlign: "center",
    lineHeight: 19,
    marginTop: 10,
  },
});
