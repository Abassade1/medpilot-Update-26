import React, { useEffect, useRef, useState } from "react";
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import ScreenContainer from "../../components/ScreenContainer";
import AppHeader from "../../components/AppHeader";
import Button from "../../components/Button";
import DateField from "../../components/DateField";
import ListStateView from "../../components/ListStateView";
import { useProviderAvailability, usePutAvailability, useProviderListing } from "../../api/queries";
import { ApiError } from "../../api/errors";
import { formatDate, formatTime } from "../../utils/dates";
import { colors, radii, spacing } from "../../theme";
import { RootScreenProps } from "../../navigation/types";

const DAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
interface W { weekday: number; start: string; end: string }

export default function ListingAvailabilityScreen({ navigation, route }: RootScreenProps<"ListingAvailability">) {
  const { listingId } = route.params;
  const q = useProviderAvailability(listingId);
  const listing = useProviderListing(listingId);
  const save = usePutAvailability(listingId);
  const [windows, setWindows] = useState<W[]>([]);
  const [blackouts, setBlackouts] = useState<string[]>([]);
  const [newBlackout, setNewBlackout] = useState<string | null>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [msg, setMsg] = useState<string | null>(null);
  const seeded = useRef(false);

  useEffect(() => {
    if (q.data && !seeded.current) { seeded.current = true; setWindows(q.data.windows); setBlackouts(q.data.blackouts); }
  }, [q.data]);

  if (q.isLoading) return <Shell><ListStateView kind="loading" message="Loading availability…" /></Shell>;
  if (q.isError) return <Shell><ListStateView kind="error" message="We couldn't load availability." onRetry={() => void q.refetch()} /></Shell>;

  const edit = (i: number, patch: Partial<W>) => { setWindows((w) => w.map((x, n) => (n === i ? { ...x, ...patch } : x))); setErrors({}); setMsg(null); };
  const duration = listing.data?.durationMinutes;

  const onSave = () => {
    if (save.isPending) return;
    setErrors({}); setMsg(null);
    save.mutate({ windows, blackouts }, {
      onSuccess: (r) => setMsg(r.listingStatus === "unpublished" ? "Saved. With no hours set, this listing was unpublished." : "Availability saved"),
      onError: (e) => { const x = e as ApiError; setErrors(x.fields ?? { form: x.message || "We couldn't save." }); },
    });
  };

  return (
    <Shell>
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <Text style={styles.name}>{listing.data?.name}</Text>
        <Text style={styles.hint}>Members can book slots inside these weekly hours{duration ? `, every ${duration} minutes` : ""}. Each slot takes up to {listing.data?.capacity ?? 1} booking(s).</Text>
        {DAYS.map((day, d) => {
          const rows = windows.map((w, i) => ({ w, i })).filter((r) => r.w.weekday === d);
          return (
            <View key={day} style={styles.day}>
              <View style={styles.dayHead}>
                <Text style={styles.dayName}>{day}</Text>
                <TouchableOpacity onPress={() => { setWindows((w) => [...w, { weekday: d, start: "09:00", end: "17:00" }]); setMsg(null); }} accessibilityRole="button" accessibilityLabel={`Add hours on ${day}`}>
                  <Text style={styles.link}>+ Add hours</Text>
                </TouchableOpacity>
              </View>
              {rows.length === 0 ? <Text style={styles.closed}>Closed</Text> : null}
              {rows.map(({ w, i }) => {
                const bad = errors[`windows.${i}.end`] || errors[`windows.${i}.start`];
                return (
                  <View key={i}>
                    <View style={styles.win}>
                      <DateField mode="time" value={w.start} onChange={(v) => v && edit(i, { start: v })} containerStyle={styles.time} />
                      <Text style={styles.to}>to</Text>
                      <DateField mode="time" value={w.end} onChange={(v) => v && edit(i, { end: v })} containerStyle={styles.time} />
                      <TouchableOpacity onPress={() => { setWindows((x) => x.filter((_, n) => n !== i)); setMsg(null); }} accessibilityRole="button" accessibilityLabel={`Remove ${formatTime(w.start)} to ${formatTime(w.end)} on ${day}`}>
                        <Text style={styles.remove}>Remove</Text>
                      </TouchableOpacity>
                    </View>
                    {bad ? <Text style={styles.err}>{bad}</Text> : null}
                  </View>
                );
              })}
            </View>
          );
        })}

        <Text style={styles.h}>Blackout dates</Text>
        <Text style={styles.hint}>Days you are unavailable, such as holidays.</Text>
        {blackouts.map((b) => (
          <View key={b} style={styles.blk}>
            <Text style={styles.dayName}>{formatDate(b)}</Text>
            <TouchableOpacity onPress={() => setBlackouts((x) => x.filter((y) => y !== b))} accessibilityRole="button" accessibilityLabel={`Remove blackout ${formatDate(b)}`}><Text style={styles.remove}>Remove</Text></TouchableOpacity>
          </View>
        ))}
        <DateField label="Add a blackout date" optional value={newBlackout}
          onChange={(v) => { if (v && !blackouts.includes(v)) { setBlackouts((x) => [...x, v].sort()); setMsg(null); } setNewBlackout(null); }} />
        {errors.blackouts || errors.form ? <Text style={styles.err}>{errors.blackouts || errors.form}</Text> : null}
        {msg ? <Text style={styles.ok} accessibilityLiveRegion="polite">{msg}</Text> : null}
        <Button label="Save availability" variant="pill" onPress={onSave} loading={save.isPending} disabled={save.isPending} style={{ marginTop: 16 }} />
        <Button label="Done" variant="outlinePill" onPress={() => navigation.goBack()} style={{ marginTop: 10 }} />
      </ScrollView>
    </Shell>
  );
}

function Shell({ children }: { children: React.ReactNode }) {
  return <ScreenContainer><AppHeader title="Availability" />{children}</ScreenContainer>;
}

const styles = StyleSheet.create({
  content: { paddingHorizontal: spacing.lg, paddingTop: 8, paddingBottom: 48 },
  name: { fontSize: 17, fontWeight: "700", color: colors.text },
  hint: { fontSize: 12.5, color: colors.secondaryText, marginTop: 4, marginBottom: 12, lineHeight: 18 },
  day: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.border, paddingVertical: 10 },
  dayHead: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  dayName: { fontSize: 14, fontWeight: "600", color: colors.text },
  link: { fontSize: 13, fontWeight: "600", color: colors.primary },
  closed: { fontSize: 12.5, color: colors.tertiaryText, marginTop: 4 },
  win: { flexDirection: "row", alignItems: "center", marginTop: 8 },
  time: { flex: 1, marginBottom: 0 },
  to: { marginHorizontal: 8, color: colors.secondaryText },
  remove: { fontSize: 13, color: colors.error, marginLeft: 10 },
  h: { fontSize: 15, fontWeight: "700", color: colors.text, marginTop: 20 },
  blk: { flexDirection: "row", justifyContent: "space-between", paddingVertical: 8 },
  err: { fontSize: 12.5, color: colors.error, marginTop: 4 },
  ok: { fontSize: 13, color: "#1B7A46", marginTop: 8 },
});
