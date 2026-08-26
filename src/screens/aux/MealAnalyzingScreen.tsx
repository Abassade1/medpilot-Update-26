import React, { useEffect, useState } from "react";
import { View, Text, StyleSheet, Image } from "react-native";
import ScreenContainer from "../../components/ScreenContainer";
import LogoMark from "../../components/LogoMark";
import Button from "../../components/Button";
import { images } from "../../data/mock";
import { colors, spacing } from "../../theme";
import { RootScreenProps } from "../../navigation/types";

export default function MealAnalyzingScreen({ navigation }: RootScreenProps<"MealAnalyzing">) {
  const [progress, setProgress] = useState(0.1);

  useEffect(() => {
    const t = setInterval(() => {
      setProgress((p) => {
        const nextValue = Math.min(1, p + 0.18);
        if (nextValue >= 1) {
          clearInterval(t);
          setTimeout(() => navigation.replace("MealReport"), 350);
        }
        return nextValue;
      });
    }, 550);
    return () => clearInterval(t);
  }, [navigation]);

  return (
    <ScreenContainer backgroundColor={colors.surface}>
      <View style={styles.logoWrap}>
        <LogoMark size={34} />
      </View>
      <View style={styles.body}>
        <View style={styles.blob}>
          <Image source={images.food} style={styles.foodCircle} />
        </View>
        <Text style={styles.title}>You got good taste!</Text>
        <View style={styles.progressTrack}>
          <View style={[styles.progressFill, { width: `${progress * 100}%` }]} />
        </View>
        <Text style={styles.progressLabel}>{Math.round(progress * 100)}% Analysing...</Text>
      </View>
      <View style={styles.bottom}>
        <Button label="Cancel" variant="outlinePill" onPress={() => navigation.goBack()} />
      </View>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  logoWrap: { alignItems: "flex-end", paddingHorizontal: spacing.lg, paddingTop: 8 },
  body: { flex: 1, alignItems: "center", justifyContent: "center" },
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
  bottom: { paddingBottom: 40 },
});
