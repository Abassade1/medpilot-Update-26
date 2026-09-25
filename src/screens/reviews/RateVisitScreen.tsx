import React, { useState } from "react";
import { Alert, KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text, View } from "react-native";
import ScreenContainer from "../../components/ScreenContainer";
import AppHeader from "../../components/AppHeader";
import Button from "../../components/Button";
import TextField from "../../components/TextField";
import RatingInput from "../../components/RatingInput";
import { useSubmitReview } from "../../api/queries";
import { ApiError } from "../../api/errors";
import { colors, spacing } from "../../theme";
import { RootScreenProps } from "../../navigation/types";

export default function RateVisitScreen({ navigation, route }: RootScreenProps<"RateVisit">) {
  const { targetType, requestId, targetName } = route.params;
  const [rating, setRating] = useState(0);
  const [comment, setComment] = useState("");
  const [error, setError] = useState<string | null>(null);
  const submit = useSubmitReview();

  const onSubmit = () => {
    if (!rating || submit.isPending) return;
    setError(null);
    submit.mutate(
      { targetType, requestId, rating, comment: comment.trim() || undefined },
      {
        onSuccess: () => {
          Alert.alert("Thanks for your review!", "Your rating helps other members choose with confidence.", [
            { text: "Done", onPress: () => navigation.goBack() },
          ]);
        },
        onError: (err) => {
          const e = err as ApiError;
          setError(e.isOffline ? "You appear to be offline. Check your connection and try again." : e.message || "We couldn't submit your review. Please try again.");
        },
      },
    );
  };

  return (
    <ScreenContainer>
      <AppHeader title="Rate your visit" />
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : undefined}>
        <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
          <Text style={styles.target}>{targetName}</Text>
          <Text style={styles.sub}>How was your experience?</Text>

          <View style={styles.card}>
            <RatingInput value={rating} onChange={setRating} />
          </View>

          <TextField
            label="Comments" optional value={comment} onChangeText={setComment} multiline maxLength={500}
            placeholder="Tell other members what stood out"
            containerStyle={{ marginTop: 6 }}
          />

          {error ? <Text style={styles.error}>{error}</Text> : null}

          <Button
            label="Submit review" onPress={onSubmit} disabled={!rating || submit.isPending}
            loading={submit.isPending} style={styles.submit}
          />
        </ScrollView>
      </KeyboardAvoidingView>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  content: { paddingHorizontal: spacing.lg, paddingTop: 12, paddingBottom: 32 },
  target: { fontSize: 17, fontWeight: "700", color: colors.text, textAlign: "center" },
  sub: { fontSize: 13.5, color: colors.secondaryText, textAlign: "center", marginTop: 4, marginBottom: 18 },
  card: { alignItems: "center", paddingVertical: 20 },
  error: { fontSize: 13, color: colors.error, marginTop: 8, textAlign: "center" },
  submit: { marginTop: 20 },
});
