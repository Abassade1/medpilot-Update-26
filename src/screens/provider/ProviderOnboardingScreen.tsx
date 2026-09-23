import React, { useState } from "react";
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import ScreenContainer from "../../components/ScreenContainer";
import AppHeader from "../../components/AppHeader";
import Button from "../../components/Button";
import TextField from "../../components/TextField";
import SelectField from "../../components/SelectField";
import ListStateView from "../../components/ListStateView";
import { useSaveProvider, useSubmitVerification, useTaxonomy } from "../../api/queries";
import { ApiError } from "../../api/errors";
import { colors, radii, spacing } from "../../theme";
import { RootScreenProps } from "../../navigation/types";

/**
 * Providers only go through this once, when the account has no provider profile yet. It walks
 * through the same fields ProviderProfileScreen edits later, split into the steps the business
 * requirement calls for, dynamically labelled by provider type. Editing afterwards happens on the
 * single-page profile screen — a wizard has no advantage once the record already exists.
 */
const STEPS = ["Provider type", "Business info", "Contact", "Location", "Verification"] as const;

interface Form {
  type: string; name: string; description: string;
  phone: string; email: string; website: string;
  address: string; country: string; region: string; city: string; serviceAreas: string;
  licenseInfo: string;
}
const blank: Form = { type: "", name: "", description: "", phone: "", email: "", website: "", address: "", country: "", region: "", city: "", serviceAreas: "", licenseInfo: "" };

export default function ProviderOnboardingScreen({ navigation }: RootScreenProps<"ProviderOnboarding">) {
  const tax = useTaxonomy();
  const save = useSaveProvider();
  const verify = useSubmitVerification();
  const [step, setStep] = useState(0);
  const [form, setForm] = useState<Form>(blank);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(null);

  if (tax.isLoading) return <Shell><ListStateView kind="loading" message="Loading…" /></Shell>;
  if (tax.isError) return <Shell><ListStateView kind="error" message="We couldn't load provider types." onRetry={() => void tax.refetch()} /></Shell>;

  const types = tax.data!.providerTypes;
  const typeLabel = types.find((t) => t.code === form.type)?.label ?? null;
  const set = <K extends keyof Form>(k: K) => (v: Form[K]) => { setForm((f) => ({ ...f, [k]: v })); setErrors((e) => ({ ...e, [k]: "" })); setFormError(null); };

  const validStep = (): boolean => {
    if (step === 0) return !!form.type;
    if (step === 1) return form.name.trim().length >= 2;
    return true;
  };

  const next = () => { if (validStep()) setStep((s) => Math.min(s + 1, STEPS.length - 1)); };
  const back = () => (step === 0 ? navigation.goBack() : setStep((s) => s - 1));

  const finish = () => {
    if (save.isPending) return;
    setErrors({}); setFormError(null);
    const body: Record<string, unknown> = {
      type: form.type, name: form.name.trim(), description: form.description.trim(),
      phone: form.phone.trim() || null, email: form.email.trim() || null, website: form.website.trim() || null,
      address: form.address.trim() || null, country: form.country.trim() || null, region: form.region.trim() || null,
      city: form.city.trim() || null, serviceAreas: form.serviceAreas.trim(),
    };
    save.mutate({ create: true, body }, {
      onSuccess: () => {
        if (form.licenseInfo.trim()) {
          verify.mutate(form.licenseInfo.trim(), { onSettled: () => navigation.replace("ProviderHome") });
        } else {
          navigation.replace("ProviderHome");
        }
      },
      onError: (err) => {
        const e = err as ApiError;
        if (e.fields) {
          setErrors(e.fields);
          // Jump back to whichever step actually owns the field the server rejected.
          if (e.fields.type) setStep(0);
          else if (e.fields.name || e.fields.description) setStep(1);
          else if (e.fields.phone || e.fields.email || e.fields.website) setStep(2);
          else if (e.fields.country || e.fields.city || e.fields.address) setStep(3);
        }
        setFormError(e.isOffline ? "You appear to be offline." : e.fields ? "Check the highlighted field." : e.message || "We couldn't save your profile.");
      },
    });
  };

  return (
    <Shell>
      <View style={styles.progress}>
        {STEPS.map((label, i) => (
          <View key={label} style={styles.progressItem}>
            <View style={[styles.dot, i <= step && styles.dotOn]}>
              {i < step ? <Ionicons name="checkmark" size={12} color="#fff" /> : <Text style={[styles.dotText, i <= step && styles.dotTextOn]}>{i + 1}</Text>}
            </View>
            {i < STEPS.length - 1 ? <View style={[styles.line, i < step && styles.lineOn]} /> : null}
          </View>
        ))}
      </View>
      <Text style={styles.stepTitle}>{STEPS[step]}</Text>

      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : undefined}>
        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
          {step === 0 ? (
            <>
              <Text style={styles.hint}>What kind of provider are you? This shapes the rest of your setup and the fields on your services.</Text>
              <SelectField label="Provider type" placeholder="Select your type" value={typeLabel} options={types.map((t) => t.label)}
                onSelect={(l) => set("type")(types.find((t) => t.label === l)!.code)} />
              {errors.type ? <Text style={styles.err}>{errors.type}</Text> : null}
            </>
          ) : null}
          {step === 1 ? (
            <>
              <TextField label="Business or provider name" value={form.name} onChangeText={set("name")} maxLength={120} error={errors.name} />
              <TextField label="About" optional value={form.description} onChangeText={set("description")} multiline maxLength={1000} error={errors.description} />
            </>
          ) : null}
          {step === 2 ? (
            <>
              <TextField label="Phone" optional value={form.phone} onChangeText={set("phone")} keyboardType="phone-pad" error={errors.phone} />
              <TextField label="Public email" optional value={form.email} onChangeText={set("email")} keyboardType="email-address" autoCapitalize="none" error={errors.email} />
              <TextField label="Website" optional value={form.website} onChangeText={set("website")} autoCapitalize="none" keyboardType="url" error={errors.website} />
            </>
          ) : null}
          {step === 3 ? (
            <>
              <TextField label="Address" optional value={form.address} onChangeText={set("address")} error={errors.address} />
              <TextField label="Country" optional value={form.country} onChangeText={set("country")} error={errors.country} />
              <TextField label="Region or state" optional value={form.region} onChangeText={set("region")} />
              <TextField label="City" optional value={form.city} onChangeText={set("city")} error={errors.city} />
              <TextField label="Service areas" optional value={form.serviceAreas} onChangeText={set("serviceAreas")} multiline placeholder="Neighbourhoods, cities or a radius you cover" />
            </>
          ) : null}
          {step === 4 ? (
            <>
              <Text style={styles.hint}>Give your licence, registration or accreditation details. Until this is reviewed, your services publish for review instead of going live immediately. You can also add this later from your profile.</Text>
              <TextField label="Licence or registration details" optional value={form.licenseInfo} onChangeText={set("licenseInfo")} multiline maxLength={1000} />
            </>
          ) : null}

          {formError ? <Text style={styles.err} accessibilityLiveRegion="polite">{formError}</Text> : null}

          <View style={styles.nav}>
            <Button label={step === 0 ? "Cancel" : "Back"} variant="outlinePill" onPress={back} style={{ flex: 1, marginRight: 10 }} disabled={save.isPending} />
            {step < STEPS.length - 1 ? (
              <Button label="Continue" variant="pill" onPress={next} disabled={!validStep()} style={{ flex: 1 }} />
            ) : (
              <Button label="Finish setup" variant="pill" onPress={finish} loading={save.isPending || verify.isPending} disabled={save.isPending || verify.isPending} style={{ flex: 1 }} />
            )}
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </Shell>
  );
}

