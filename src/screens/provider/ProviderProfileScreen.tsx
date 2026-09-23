import React, { useEffect, useRef, useState } from "react";
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text, View } from "react-native";
import ScreenContainer from "../../components/ScreenContainer";
import AppHeader from "../../components/AppHeader";
import Button from "../../components/Button";
import TextField from "../../components/TextField";
import SelectField from "../../components/SelectField";
import StatusPill from "../../components/StatusPill";
import { ImagePickerSlot } from "../../components/ImagePickerField";
import ListStateView from "../../components/ListStateView";
import { useMyProvider, useSaveProvider, useSubmitVerification, useTaxonomy } from "../../api/queries";
import { ApiError } from "../../api/errors";
import { colors, radii, spacing } from "../../theme";
import { RootScreenProps } from "../../navigation/types";

const TEXT_KEYS = ["name", "description", "phone", "email", "website", "address", "country", "region", "city", "serviceAreas", "operatingHours", "languages", "certifications", "logoUrl", "coverUrl"] as const;
type Form = Record<(typeof TEXT_KEYS)[number], string> & { type: string };
const blank = (): Form => ({ ...(Object.fromEntries(TEXT_KEYS.map((k) => [k, ""])) as Form), type: "" });

export default function ProviderProfileScreen({ navigation }: RootScreenProps<"ProviderProfile">) {
  const me = useMyProvider();
  const tax = useTaxonomy();
  const save = useSaveProvider();
  const verify = useSubmitVerification();
  const provider = me.data?.provider ?? null;
  const [form, setForm] = useState<Form>(blank());
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [msg, setMsg] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [licence, setLicence] = useState("");
  const seeded = useRef(false);

  useEffect(() => {
    if (me.isSuccess && !seeded.current) {
      seeded.current = true;
      if (provider) {
        const f = blank();
        f.type = provider.type;
        for (const k of TEXT_KEYS) f[k] = (provider[k] as string | null) ?? "";
        setForm(f);
        setLicence(provider.verificationInfo ?? "");
      }
    }
  }, [me.isSuccess, provider]);

  if (me.isLoading || tax.isLoading) return <Shell><ListStateView kind="loading" message="Loading…" /></Shell>;
  if (me.isError || tax.isError) return <Shell><ListStateView kind="error" message="We couldn't load this page." onRetry={() => { void me.refetch(); void tax.refetch(); }} /></Shell>;

  const types = tax.data!.providerTypes;
  const set = (k: keyof Form) => (v: string) => { setForm((f) => ({ ...f, [k]: v })); setErrors((e) => ({ ...e, [k]: "" })); setMsg(null); };
  const isNew = !provider;

  const onSave = () => {
    if (save.isPending) return;
    setErrors({}); setFormError(null); setMsg(null);
    const body: Record<string, unknown> = {};
    for (const k of TEXT_KEYS) {
      const v = form[k].trim();
      if (v || !isNew) body[k] = v === "" && ["phone", "email", "website", "address", "country", "region", "city", "logoUrl", "coverUrl"].includes(k) ? null : v;
    }
    if (isNew) body.type = form.type;
    save.mutate({ create: isNew, body }, {
      onSuccess: () => { setMsg("Profile saved"); if (isNew) navigation.replace("ProviderHome"); },
      onError: (err) => {
        const e = err as ApiError;
        if (e.fields) setErrors(e.fields);
        setFormError(e.isOffline ? "You appear to be offline." : e.fields ? "Check the highlighted fields." : e.message || "We couldn't save your profile.");
      },
    });
  };

  const onVerify = () => {
    if (verify.isPending) return;
    setErrors((e) => ({ ...e, licenseInfo: "" }));
    verify.mutate(licence.trim(), {
      onSuccess: () => setMsg("Verification submitted"),
      onError: (err) => setErrors((e) => ({ ...e, licenseInfo: (err as ApiError).fields?.licenseInfo ?? (err as ApiError).message })),
    });
  };

  const typeLabel = types.find((t) => t.code === form.type)?.label ?? null;
  const f = (k: keyof Form, label: string, extra: object = {}, optional = true) => (
    <TextField label={label} optional={optional} value={form[k]} onChangeText={set(k)} error={errors[k] || undefined} {...extra} />
  );

  return (
    <Shell>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : undefined}>
        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
          {provider ? <View style={styles.status}><Text style={styles.statusLabel}>Verification</Text><StatusPill status={provider.verificationStatus} /></View> : null}
          {isNew ? (
            <SelectField label="Provider type" placeholder="Select your type" value={typeLabel} options={types.map((t) => t.label)}
              onSelect={(l) => set("type")(types.find((t) => t.label === l)!.code)} />
          ) : (
            <Text style={styles.fixedType}>{provider!.typeLabel}</Text>
          )}
          {errors.type ? <Text style={styles.err}>{errors.type}</Text> : null}
          {f("name", "Business or provider name", { maxLength: 120 }, false)}
          {f("description", "About", { multiline: true, maxLength: 1000 })}
          {f("phone", "Phone", { keyboardType: "phone-pad" })}
          {f("email", "Public email", { keyboardType: "email-address", autoCapitalize: "none" })}
          {f("website", "Website", { autoCapitalize: "none", keyboardType: "url" })}
          {f("address", "Address")}
          {f("country", "Country")}
          {f("region", "Region or state")}
          {f("city", "City")}
          {f("serviceAreas", "Service areas", { multiline: true })}
          {f("operatingHours", "Operating hours")}
          {f("languages", "Languages (comma separated)")}
          {f("certifications", "Certifications", { multiline: true })}
          <ImagePickerSlot label="Logo" value={form.logoUrl || null} onChange={(url) => set("logoUrl")(url ?? "")} onError={setFormError} />
          <ImagePickerSlot label="Cover photo" value={form.coverUrl || null} onChange={(url) => set("coverUrl")(url ?? "")} onError={setFormError} />
          {formError ? <Text style={styles.err} accessibilityLiveRegion="polite">{formError}</Text> : null}
          {msg ? <Text style={styles.ok} accessibilityLiveRegion="polite">{msg}</Text> : null}
          <Button label={isNew ? "Create provider profile" : "Save profile"} variant="pill" onPress={onSave} loading={save.isPending} disabled={save.isPending || (isNew && !form.type)} style={{ marginTop: 10 }} />

          {provider && provider.verificationStatus !== "verified" ? (
            <View style={styles.verify}>
              <Text style={styles.h}>Verification</Text>
              <Text style={styles.hint}>Give your licence, registration or accreditation details. Our team reviews them before your services go live.</Text>
              <TextField label="Licence or registration details" value={licence} onChangeText={setLicence} multiline maxLength={1000} error={errors.licenseInfo || undefined} />
              <Button label={provider.verificationStatus === "pending" ? "Update submission" : "Submit for verification"} variant="outlinePill" onPress={onVerify} loading={verify.isPending} disabled={verify.isPending || !licence.trim()} />
            </View>
          ) : null}
        </ScrollView>
      </KeyboardAvoidingView>
    </Shell>
  );
}

function Shell({ children }: { children: React.ReactNode }) {
  return <ScreenContainer><AppHeader title="Business profile" />{children}</ScreenContainer>;
}

const styles = StyleSheet.create({
  content: { paddingHorizontal: spacing.lg, paddingTop: 8, paddingBottom: 40 },
  status: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 12 },
  statusLabel: { fontSize: 13, color: colors.secondaryText },
  fixedType: { fontSize: 14, fontWeight: "600", color: colors.primary, marginBottom: 12 },
  err: { fontSize: 12.5, color: colors.error, marginBottom: 8, lineHeight: 18 },
  ok: { fontSize: 13, color: "#1B7A46", marginBottom: 6 },
  verify: { marginTop: 28, backgroundColor: colors.surfaceAlt, borderRadius: radii.md, padding: 14 },
  h: { fontSize: 15, fontWeight: "700", color: colors.text },
  hint: { fontSize: 12.5, color: colors.secondaryText, marginTop: 4, marginBottom: 10, lineHeight: 18 },
});
