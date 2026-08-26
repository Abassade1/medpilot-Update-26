import React, { useCallback, useEffect, useRef, useState } from "react";
import { View, Text, StyleSheet, Image } from "react-native";
import ScreenContainer from "../../components/ScreenContainer";
import LogoMark from "../../components/LogoMark";
import Button from "../../components/Button";
import { endpoints } from "../../api/endpoints";
import { uploadToSignedUrl } from "../../api/client";
import { ApiError } from "../../api/errors";
import { colors, spacing } from "../../theme";
import { RootScreenProps } from "../../navigation/types";

/**
 * Uploads the captured meal photo, then polls the analysis until the server
 * reports it complete. The progress bar reflects real phases (upload → queued →
 * processing) rather than a timer, and never reaches 100% before the result does.
 */
export default function MealAnalyzingScreen({
  navigation,
  route,
}: RootScreenProps<"MealAnalyzing">) {
  const { imageUri, mimeType } = route.params;
  const [progress, setProgress] = useState(0.08);
  const [error, setError] = useState<string | null>(null);
  const cancelled = useRef(false);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => () => { cancelled.current = true; }, []);

  const run = useCallback(async () => {
    setError(null);
    setProgress(0.08);
    try {
      const blob = await (await fetch(imageUri)).blob();
      const ticket = await endpoints.aux.mealUploadUrl({
        mimeType,
        sizeBytes: blob.size,
      });
      if (cancelled.current) return;
      setProgress(0.3);

      await uploadToSignedUrl(ticket.uploadUrl, blob, mimeType);
      if (cancelled.current) return;
      setProgress(0.55);

      let meal = await endpoints.aux.createMeal(ticket.fileId);
      // Poll at the interval the server asks for; give up rather than spin forever.
      for (let i = 0; i < 40 && meal.status !== "complete" && meal.status !== "failed"; i += 1) {
        if (cancelled.current) return;
        await new Promise((r) => setTimeout(r, meal.pollAfterMs ?? 1200));
        if (cancelled.current) return;
        meal = await endpoints.aux.meal(meal.id);
        setProgress((p) => Math.min(0.95, p + 0.06));
      }
      if (cancelled.current) return;

      if (meal.status !== "complete") {
        setError(meal.failureReason ?? "We couldn't analyse that photo. Try another shot.");
        return;
      }
      setProgress(1);
      setTimeout(() => {
        if (!cancelled.current) navigation.replace("MealReport", { mealId: meal.id });
      }, 300);
    } catch (err) {
      if (cancelled.current) return;
      const e = err as ApiError;
      setError(
        e.isOffline
          ? "You appear to be offline. Check your connection and try again."
          : e.isQuota
          ? "You've used all the meal analyses on your current plan. Upgrade for unlimited scans."
          : e.message || "We couldn't analyse that photo. Please try again."
      );
    }
  }, [imageUri, mimeType, navigation]);

  useEffect(() => {
    cancelled.current = false;
    void run();
  }, [run, attempt]);

  return (
    <ScreenContainer backgroundColor={colors.surface}>
      <View style={styles.logoWrap}>
        <LogoMark size={34} />
      </View>
      <View style={styles.body}>
        <View style={styles.blob}>
          <Image source={{ uri: imageUri }} style={styles.foodCircle} />
        </View>
        {error ? (
          <>
            <Text style={styles.title}>Analysis failed</Text>
            <Text style={styles.errorText}>{error}</Text>
          </>
        ) : (
          <>
            <Text style={styles.title}>You got good taste!</Text>
            <View style={styles.progressTrack}>
              <View style={[styles.progressFill, { width: `${progress * 100}%` }]} />
            </View>
            <Text style={styles.progressLabel}>{Math.round(progress * 100)}% Analysing...</Text>
          </>
        )}
      </View>
      <View style={styles.bottom}>
        {error ? (
          <Button
            label="Try again"
            variant="pill"
            onPress={() => setAttempt((a) => a + 1)}
            style={{ marginBottom: 12 }}
          />
        ) : null}
        <Button
          label="Cancel"
          variant="outlinePill"
          onPress={() => {
            cancelled.current = true;
            navigation.goBack();
          }}
        />
      </View>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  logoWrap: { alignItems: "flex-end", paddingHorizontal: spacing.lg, paddingTop: 8 },
  body: { flex: 1, alignItems: "center", justifyContent: "center", paddingHorizontal: spacing.xl },
  blob: {
    width: 230,
    height: 230,
    borderRadius: 115,
    backgroundColor: colors.primaryLight,
    alignItems: "center",
    justifyContent: "center",
  },
  foodCircle: { width: 160, height: 160, borderRadius: 80 },
  title: { fontSize: 22, fontWeight: "700", color: colors.text, marginTop: 34 },
  errorText: {
    fontSize: 13.5,
    color: colors.secondaryText,
    textAlign: "center",
    lineHeight: 20,
    marginTop: 10,
  },
  progressTrack: {
    width: 200,
    height: 5,
    borderRadius: 3,
    backgroundColor: "#E3E7EE",
    marginTop: 22,
    overflow: "hidden",
  },
  progressFill: { height: 5, borderRadius: 3, backgroundColor: colors.primary },
  progressLabel: { fontSize: 12, color: colors.secondaryText, marginTop: 10 },
  bottom: { paddingBottom: 40, paddingHorizontal: spacing.xl },
});
