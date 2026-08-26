import React, { useCallback, useState } from "react";
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
import * as Location from "expo-location";
import ScreenContainer from "../../components/ScreenContainer";
import AppHeader from "../../components/AppHeader";
import TextField from "../../components/TextField";
import PhonePrefix from "../../components/PhonePrefix";
import SelectField from "../../components/SelectField";
import CheckRow from "../../components/CheckRow";
import RadioRow from "../../components/RadioRow";
import Button from "../../components/Button";
import { colors, radii, spacing } from "../../theme";
import { aircrafts, specialMedicalNeeds, transportPurposes } from "../../data/mock";
import { ensurePermission } from "../../utils/permissions";
import { useMultiStepBack } from "../../hooks/useMultiStepBack";
import { RootScreenProps } from "../../navigation/types";

const COUNTRIES = ["Canada", "United States", "United Arab Emirates", "United Kingdom", "South Korea"];
const PROVINCES = ["Ontario", "Alberta", "Quebec", "British Columbia"];

export default function TravelBookingScreen({ navigation }: RootScreenProps<"TravelBooking">) {
  const [step, setStep] = useState(1);

  // Step 1 — pickup
  const [pickupDate, setPickupDate] = useState("08/30/2024");
  const [pickupTime, setPickupTime] = useState("");
  const [pickupCountry, setPickupCountry] = useState<string | null>(null);
  const [pickupProvince, setPickupProvince] = useState<string | null>(null);
  const [takeoff, setTakeoff] = useState<"Airport" | "Helipad">("Helipad");
  const [pickupHelipad, setPickupHelipad] = useState("");
  const [useCurrentLocation, setUseCurrentLocation] = useState(false);
  const [locating, setLocating] = useState(false);
  // Step 2 — drop-off
  const [dropCountry, setDropCountry] = useState<string | null>(null);
  const [dropProvince, setDropProvince] = useState<string | null>(null);
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

  /**
   * Resolves the device location only when the user opts in, and reverse-geocodes
   * it into the country / province fields. Any failure clears the checkbox so the
   * form never gets stuck in a half-applied state.
   */
  const applyCurrentLocation = useCallback(async () => {
    if (locating) return;
    if (useCurrentLocation) {
      setUseCurrentLocation(false);
      return;
    }
    setLocating(true);
    try {
      const ok = await ensurePermission({
        label: "Location",
        reason: "MedPilot uses your location to set the pickup point for medical transport.",
        status: await Location.getForegroundPermissionsAsync(),
        request: Location.requestForegroundPermissionsAsync,
      });
      if (!ok) return;

      const enabled = await Location.hasServicesEnabledAsync();
      if (!enabled) {
        Alert.alert("Location is off", "Turn on location services to use your current position.");
        return;
      }

      const pos = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.Balanced,
      });
      const [place] = await Location.reverseGeocodeAsync(pos.coords);
      if (place?.country) setPickupCountry(place.country);
      if (place?.region) setPickupProvince(place.region);
      setUseCurrentLocation(true);
    } catch {
      Alert.alert("Couldn't get your location", "Please enter your pickup location manually.");
      setUseCurrentLocation(false);
    } finally {
      setLocating(false);
    }
  }, [locating, useCurrentLocation]);

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

  const canNext = (() => {
    switch (step) {
      case 1:
        return !!pickupDate && !!pickupCountry;
      case 2:
        return !!dropCountry;
      case 3:
        return purposes.length > 0 || otherPurpose.trim().length > 0;
      case 4:
        return needs.length > 0 || otherNeed.trim().length > 0;
      case 5:
        return !!aircraft;
      default:
        return !!(firstname.trim() && lastname.trim() && phone.trim() && relationship);
    }
  })();

  const next = () => {
    if (step < 6) setStep(step + 1);
    else navigation.replace("BookingSuccess");
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
            <View style={styles.row}>
              <TextField
                label="Pickup Date"
                placeholder="MM/DD/YYYY"
                value={pickupDate}
                onChangeText={setPickupDate}
                keyboardType="numbers-and-punctuation"
                maxLength={10}
                returnKeyType="next"
                containerStyle={styles.rowField}
                right={<Ionicons name="calendar-outline" size={16} color={colors.secondaryText} />}
              />
              <TextField
                label="Pickup Time"
                placeholder="Time"
                value={pickupTime}
                onChangeText={setPickupTime}
                keyboardType="numbers-and-punctuation"
                maxLength={8}
                returnKeyType="done"
                containerStyle={[styles.rowField, { marginLeft: 12 }]}
                right={<Ionicons name="time-outline" size={16} color={colors.secondaryText} />}
              />
            </View>
            <SelectField
              label="Pickup Location"
              placeholder="Select Country"
              value={pickupCountry}
              options={COUNTRIES}
              onSelect={setPickupCountry}
            />
            <SelectField
              label="Province/State"
              placeholder="Select"
              value={pickupProvince}
              options={PROVINCES}
              onSelect={setPickupProvince}
            />
            <Text style={styles.groupLabel}>Takeoff Location</Text>
            {radioPair(takeoff, setTakeoff)}
            <TextField
              label="Enter Helipad Code"
              placeholder="Coordinates"
              value={pickupHelipad}
              onChangeText={setPickupHelipad}
              autoCapitalize="characters"
              autoCorrect={false}
              maxLength={20}
              returnKeyType="done"
              containerStyle={{ marginTop: 14 }}
            />
            <TouchableOpacity
              style={styles.checkboxRow}
              onPress={applyCurrentLocation}
              disabled={locating}
              accessibilityRole="checkbox"
              accessibilityLabel="Use my current location"
              accessibilityState={{ checked: useCurrentLocation, disabled: locating }}
            >
              <View style={[styles.checkbox, useCurrentLocation && styles.checkboxChecked]}>
                {useCurrentLocation && <Ionicons name="checkmark" size={12} color="#fff" />}
              </View>
              <Text style={styles.checkboxText}>Use my current location</Text>
              {locating && <ActivityIndicator size="small" color={colors.primary} style={{ marginLeft: 10 }} />}
            </TouchableOpacity>
          </View>
        )}

        {step === 2 && (
          <View>
            <Text style={styles.groupLabel}>Drop-off details</Text>
            <SelectField
              label="Drop-off Location"
              placeholder="Select Country"
              value={dropCountry}
              options={COUNTRIES}
              onSelect={setDropCountry}
            />
            <SelectField
              label="Province/State"
              placeholder="Select"
              value={dropProvince}
              options={PROVINCES}
              onSelect={setDropProvince}
            />
            <Text style={styles.groupLabel}>Landing Location</Text>
            {radioPair(landing, setLanding)}
            <TextField
              label="Enter Helipad Code"
              placeholder="Coordinates"
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
                key={p}
                label={p}
                checked={purposes.includes(p)}
                onPress={() => toggle(purposes, setPurposes, p)}
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
                key={n}
                label={n}
                checked={needs.includes(n)}
                onPress={() => toggle(needs, setNeeds, n)}
                selectedStyle="filled"
              />
            ))}
            <Text style={[styles.groupLabel, { marginTop: 8 }]}>Others(Please Specify)</Text>
            <TextField
              placeholder="Other purpose"
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
            {aircrafts.map((a) => (
              <RadioRow
                key={a.id}
                label={a.name}
                sublabel={a.capacity}
                selected={aircraft === a.id}
                onPress={() => setAircraft(a.id)}
                bordered
              />
            ))}
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
              options={["Partner", "Parent", "Sibling", "Friend", "Other"]}
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
          <Button
            label={step === 6 ? "Submit" : "Next"}
            variant="pill"
            disabled={!canNext}
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
});
