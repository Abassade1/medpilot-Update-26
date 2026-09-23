import React, { useState } from "react";
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import ScreenContainer from "../../components/ScreenContainer";
import AppHeader from "../../components/AppHeader";
import Button from "../../components/Button";
import DateField from "../../components/DateField";
import TextField from "../../components/TextField";
import ListStateView from "../../components/ListStateView";
import { useBookListing, useListingDetail, useListingSlots } from "../../api/queries";
import { ApiError } from "../../api/errors";
import { newIdempotencyKey } from "../../utils/device";
import { addDays, formatDateLong, formatTime, utcTodayIso } from "../../utils/dates";
import { BOOKING_WINDOW_DAYS } from "../../utils/validation";
import { colors, radii, spacing } from "../../theme";
import { RootScreenProps } from "../../navigation/types";

export default function ListingBookScreen({ navigation, route }: RootScreenProps<"ListingBook">) {
  const { listingId } = route.params;
  const q = useListingDetail(listingId);
  const [date, setDate] = useState<string | null>(null);
  const [time, setTime] = useState<string | null>(null);
  const [notes, setNotes] = useState("");
  const [phone, setPhone] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [key, setKey] = useState(newIdempotencyKey);
  const slots = useListingSlots(listingId, date);
  const book = useBookListing(listingId);
  const l = q.data;

  if (!l) {
    return <ScreenContainer><AppHeader title="Book" />{q.isError ? <ListStateView kind="error" message="This listing isn't available." onRetry={() => void q.refetch()} /> : <ListStateView kind="loading" message="Loading…" />}</ScreenContainer>;
  }

  const submit = () => {
    if (!date || !time || book.isPending) return;
    setError(null); setFieldErrors({});
    book.mutate({ body: { date, time, ...(notes.trim() ? { notes: notes.trim() } : {}), ...(phone.trim() ? { contactPhone: phone.trim() } : {}) }, idempotencyKey: key }, {
      onSuccess: (r) => navigation.replace("ServiceRequestDetail", { requestId: r.id, notice: "Booking requested. The provider will confirm it." }),
      onError: (e) => {
        const x = e as ApiError;
        setKey(newIdempotencyKey()); // a failed attempt must not be replayed as the same request
        if (x.fields) setFieldErrors(x.fields);
        if (x.status === 409) { setTime(null); void slots.refetch(); }
        setError(x.isOffline ? "You appear to be offline. Check your connection and try again." : x.message || "We couldn't complete the booking.");
      },
    });
  };

  return (
    <ScreenContainer>
      <AppHeader title="Book" />
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : undefined}>
        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
          <Text style={styles.name}>{l.name}</Text>
          <Text style={styles.meta}>{l.providerProfile.name} · {l.priceLabel}{l.durationMinutes ? ` · ${l.durationMinutes} min` : ""}</Text>
          <DateField label="Date" value={date} onChange={(v) => { setDate(v); setTime(null); setError(null); }} min={addDays(utcTodayIso(), 1)} max={addDays(utcTodayIso(), BOOKING_WINDOW_DAYS)}
            minMessage="Choose a date after today" maxMessage="Choose a date within the next year" requiredMessage="Choose a date" error={fieldErrors.date} containerStyle={{ marginTop: 16 }} />
          {date ? (
            <View style={{ marginBottom: 12 }}>
              <Text style={styles.label}>Available times on {formatDateLong(date)}</Text>
              {slots.isLoading ? <Text style={styles.meta}>Checking times…</Text> : slots.isError ? (
                <Text style={styles.err}>We couldn't load times. <Text style={styles.link} onPress={() => void slots.refetch()}>Try again</Text></Text>
              ) : slots.data && slots.data.slots.length ? (
                <View style={styles.slots}>
                  {slots.data.slots.map((s) => (
                    <TouchableOpacity key={s.time} style={[styles.slot, time === s.time && styles.slotOn]} onPress={() => { setTime(s.time); setError(null); }} accessibilityRole="button" accessibilityState={{ selected: time === s.time }} accessibilityLabel={`${formatTime(s.time)}, ${s.remaining} left`}>
                      <Text style={[styles.slotText, time === s.time && { color: "#fff" }]}>{formatTime(s.time)}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
              ) : <Text style={styles.meta}>{slots.data?.reason || "No times are free on this day. Try another date."}</Text>}
              {fieldErrors.time ? <Text style={styles.err}>{fieldErrors.time}</Text> : null}
            </View>
          ) : null}
          <TextField label="Contact phone" optional value={phone} onChangeText={setPhone} keyboardType="phone-pad" error={fieldErrors.contactPhone} />
          <TextField label="Notes for the provider" optional value={notes} onChangeText={setNotes} multiline maxLength={500} error={fieldErrors.notes} />
          {l.requirements ? <Text style={styles.meta}>Please note: {l.requirements}</Text> : null}
          {error ? <Text style={styles.err} accessibilityLiveRegion="polite">{error}</Text> : null}
          <Button label="Request booking" variant="pill" onPress={submit} loading={book.isPending} disabled={!date || !time || book.isPending} style={{ marginTop: 16 }} />
        </ScrollView>
      </KeyboardAvoidingView>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  content: { paddingHorizontal: spacing.lg, paddingBottom: 40 },
  name: { fontSize: 20, fontWeight: "700", color: colors.text },
  meta: { fontSize: 13, color: colors.secondaryText, marginTop: 4, lineHeight: 18 },
  label: { fontSize: 13, fontWeight: "500", color: colors.text, marginBottom: 8 },
  slots: { flexDirection: "row", flexWrap: "wrap" },
  slot: { paddingHorizontal: 14, paddingVertical: 9, borderRadius: radii.sm, borderWidth: 1, borderColor: colors.border, marginRight: 8, marginBottom: 8 },
  slotOn: { backgroundColor: colors.primary, borderColor: colors.primary },
  slotText: { fontSize: 14, color: colors.text },
  err: { fontSize: 12.5, color: colors.error, marginTop: 6, lineHeight: 18 },
  link: { color: colors.primary, fontWeight: "600" },
});
