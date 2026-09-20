import React, { useState } from "react";
import { ActivityIndicator, Alert, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import * as Location from "expo-location";
import SelectField from "./SelectField";
import TextField from "./TextField";
import { useLocations } from "../api/queries";
import { endpoints } from "../api/endpoints";
import { ensurePermission } from "../utils/permissions";
import { colors, radii } from "../theme";
import type { LocationDto } from "../api/types";

export interface LocationSel {
  country: LocationDto | null;
  region: LocationDto | null;
  city: LocationDto | null;
}
export const EMPTY_LOCATION: LocationSel = { country: null, region: null, city: null };

/** The most specific place chosen so far — what availability is looked up for. */
export const deepest = (s: LocationSel): LocationDto | null => s.city ?? s.region ?? s.country;

export function describeLocation(s: LocationSel): string {
  return [s.city?.name, s.region?.name, s.country?.name].filter(Boolean).join(", ");
}

interface Props {
  value: LocationSel;
  onChange: (next: LocationSel) => void;
  /** Restrict every list to places this provider serves. */
  coveredBy?: string;
  /** Adds "Use my current location" and address search above the dropdowns. */
  detect?: boolean;
  countryLabel?: string;
  /** Called with the free-text address the member typed (kept for the booking, not for lookup). */
  onAddressChange?: (address: string) => void;
  address?: string;
  countryError?: string;
}

/**
 * Country → Province/State → City, each list loaded only once the level above is chosen, so an
 * irrelevant option can never be offered. Current-location and address search fill the same
 * three fields (matching the device's geocode onto the location tree), so a member can always
 * correct what was detected by hand.
 */
export default function LocationPicker({
  value, onChange, coveredBy, detect, countryLabel = "Country", onAddressChange, address, countryError,
}: Props) {
  const countries = useLocations(undefined, coveredBy);
  const regions = useLocations(value.country?.id, coveredBy, !!value.country);
  const cities = useLocations(value.region?.id, coveredBy, !!value.region);
  const [busy, setBusy] = useState<"gps" | "search" | null>(null);
  const [note, setNote] = useState<{ tone: "ok" | "warn"; text: string } | null>(null);
  const [addrText, setAddrText] = useState(address ?? "");

  const byName = (list: LocationDto[] | undefined, name: string) => list?.find((l) => l.name === name) ?? null;

  const applyGeocode = async (place: Location.LocationGeocodedAddress | undefined) => {
    if (!place?.country) {
      setNote({ tone: "warn", text: "We couldn't work out the country. Choose it below." });
      return;
    }
    const res = await endpoints.catalog.resolveLocation({
      country: place.country ?? undefined,
      region: place.region ?? undefined,
      city: place.city ?? place.subregion ?? undefined,
    });
    if (!res.matched || !res.country) {
      setNote({ tone: "warn", text: `We don't operate in ${place.country} yet. Choose a location below.` });
      return;
    }
    onChange({ country: res.country, region: res.region, city: res.city });
    setNote(
      res.matchedLevel === "city"
        ? { tone: "ok", text: "Location set. You can adjust it below." }
        : { tone: "warn", text: `We matched ${res.matchedLevel === "region" ? "your province/state" : "your country"} only. Pick a more specific place if you can.` },
    );
  };

  const useMyLocation = async () => {
    if (busy) return;
    setBusy("gps");
    setNote(null);
    try {
      const ok = await ensurePermission({
        label: "Location",
        reason: "MedPilot uses your location to show the services available where you are.",
        status: await Location.getForegroundPermissionsAsync(),
        request: Location.requestForegroundPermissionsAsync,
      });
      if (!ok) return;
      if (!(await Location.hasServicesEnabledAsync())) {
        Alert.alert("Location is off", "Turn on location services, or choose your location below.");
        return;
      }
      const pos = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
      const [place] = await Location.reverseGeocodeAsync(pos.coords);
      await applyGeocode(place);
    } catch {
      setNote({ tone: "warn", text: "Couldn't get your location. Enter it manually below." });
    } finally {
      setBusy(null);
    }
  };

  const searchAddress = async () => {
    const text = addrText.trim();
    if (text.length < 3 || busy) return;
    setBusy("search");
    setNote(null);
    try {
      const hits = await Location.geocodeAsync(text);
      if (!hits.length) {
        setNote({ tone: "warn", text: "We couldn't find that address. Check the spelling or choose a location below." });
        return;
      }
      const [place] = await Location.reverseGeocodeAsync(hits[0]!);
      await applyGeocode(place);
    } catch {
      setNote({ tone: "warn", text: "Address search isn't available right now. Choose a location below." });
    } finally {
      setBusy(null);
    }
  };

  return (
    <View>
      {detect ? (
        <>
          <TouchableOpacity style={styles.gps} onPress={useMyLocation} disabled={!!busy} accessibilityRole="button" accessibilityLabel="Use my current location">
            {busy === "gps" ? <ActivityIndicator size="small" color={colors.primary} /> : <Ionicons name="locate" size={17} color={colors.primary} />}
            <Text style={styles.gpsText}>Use my current location</Text>
          </TouchableOpacity>
          <TextField
            label="Address"
            optional
            placeholder="Street address, city"
            value={addrText}
            onChangeText={(t) => { setAddrText(t); onAddressChange?.(t); }}
            onSubmitEditing={searchAddress}
            returnKeyType="search"
            maxLength={160}
            right={
              <TouchableOpacity onPress={searchAddress} disabled={!!busy || addrText.trim().length < 3} accessibilityRole="button" accessibilityLabel="Search address">
                {busy === "search" ? <ActivityIndicator size="small" color={colors.primary} /> : <Ionicons name="search" size={18} color={addrText.trim().length < 3 ? colors.tertiaryText : colors.primary} />}
              </TouchableOpacity>
            }
          />
          {note ? (
            <View style={[styles.note, note.tone === "ok" ? styles.noteOk : styles.noteWarn]} accessibilityLiveRegion="polite">
              <Ionicons name={note.tone === "ok" ? "checkmark-circle" : "information-circle"} size={16} color={note.tone === "ok" ? "#1B7A46" : "#9A5B00"} />
              <Text style={[styles.noteText, { color: note.tone === "ok" ? "#1B7A46" : "#7A4A00" }]}>{note.text}</Text>
            </View>
          ) : null}
        </>
      ) : null}

      <SelectField
        label={countryLabel}
        placeholder={countries.isPending ? "Loading…" : "Select country"}
        value={value.country?.name ?? null}
        options={(countries.data ?? []).map((l) => l.name)}
        onSelect={(n) => {
          const c = byName(countries.data, n);
          if (c?.id !== value.country?.id) onChange({ country: c, region: null, city: null });
        }}
      />
      {countryError ? <Text style={styles.error}>{countryError}</Text> : null}
      {countries.isError ? <Text style={styles.error}>Couldn't load locations. Check your connection.</Text> : null}
      {value.country ? (
        (regions.data?.length ?? 0) > 0 || regions.isPending ? (
          <SelectField
            label="Province / State"
            optional
            placeholder={regions.isPending ? "Loading…" : "Select"}
            value={value.region?.name ?? null}
            options={(regions.data ?? []).map((l) => l.name)}
            onSelect={(n) => {
              const r = byName(regions.data, n);
              if (r?.id !== value.region?.id) onChange({ ...value, region: r, city: null });
            }}
          />
        ) : null
      ) : null}
      {value.region && ((cities.data?.length ?? 0) > 0 || cities.isPending) ? (
        <SelectField
          label="City / Location"
          optional
          placeholder={cities.isPending ? "Loading…" : "Select"}
          value={value.city?.name ?? null}
          options={(cities.data ?? []).map((l) => l.name)}
          onSelect={(n) => onChange({ ...value, city: byName(cities.data, n) })}
        />
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  gps: {
    flexDirection: "row", alignItems: "center", alignSelf: "flex-start", paddingVertical: 8, paddingHorizontal: 12,
    borderRadius: 18, borderWidth: 1, borderColor: colors.primary, marginBottom: 12,
  },
  gpsText: { fontSize: 13, fontWeight: "600", color: colors.primary, marginLeft: 8 },
  note: { flexDirection: "row", alignItems: "flex-start", borderRadius: radii.sm, padding: 10, marginBottom: 12 },
  noteOk: { backgroundColor: colors.successBg },
  noteWarn: { backgroundColor: "#FFF1D6" },
  noteText: { flex: 1, fontSize: 12.5, lineHeight: 17, marginLeft: 8 },
  error: { fontSize: 12.5, color: colors.error, marginTop: -8, marginBottom: 10 },
});