function Shell({ children }: { children: React.ReactNode }) {
  return <ScreenContainer><AppHeader title="Become a provider" showBack={false} /><View style={{ flex: 1 }}>{children}</View></ScreenContainer>;
}

const styles = StyleSheet.create({
  progress: { flexDirection: "row", alignItems: "center", paddingHorizontal: spacing.lg, marginTop: 4 },
  progressItem: { flexDirection: "row", alignItems: "center", flex: 1 },
  dot: { width: 24, height: 24, borderRadius: 12, backgroundColor: colors.surfaceAlt, alignItems: "center", justifyContent: "center" },
  dotOn: { backgroundColor: colors.primary },
  dotText: { fontSize: 11, fontWeight: "700", color: colors.secondaryText },
  dotTextOn: { color: "#fff" },
  line: { flex: 1, height: 2, backgroundColor: colors.border, marginHorizontal: 2 },
  lineOn: { backgroundColor: colors.primary },
  stepTitle: { fontSize: 19, fontWeight: "700", color: colors.text, marginTop: 14, marginBottom: 4, paddingHorizontal: spacing.lg },
  content: { paddingHorizontal: spacing.lg, paddingTop: 10, paddingBottom: 40 },
  hint: { fontSize: 13, color: colors.secondaryText, marginBottom: 14, lineHeight: 19 },
  err: { fontSize: 12.5, color: colors.error, marginBottom: 10 },
  nav: { flexDirection: "row", marginTop: 20 },
});
