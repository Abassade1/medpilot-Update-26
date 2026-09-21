import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import ScreenContainer from "../../components/ScreenContainer";
import AppHeader from "../../components/AppHeader";
import TextField from "../../components/TextField";
import PhonePrefix from "../../components/PhonePrefix";
import DateField from "../../components/DateField";
import SelectField from "../../components/SelectField";
import LocationPicker, { deepest, describeLocation, EMPTY_LOCATION, LocationSel } from "../../components/LocationPicker";
import AvailabilityPanel from "../../components/AvailabilityPanel";
import CheckRow from "../../components/CheckRow";
import RadioRow from "../../components/RadioRow";
import Button from "../../components/Button";
import { colors, radii, spacing } from "../../theme";
import ListStateView from "../../components/ListStateView";
import { useAvailability, useCreateTransport, useEmergencyContact, useProvider, useReference } from "../../api/queries";
import { ApiError } from "../../api/errors";
import { newIdempotencyKey } from "../../utils/device";
import { BOOKING_WINDOW_DAYS } from "../../utils/validation";
import { addDays, utcTodayIso } from "../../utils/dates";
import { useMultiStepBack } from "../../hooks/useMultiStepBack";
import { RootScreenProps } from "../../navigation/types";

const titleCase = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

export default function TravelBookingScreen({
  navigation,
  route,
}: RootScreenProps<"TravelBooking">) {
  const [step, setStep] = useState(1);
  const reference = useReference();
  const providerQuery = useProvider(route.params.providerId);
  const createTransport = useCreateTransport();
  const [idempotencyKey] = useState(newIdempotencyKey);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const transportPurposes = reference.data?.transportPurposes ?? [];
  const specialMedicalNeeds = reference.data?.specialNeeds ?? [];
  const relationships = reference.data?.relationships ?? [];
  const aircrafts = providerQuery.data?.aircraft ?? [];

  // Step 1 — pickup
  const [pickupDate, setPickupDate] = useState<string | null>(null);
  const [pickupTime, setPickupTime] = useState<string | null>(null);
  // Errors the server raised on step 1 fields, shown on the fields themselves.
  const [serverErrors, setServerErrors] = useState<{ pickupDate?: string; pickupTime?: string; pickupCountry?: string; dropoffCountry?: string }>({});
  const [pickup, setPickup] = useState<LocationSel>(EMPTY_LOCATION);
  const [pickupAddress, setPickupAddress] = useState("");
  const [takeoff, setTakeoff] = useState<"Airport" | "Helipad">("Helipad");
  const [pickupHelipad, setPickupHelipad] = useState("");
  // Step 2 — drop-off
  const [drop, setDrop] = useState<LocationSel>(EMPTY_LOCATION);
  const [landing, setLanding] = useState<"Airport" | "Helipad">("Helipad");
  const [dropHelipad, setDropHelipad] = useState("");
  const [returnTrip, setReturnTrip] = useState(false);
  // Step 3 — purpose
  const [purposes, setPurposes] = useState<string[]>([]);
  const [otherPurpose, setOtherPurpose] = useState("");
  // Step 4 — special needs
  const [needs, setNeeds] = useState<string[]>([]);
  const [otherNeed, setOtherNeed] = useState("");
  // Step 5 — aircraft
  const [aircraft, setAircraft] = useState<string | null>(null);
  // Step 6 — emergency contact
  const [firstname, setFirstname] = useState("");
  const [lastname, setLastname] = useState("");
  const [phone, setPhone] = useState("");
  const [relationship, setRelationship] = useState<string | null>(null);
  const [accompany, setAccompany] = useState(false);

  // Is the provider chosen on the previous screen able to reach the pickup point?
  const pickupPlace = deepest(pickup);
  const pickupAvail = useAvailability(pickupPlace?.id ?? null);
  const providerReaches = pickupAvail.data
    ? pickupAvail.data.services.some((sv) => sv.providers.some((p) => p.id === route.params.providerId))
    : null;
  const dropPlace = deepest(drop);
  const sameAsPickup = !!pickupPlace && !!dropPlace && pickupPlace.id === dropPlace.id;

  // Reuse the emergency contact from the profile.
  const savedContact = useEmergencyContact();
  const prefilled = useRef(false);
  useEffect(() => {
    const c = savedContact.data?.contact;
    if (c && !prefilled.current) {
      prefilled.current = true;
      setFirstname((v) => v || c.firstName);
      setLastname((v) => v || c.lastName);
      setPhone((v) => v || c.phone);
      setRelationship((v) => v || titleCase(c.relationship));
    }
  }, [savedContact.data]);

  useMultiStepBack(step, useCallback(() => setStep((s) => s - 1), []));

  const titles = [
    "Travel Booking",
    "Travel Booking",
    "Appointment Details",
    "Special Medical Needs",
    "Aircraft in Service",
    "Emergency Contact",
  ];

  const toggle = (list: string[], setList: (v: string[]) => void, value: string) =>
    setList(list.includes(value) ? list.filter((x) => x !== value) : [...list, value]);

  // A submit failure belongs to the step it was raised on.
  useEffect(() => { setSubmitError(null); }, [step]);

  const canNext = (() => {
    switch (step) {
      case 1:
        return !!pickupDate && !!pickupPlace && providerReaches !== false && !pickupAvail.isError;
      case 2:
        return !!dropPlace && !sameAsPickup;
      case 3:
        return purposes.length > 0 || otherPurpose.trim().length > 0;
      case 4:
        return needs.length > 0 || otherNeed.trim().length > 0;
      case 5:
        return !!aircraft || aircrafts.length === 0;
      default:
        return !!(firstname.trim() && lastname.trim() && phone.trim() && relationship);
    }
  })();

  const submit = async () => {
    setSubmitError(null);
    if (!pickupDate || !pickup.country || !drop.country) {
      // Unreachable in normal use (Next is gated on the same checks).
      setStep(!pickupDate || !pickup.country ? 1 : 2);
      return;
    }
    try {
      const created = await createTransport.mutateAsync({
        idempotencyKey,
        body: {
          providerId: route.params.providerId,
          aircraftId: aircraft,
          pickupDate,
          pickupTime: pickupTime || null,
          pickupCountry: pickup.country.name,
          pickupRegion: pickup.region?.name ?? null,
          pickupCity: pickup.city?.name ?? null,
          pickupAddress: pickupAddress.trim() || null,
          pickupSiteType: takeoff.toLowerCase(),
          pickupSiteCode: pickupHelipad.trim() || null,
          dropoffCountry: drop.country.name,
          dropoffRegion: drop.region?.name ?? null,
          dropoffCity: drop.city?.name ?? null,
          dropoffSiteType: landing.toLowerCase(),
          dropoffSiteCode: dropHelipad.trim() || null,
          returnTrip,
          purposeIds: purposes,
          otherPurpose: otherPurpose.trim() || null,
          needIds: needs,
          otherNeed: otherNeed.trim() || null,
          emergencyContact: {
            firstName: firstname.trim(),
            lastName: lastname.trim(),
            phone: phone.trim(),
            relationship: (relationship ?? "other").toLowerCase(),
            accompanies: accompany,
          },
        },
      });
      navigation.replace("BookingSuccess", {
        reference: created.reference,
        kind: "transport",
        detail: { route: "TransportBookingDetail", transportId: created.id },
      });
    } catch (err) {
      const e = err as ApiError;
      if (e.fields?.pickupDate || e.fields?.pickupTime || e.fields?.pickupCountry) {
        setServerErrors({ pickupDate: e.fields.pickupDate, pickupTime: e.fields.pickupTime, pickupCountry: e.fields.pickupCountry });
        setStep(1);
        return;
      }
      if (e.fields?.dropoffCountry) {
        setServerErrors({ dropoffCountry: e.fields.dropoffCountry });
        setStep(2);
        return;
      }
      setSubmitError(
        e.isOffline
          ? "You appear to be offline. Check your connection and try again."
          : e.isQuota
          ? "Emergency evacuation is not included in your current plan. Upgrade to continue."
          : e.message || "We could not submit your request. Please try again."
      );
    }
  };

  const next = () => {
    if (step < 6) setStep(step + 1);
    else void submit();
  };

  const radioPair = (value: "Airport" | "Helipad", set: (v: "Airport" | "Helipad") => void) => (
    <View style={styles.radioPair}>
      <RadioRow label="Airport" selected={value === "Airport"} onPress={() => set("Airport")} />
      <RadioRow
        label="Helipad"
        selected={value === "Helipad"}
        onPress={() => set("Helipad")}
        style={{ marginLeft: 28 }}
      />
    </View>
  );

  return (
    <ScreenContainer>
      <AppHeader
        title="Book Appointment"
        onBack={() => (step > 1 ? setStep((s) => s - 1) : navigation.goBack())}
      />
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
      <ScrollView
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="interactive"
        contentContainerStyle={styles.content}
      >
        <Text style={styles.step}>
          <Text style={styles.stepCurrent}>{step}</Text> of 6
        </Text>
        <Text style={styles.title}>{titles[step - 1]}</Text>

        {step === 1 && (
          <View>
            <Text style={styles.groupLabel}>Pickup details</Text>
            <DateField
              label="Pickup Date"
              value={pickupDate}
              onChange={(v) => { setPickupDate(v); setServerErrors((e) => ({ ...e, pickupDate: undefined })); }}
              min={addDays(utcTodayIso(), 1)}
              max={addDays(utcTodayIso(), BOOKING_WINDOW_DAYS)}
              minMessage="Choose a date after today"
              maxMessage="Choose a date within the next year"
              requiredMessage="Choose the pickup date"
              error={serverErrors.pickupDate}
            />
            <DateField
              label="Pickup Time"
              optional
              mode="time"
              value={pickupTime}
              onChange={(v) => { setPickupTime(v); setServerErrors((e) => ({ ...e, pickupTime: undefined })); }}
              clearable
              error={serverErrors.pickupTime}
            />
            <Text style={styles.groupLabel}>Pickup location</Text>
            <LocationPicker
              value={pickup}
              onChange={(v) => { setPickup(v); setServerErrors((e) => ({ ...e, pickupCountry: undefined })); }}
              detect
              address={pickupAddress}
              onAddressChange={setPickupAddress}
              countryError={serverErrors.pickupCountry}
            />
            {pickupPlace ? (
              <AvailabilityPanel
                place={describeLocation(pickup)}
                loading={pickupAvail.isPending && pickupAvail.isFetching}
                error={pickupAvail.isError}
                data={pickupAvail.data}
                onRetry={() => void pickupAvail.refetch()}
              />
            ) : null}
            {providerReaches === false ? (
              <Text style={styles.blockedNote} accessibilityLiveRegion="polite">
                {providerQuery.data?.name ?? "This provider"} doesn't serve {describeLocation(pickup)}. Choose a different pickup location, or go back and pick another provider.
              </Text>
            ) : null}
            <Text style={styles.groupLabel}>Takeoff Location</Text>
            {radioPair(takeoff, setTakeoff)}
            <TextField
              label={takeoff === "Airport" ? "Airport code" : "Helipad code"}
              optional
              placeholder={takeoff === "Airport" ? "e.g. YYZ" : "Coordinates"}
              value={pickupHelipad}
              onChangeText={setPickupHelipad}
              autoCapitalize="characters"
              autoCorrect={false}
              maxLength={20}
              returnKeyType="done"
              containerStyle={{ marginTop: 14 }}
            />
          </View>
        )}

        {step === 2 && (
          <View>
            <Text style={styles.groupLabel}>Drop-off details</Text>
            <LocationPicker
              value={drop}
              onChange={(v) => { setDrop(v); setServerErrors((e) => ({ ...e, dropoffCountry: undefined })); }}
              countryError={serverErrors.dropoffCountry ?? (sameAsPickup ? "Drop-off must be different from pickup" : undefined)}
            />
            <Text style={styles.groupLabel}>Landing Location</Text>
            {radioPair(landing, setLanding)}
            <TextField
              label={landing === "Airport" ? "Airport code" : "Helipad code"}
              optional
              placeholder={landing === "Airport" ? "e.g. YYZ" : "Coordinates"}
              value={dropHelipad}
              onChangeText={setDropHelipad}
              autoCapitalize="characters"
              autoCorrect={false}
              maxLength={20}
              returnKeyType="done"
              containerStyle={{ marginTop: 14 }}
            />
            <TouchableOpacity style={styles.checkboxRow} onPress={() => setReturnTrip((v) => !v)}>
              <View style={[styles.checkbox, returnTrip && styles.checkboxChecked]}>
                {returnTrip && <Ionicons name="checkmark" size={12} color="#fff" />}
              </View>
              <Text style={styles.checkboxText}>Return Trip Needed</Text>
            </TouchableOpacity>
          </View>
        )}

        {step === 3 && (
          <View>
            <Text style={styles.groupLabel}>Purpose of Transportation</Text>
            {transportPurposes.map((p) => (
              <CheckRow
                key={p.id}
                label={p.label}
                checked={purposes.includes(p.id)}
                onPress={() => toggle(purposes, setPurposes, p.id)}
                selectedStyle="filled"
              />
            ))}
            <Text style={[styles.groupLabel, { marginTop: 8 }]}>Others(Please Specify)</Text>
            <TextField
              placeholder="Other purpose"
              value={otherPurpose}
              onChangeText={setOtherPurpose}
              autoCapitalize="sentences"
              maxLength={200}
              returnKeyType="done"
              accessibilityLabel="Other purpose of transportation"
            />
          </View>
        )}

        {step === 4 && (
          <View>
            {specialMedicalNeeds.map((n) => (
              <CheckRow
                key={n.id}
                label={n.label}
                checked={needs.includes(n.id)}
                onPress={() => toggle(needs, setNeeds, n.id)}
                selectedStyle="filled"
              />
            ))}
            <Text style={[styles.groupLabel, { marginTop: 8 }]}>Others(Please Specify)</Text>
            <TextField
              placeholder="Other need"
              value={otherNeed}
              onChangeText={setOtherNeed}
              autoCapitalize="sentences"
              maxLength={200}
              returnKeyType="done"
              accessibilityLabel="Other special medical need"
            />
          </View>
        )}

        {step === 5 && (
          <View>
            {providerQuery.isPending ? (
              <ListStateView kind="loading" message="Loading aircraft…" />
            ) : providerQuery.isError ? (
              <ListStateView kind="error" onRetry={() => void providerQuery.refetch()} />
            ) : aircrafts.length === 0 ? (
              <ListStateView
                kind="empty"
                title="No aircraft listed"
                message="This provider will assign an aircraft after reviewing your request."
              />
            ) : (
              aircrafts.map((a) => (
                <RadioRow
                  key={a.id}
                  label={a.name}
                  sublabel={a.capacity ?? undefined}
                  selected={aircraft === a.id}
                  onPress={() => setAircraft(a.id)}
                  bordered
                />
              ))
            )}
          </View>
        )}

        {step === 6 && (
          <View>
            <View style={styles.row}>
              <TextField
                label="Firstname"
                placeholder="Firstname"
                value={firstname}
                onChangeText={setFirstname}
                autoCapitalize="words"
                textContentType="givenName"
                maxLength={40}
                returnKeyType="next"
                containerStyle={styles.rowField}
              />
              <TextField
                label="Lastname"
                placeholder="Lastname"
                value={lastname}
                onChangeText={setLastname}
                autoCapitalize="words"
                textContentType="familyName"
                maxLength={40}
                returnKeyType="next"
                containerStyle={[styles.rowField, { marginLeft: 12 }]}
              />
            </View>
            <TextField
              label="Phone number"
              placeholder="Phone number"
              value={phone}
              onChangeText={setPhone}
              keyboardType="phone-pad"
              textContentType="telephoneNumber"
              autoComplete="tel"
              maxLength={20}
              returnKeyType="done"
              left={<PhonePrefix />}
            />
            <SelectField
              label="Relationship"
              value={relationship}
              options={relationships.map(titleCase)}
              onSelect={setRelationship}
            />
            <TouchableOpacity style={styles.checkboxRow} onPress={() => setAccompany((v) => !v)}>
              <View style={[styles.checkbox, accompany && styles.checkboxChecked]}>
                {accompany && <Ionicons name="checkmark" size={12} color="#fff" />}
              </View>
              <Text style={styles.checkboxText}>My Emergency Contact will accompany me</Text>
            </TouchableOpacity>
          </View>
        )}

        <View style={styles.bottom}>
          {submitError ? <Text style={styles.error}>{submitError}</Text> : null}
          <Button
            label={step === 6 ? "Submit" : "Next"}
            variant="pill"
            disabled={!canNext || createTransport.isPending}
            loading={createTransport.isPending}
            onPress={next}
          />
        </View>
      </ScrollView>
      </KeyboardAvoidingView>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  content: { paddingHorizontal: spacing.lg, paddingTop: spacing.sm, flexGrow: 1, paddingBottom: 30 },
  step: { fontSize: 12, color: colors.secondaryText, marginBottom: 6 },
  stepCurrent: { color: colors.primary, fontWeight: "700" },
  title: { fontSize: 21, fontWeight: "700", color: colors.text, marginBottom: 14 },
  groupLabel: { fontSize: 12.5, fontWeight: "500", color: colors.secondaryText, marginBottom: 10 },
  row: { flexDirection: "row" },
  rowField: { flex: 1 },
  radioPair: { flexDirection: "row", alignItems: "center", marginTop: 2 },
  blockedNote: { fontSize: 12.5, color: colors.error, lineHeight: 18, marginBottom: 8 },
  checkboxRow: { flexDirection: "row", alignItems: "center", marginTop: 2 },
  checkbox: {
    width: 18,
    height: 18,
    borderRadius: radii.xs - 2,
    borderWidth: 1.5,
    borderColor: colors.tertiaryText,
    alignItems: "center",
    justifyContent: "center",
  },
  checkboxChecked: { backgroundColor: colors.primary, borderColor: colors.primary },
  checkboxText: { fontSize: 12.5, color: colors.text, marginLeft: 10 },
  bottom: { marginTop: "auto", paddingTop: 30 },
  error: { fontSize: 12.5, color: colors.error, marginBottom: 12, lineHeight: 18 },
});
