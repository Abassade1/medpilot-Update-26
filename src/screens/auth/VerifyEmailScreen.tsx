import React, { useEffect, useState } from "react";
import { View, Text, StyleSheet, Image } from "react-native";
import ScreenContainer from "../../components/ScreenContainer";
import Button from "../../components/Button";
import { images } from "../../data/assets";
import { endpoints } from "../../api/endpoints";
import { useSession } from "../../state/Session";
import { colors, spacing } from "../../theme";
import { RootScreenProps } from "../../navigation/types";
import { useT } from "../../i18n";

export default function VerifyEmailScreen({ navigation }: RootScreenProps<"VerifyEmail">) {
  const tr = useT();
  const { refreshSetup } = useSession();
  const [busy, setBusy] = useState(false);

  // Verification happens out of band (email deep link), so poll while waiting.
  useEffect(() => {
    const t = setInterval(async () => {
      try {
        const { emailVerified } = await endpoints.auth.verificationStatus();
        if (emailVerified) { clearInterval(t); await refreshSetup(); }
      } catch { /* offline: keep polling */ }
    }, 5000);
    return () => clearInterval(t);
  }, [refreshSetup]);

  const proceed = async () => {
    setBusy(true);
    // Resend keeps the member unblocked if the first mail never arrived.
    await endpoints.auth.resendVerification().catch(() => {});
    await refreshSetup();
    setBusy(false);
    navigation.navigate("SetupChecklist");
  };

  return (
    <ScreenContainer>
      <View style={styles.body}>
        <Image source={images.illusMailbox} style={styles.illustration} resizeMode="contain" />
        <Text style={styles.title}>{tr("Verify your email")}</Text>
        <Text style={styles.subtitle}>
          {tr("We sent verification mail to your contacts.")}{"\n"}{tr("Please tap the link inside that mail to continue!")}
        </Text>
        <Button
          label={tr("Go to Inbox")}
          variant="pill"
          loading={busy}
          onPress={proceed}
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
