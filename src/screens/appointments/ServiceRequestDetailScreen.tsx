import React from "react";
import { Alert, RefreshControl, ScrollView, StyleSheet, Text, View } from "react-native";
import ScreenContainer from "../../components/ScreenContainer";
import AppHeader from "../../components/AppHeader";
import Button from "../../components/Button";
import ListStateView from "../../components/ListStateView";
import StatusPill from "../../components/StatusPill";
import { useCancelServiceRequest, useServiceRequest } from "../../api/queries";
import { ApiError } from "../../api/errors";
import { formatDate, formatTime } from "../../utils/dates";
import { colors, radii, spacing } from "../../theme";
import { RootScreenProps } from "../../navigation/types";

export default function ServiceRequestDetailScreen({ navigation, route }: RootScreenProps<"ServiceRequestDetail">) {
  const { requestId } = route.params;
  const query = useServiceRequest(requestId);
  const cancel = useCancelServiceRequest(requestId);
  const r = query.data;

  if (!r) {
    return (
      <ScreenContainer>
        <AppHeader title="Request" />
        {query.isError ? (
          <ListStateView
            kind="error"
            title={(query.error as ApiError)?.status === 404 ? "Request not found" : undefined}
            message={(query.error as ApiError)?.status === 404 ? "It may have been removed." : "We couldn't load this request."}
            onRetry={(query.error as ApiError)?.status === 404 ? undefined : () => void query.refetch()}
          />
        ) : (
          <ListStateView kind="loading" message="Loading request…" />
        )}
      </ScreenContainer>
    );
  }

  const confirmCancel = () =>
    Alert.alert("Cancel this request?", "The provider will be told you no longer need it.", [
      { text: "Keep request", style: "cancel" },
      {
        text: "Cancel request",
        style: "destructive",
        onPress: () =>
          cancel.mutate(undefined, {
            onError: (e) => Alert.alert("Couldn't cancel", (e as ApiError).message || "Please try again."),
          }),
      },
    ]);

  return (
    <ScreenContainer>
      <AppHeader title="Request" />
      <ScrollView
        contentContainerStyle={styles.content}
        refreshControl={<RefreshControl refreshing={query.isRefetching} onRefresh={() => void query.refetch()} />}
      >
        <View style={styles.card}>
          <Text style={styles.kind}>{r.kindLabel}</Text>
          <Text style={styles.target}>{r.target.name}</Text>
          <Text style={styles.sub}>{r.target.subtitle}</Text>
          <View style={styles.statusRow}>
            <StatusPill status={r.status} />
            <Text style={styles.ref} selectable>{r.reference}</Text>
          </View>
        </View>

        <View style={styles.card}>
          {r.service ? <Row label="Service" value={r.service.name} hint={r.service.priceLabel ?? undefined} /> : null}
          <Row label={r.endDate ? "From" : "Preferred date"} value={r.preferredDate ? formatDate(r.preferredDate) : "Flexible"} />
          {r.endDate ? <Row label="Until" value={formatDate(r.endDate)} /> : null}
          {r.preferredTime ? <Row label="Preferred time" value={formatTime(r.preferredTime)} /> : null}
          {r.details?.petName ? <Row label="Pet" value={`${r.details.petName}${r.details.petType ? ` (${r.details.petType})` : ""}`} /> : null}
          {r.message ? <Row label="Your note" value={r.message} /> : null}
        </View>

        {r.status === "cancelled" ? (
          <Text style={styles.cancelled}>This request was cancelled{r.cancelledReason ? `: ${r.cancelledReason}` : "."}</Text>
        ) : null}

        <View style={{ marginTop: 20 }}>
          {r.canCancel ? (
            <Button label="Cancel request" variant="outlinePill" tone="danger" onPress={confirmCancel} loading={cancel.isPending} disabled={cancel.isPending} />
          ) : null}
          <Button
            label="Back to appointments"
            variant="outlinePill"
            onPress={() => navigation.navigate("MainTabs", { screen: "AppointmentsTab" } as never)}
            style={{ marginTop: 10 }}
          />
        </View>
      </ScrollView>
    </ScreenContainer>
  );
}

function Row({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <View style={styles.row}>
      <Text style={styles.rowLabel}>{label}</Text>
      <View style={{ flex: 1, alignItems: "flex-end" }}>
        <Text style={styles.rowValue}>{value}</Text>
        {hint ? <Text style={styles.hint}>{hint}</Text> : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  content: { paddingHorizontal: spacing.lg, paddingTop: 12, paddingBottom: 32 },
  card: { backgroundColor: "#fff", borderRadius: radii.md, borderWidth: 1, borderColor: colors.borderLight, padding: 14, marginBottom: 12 },
  kind: { fontSize: 12, fontWeight: "700", color: colors.primary, textTransform: "uppercase", letterSpacing: 0.4 },
  target: { fontSize: 17, fontWeight: "700", color: colors.text, marginTop: 4 },
  sub: { fontSize: 12.5, color: colors.secondaryText, marginTop: 2 },
  statusRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginTop: 12 },
  ref: { fontSize: 12.5, fontWeight: "600", color: colors.text },
  row: { flexDirection: "row", justifyContent: "space-between", paddingVertical: 8 },
  rowLabel: { fontSize: 13, color: colors.secondaryText, width: 118 },
  rowValue: { fontSize: 13.5, fontWeight: "600", color: colors.text, textAlign: "right" },
  hint: { fontSize: 11.5, color: colors.secondaryText, marginTop: 1 },
  cancelled: { fontSize: 13, color: colors.error, marginTop: 4 },
});
