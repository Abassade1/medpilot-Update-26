import React, { useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Image,
  ActivityIndicator,
  Platform,
  Alert,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import ScreenContainer from "../../components/ScreenContainer";
import AppHeader from "../../components/AppHeader";
import LogoMark from "../../components/LogoMark";
import { colors, radii, shadows, spacing } from "../../theme";
import ListStateView from "../../components/ListStateView";
import { images } from "../../data/mock";
import { usePlans, useSubscription, qk } from "../../api/queries";
import { endpoints } from "../../api/endpoints";
import { ApiError } from "../../api/errors";
import { useQueryClient } from "@tanstack/react-query";
import { RootScreenProps } from "../../navigation/types";

const PLAN_IMAGE = { basic: images.woman1, pro: images.woman2 } as const;

export default function UpgradeScreen({ navigation }: RootScreenProps<"Upgrade">) {
  const plansQuery = usePlans();
  const subscription = useSubscription();
  const qc = useQueryClient();
  const [purchasing, setPurchasing] = useState(false);
  const currentPlan = subscription.data?.planCode ?? "basic";

  /**
   * Hands the store receipt to the server, which is the only side that decides
   * whether the plan actually changed. There is no client-side entitlement.
   * The StoreKit / Play Billing purchase itself lands in the native build; in
   * development the server's mock driver accepts a sandbox receipt.
   */
  const upgrade = async (productId: string) => {
    if (purchasing) return;
    setPurchasing(true);
    try {
      await endpoints.billing.verifyReceipt({
        platform: Platform.OS === "android" ? "google" : "apple",
        receipt: `sandbox-${Date.now()}-${Math.random().toString(36).slice(2)}`,
        productId,
      });
      await qc.invalidateQueries({ queryKey: qk.subscription });
      await qc.invalidateQueries({ queryKey: ["activities"] });
      navigation.goBack();
    } catch (err) {
      const e = err as ApiError;
      Alert.alert(
        "Upgrade unavailable",
        e.isOffline
          ? "You appear to be offline. Check your connection and try again."
          : e.message || "We couldn't complete that purchase. Please try again."
      );
    } finally {
      setPurchasing(false);
    }
  };

  const plans = plansQuery.data ?? [];

  if (plans.length === 0) {
    return (
      <ScreenContainer>
        <AppHeader title="Upgrade" right={<LogoMark size={26} />} />
        {plansQuery.isError ? (
          <ListStateView kind="error" onRetry={() => void plansQuery.refetch()} />
        ) : (
          <ListStateView kind="loading" message="Loading plans…" />
        )}
      </ScreenContainer>
    );
  }

  return (
    <ScreenContainer>
      <AppHeader title="Upgrade" right={<LogoMark size={26} />} />
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.content}>
        {plans.map((plan) => {
          const isCurrent = plan.code === currentPlan;
          return (
            <View key={plan.id} style={styles.card}>
              <Image source={PLAN_IMAGE[plan.code]} style={styles.cardImage} />
              <View style={styles.cardBody}>
                <Text style={styles.cardTitle}>
                  {plan.name} <Text style={styles.cardPrice}>({plan.priceLabel})</Text>
                </Text>
                {plan.features.map((f) => (
                  <View key={f} style={styles.bulletRow}>
                    <Text style={styles.bullet}>•</Text>
                    <Text style={styles.bulletText}>{f}</Text>
                  </View>
                ))}
                {isCurrent ? (
                  <View style={styles.cardFooter}>
                    <Text style={styles.footerLink}>Your current plan</Text>
                  </View>
                ) : (
                  <TouchableOpacity
                    style={styles.cardFooter}
                    disabled={purchasing}
                    onPress={() => void upgrade(plan.id)}
                    accessibilityRole="button"
                    accessibilityLabel={`Upgrade to ${plan.name}`}
                    accessibilityState={{ disabled: purchasing }}
                  >
                    {purchasing ? (
                      <ActivityIndicator size="small" color={colors.primary} />
                    ) : (
                      <Ionicons name="shield-checkmark-outline" size={14} color={colors.primary} />
                    )}
                    <Text style={[styles.footerLink, { marginLeft: 5 }]}>
                      {purchasing ? "Confirming…" : "Upgrade Now"}
                    </Text>
                  </TouchableOpacity>
                )}
              </View>
            </View>
          );
        })}
      </ScrollView>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  content: { paddingHorizontal: spacing.lg, paddingTop: 16, paddingBottom: 32 },
  card: {
    backgroundColor: "#fff",
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: colors.borderLight,
    marginBottom: 18,
    overflow: "hidden",
    ...shadows.card,
  },
  cardImage: { position: "absolute", right: 0, top: 0, bottom: 0, width: 118, height: "100%" },
  cardBody: { padding: 14, paddingRight: 126 },
  cardTitle: { fontSize: 15.5, fontWeight: "700", color: colors.primary },
  cardPrice: { fontSize: 13, fontWeight: "500", color: colors.primary },
  bulletRow: { flexDirection: "row", marginTop: 7 },
  bullet: { fontSize: 12.5, color: colors.text, marginRight: 6, lineHeight: 17 },
  bulletText: { flex: 1, fontSize: 12.5, color: colors.text, lineHeight: 17 },
  cardFooter: {
    flexDirection: "row",
    alignItems: "center",
    borderTopWidth: 1,
    borderTopColor: colors.borderLight,
    marginTop: 12,
    paddingTop: 10,
  },
  footerLink: { fontSize: 13, fontWeight: "600", color: colors.primary },
});
