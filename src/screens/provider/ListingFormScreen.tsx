import React, { useEffect, useRef, useState } from "react";
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text, View } from "react-native";
import ScreenContainer from "../../components/ScreenContainer";
import AppHeader from "../../components/AppHeader";
import Button from "../../components/Button";
import TextField from "../../components/TextField";
import SelectField from "../../components/SelectField";
import CheckRow from "../../components/CheckRow";
import DynamicField from "../../components/DynamicField";
import StatusPill from "../../components/StatusPill";
import ListStateView from "../../components/ListStateView";
import { useListingAction, useMyProvider, useProviderListing, useProviderListings, useSaveListing, useTaxonomy } from "../../api/queries";
import { ApiError } from "../../api/errors";
import { centsToDollars, dollarsToCents } from "../../utils/money";
import { colors, radii, spacing } from "../../theme";
import { RootScreenProps } from "../../navigation/types";

interface Form {
  name: string; category: string; subcategory: string; description: string;
  price: string; priceType: string; duration: string; capacity: string;
  locationModes: string[]; country: string; region: string; city: string; radius: string;
  requirements: string; preparation: string; cancellationPolicy: string; terms: string;
  attributes: Record<string, unknown>; includes: { label: string; listingId?: string }[]; images: string;
}
const empty: Form = {
  name: "", category: "", subcategory: "", description: "", price: "", priceType: "fixed", duration: "", capacity: "1",
  locationModes: [], country: "", region: "", city: "", radius: "", requirements: "", preparation: "", cancellationPolicy: "", terms: "",
  attributes: {}, includes: [], images: "",
};

export default function ListingFormScreen({ navigation, route }: RootScreenProps<"ListingForm">) {
  const { listingId } = route.params;
  const me = useMyProvider();
  const tax = useTaxonomy();
  const existing = useProviderListing(listingId);
  const services = useProviderListings("service");
  const [kind] = useState<"service" | "package">(route.params.kind ?? "service");
  const [id, setId] = useState<string | undefined>(listingId);
  const save = useSaveListing(id);
  const act = useListingAction();
  const [form, setForm] = useState<Form>(empty);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const seeded = useRef(false);
  const busy = save.isPending || act.isPending;

  const l = existing.data;
  const effKind = l?.kind ?? kind;

  useEffect(() => {
    if (l && !seeded.current) {
      seeded.current = true;
      setForm({
        name: l.name, category: l.category, subcategory: l.subcategory, description: l.description,
        price: centsToDollars(l.priceAmount), priceType: l.priceType, duration: l.durationMinutes ? String(l.durationMinutes) : "",
        capacity: String(l.capacity), locationModes: l.locationModes, country: l.country ?? "", region: l.region ?? "", city: l.city ?? "",
        radius: l.serviceRadiusKm ? String(l.serviceRadiusKm) : "", requirements: l.requirements, preparation: l.preparation,
        cancellationPolicy: l.cancellationPolicy, terms: l.terms, attributes: l.attributes, includes: l.includes, images: l.images.join("\n"),
      });
    }
  }, [l]);

  const provider = me.data?.provider;
  const loading = me.isLoading || tax.isLoading || (!!listingId && existing.isLoading);
  if (loading) return <Shell><ListStateView kind="loading" message="Loading…" /></Shell>;
  if (me.isError || tax.isError || (!!listingId && existing.isError)) {
    return <Shell><ListStateView kind="error" message="We couldn't load this form." onRetry={() => { void me.refetch(); void tax.refetch(); void existing.refetch(); }} /></Shell>;
  }
  if (!provider) {
    return <Shell><ListStateView kind="empty" title="Set up your provider profile first" actionLabel="Set up profile" onAction={() => navigation.replace("ProviderProfile")} /></Shell>;
  }

  const type = tax.data!.providerTypes.find((t) => t.code === provider.type)!;
  const cat = type.categories.find((c) => c.code === form.category);
  const dynamic = effKind === "package" ? type.packageFields : type.serviceFields;
  const locked = l?.status === "published" || l?.status === "review";
  const set = <K extends keyof Form>(k: K) => (v: Form[K]) => { setForm((f) => ({ ...f, [k]: v })); setErrors((e) => ({ ...e, [k]: "" })); setMsg(null); };
  const err = (k: string) => errors[k] || undefined;

  const build = (): Record<string, unknown> | null => {
    const price = dollarsToCents(form.price);
    if (price === "invalid") { setErrors({ price: "Enter a price like 45 or 45.50" }); return null; }
    const attrs: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(form.attributes)) {
      if (v === "" || v === undefined || (Array.isArray(v) && !v.length)) continue;
      const def = dynamic.find((d) => d.key === k);
      attrs[k] = def?.input === "number" ? Number(v) : v;
    }
    const num = (s: string) => (s.trim() ? Number(s) : null);
    return {
      ...(id ? {} : { kind: effKind }),
      name: form.name.trim(), category: form.category, subcategory: form.subcategory, description: form.description.trim(),
      priceAmount: price, priceType: form.priceType, durationMinutes: num(form.duration), capacity: Number(form.capacity) || 1,
      locationModes: form.locationModes, country: form.country.trim(), region: form.region.trim(), city: form.city.trim(),
      serviceRadiusKm: num(form.radius), requirements: form.requirements.trim(), preparation: form.preparation.trim(),
      cancellationPolicy: form.cancellationPolicy.trim(), terms: form.terms.trim(), attributes: attrs,
      includes: form.includes, images: form.images.split(/\s+/).filter(Boolean),
    };
  };

  const fail = (e: unknown) => {
    const x = e as ApiError;
    if (x.fields) setErrors(x.fields);
    setFormError(x.isOffline ? "You appear to be offline. Check your connection and try again." : x.fields ? "Fix the highlighted fields." : x.message || "Something went wrong.");
  };

  const persist = (then?: (savedId: string) => void) => {
    if (busy) return;
    setErrors({}); setFormError(null); setMsg(null);
    const body = build();
    if (!body) return;
    save.mutate(body, {
      onSuccess: (saved) => { setId(saved.id); then ? then(saved.id) : setMsg("Draft saved"); },
      onError: fail,
    });
  };

  const publish = () => persist((sid) =>
    act.mutate({ id: sid, action: "publish" }, {
      onSuccess: (r) => navigation.replace("ProviderListings", { kind: effKind }) as unknown as void,
      onError: fail,
    }));

  const pickable = (services.data ?? []).filter((s) => s.status !== "archived");
  const toggleInclude = (sid: string, name: string) =>
    set("includes")(form.includes.some((i) => i.listingId === sid) ? form.includes.filter((i) => i.listingId !== sid) : [...form.includes, { label: name, listingId: sid }]);

  return (
    <Shell title={id ? `Edit ${effKind}` : `New ${effKind}`}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : undefined}>
        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
          {l ? <View style={styles.row}><StatusPill status={l.status} />{l.rejectionNote ? <Text style={styles.rej}>{l.rejectionNote}</Text> : null}</View> : null}
          {locked ? <Text style={styles.warn}>This is live or in review. Unpublish it before editing.</Text> : null}
          <View pointerEvents={locked ? "none" : "auto"} style={locked ? { opacity: 0.55 } : undefined}>
            <TextField label={effKind === "package" ? "Package name" : "Service name"} value={form.name} onChangeText={set("name")} maxLength={140} error={err("name")} />
            <SelectField label="Category" placeholder="Select a category" value={cat?.label ?? null} options={type.categories.map((c) => c.label)}
              onSelect={(lab) => { const c = type.categories.find((x) => x.label === lab)!; setForm((f) => ({ ...f, category: c.code, subcategory: "" })); setErrors((e) => ({ ...e, category: "" })); }} />
            {err("category") ? <Text style={styles.err}>{err("category")}</Text> : null}
            {cat && cat.subcategories.length ? (
              <SelectField label="Subcategory" optional placeholder="Select" value={cat.subcategories.find((s) => s.code === form.subcategory)?.label ?? null} options={cat.subcategories.map((s) => s.label)}
                onSelect={(lab) => set("subcategory")(cat.subcategories.find((s) => s.label === lab)!.code)} />
            ) : null}
            <TextField label="Description" value={form.description} onChangeText={set("description")} multiline maxLength={4000} error={err("description")} />

            {dynamic.length ? <Text style={styles.h}>{type.label} details</Text> : null}
            {dynamic.map((d) => (
              <DynamicField key={d.key} def={d} value={form.attributes[d.key]} error={err(`attributes.${d.key}`)}
                onChange={(v) => { setForm((f) => ({ ...f, attributes: { ...f.attributes, [d.key]: v } })); setErrors((e) => ({ ...e, [`attributes.${d.key}`]: "" })); }} />
            ))}

            {effKind === "package" ? (
              <>
                <Text style={styles.h}>What's included</Text>
                {pickable.length ? pickable.map((s) => (
                  <CheckRow key={s.id} label={s.name} checked={form.includes.some((i) => i.listingId === s.id)} onPress={() => toggleInclude(s.id, s.name)} />
                )) : <Text style={styles.hint}>You have no services yet. Create services first, then combine them here.</Text>}
                <TextField label="Add another inclusion" optional placeholder="e.g. Airport pickup" maxLength={140}
                  onSubmitEditing={(e) => { const t = e.nativeEvent.text.trim(); if (t) set("includes")([...form.includes, { label: t }]); }} />
                {form.includes.filter((i) => !i.listingId).map((i, n) => <Text key={n} style={styles.hint}>• {i.label}</Text>)}
                {err("includes") ? <Text style={styles.err}>{err("includes")}</Text> : null}
              </>
            ) : null}

            <Text style={styles.h}>Pricing and capacity</Text>
            <SelectField label="Price type" value={tax.data!.priceTypes.find((p) => p.value === form.priceType)?.label ?? null} options={tax.data!.priceTypes.map((p) => p.label)}
              onSelect={(lab) => set("priceType")(tax.data!.priceTypes.find((p) => p.label === lab)!.value)} />
            {form.priceType !== "quote" ? <TextField label="Price (USD)" value={form.price} onChangeText={set("price")} keyboardType="decimal-pad" error={err("price") || err("priceAmount")} /> : null}
            <TextField label="Duration (minutes)" optional value={form.duration} onChangeText={(t) => set("duration")(t.replace(/\D/g, ""))} keyboardType="number-pad" maxLength={5} error={err("durationMinutes")} />
            <TextField label="Bookings per time slot" value={form.capacity} onChangeText={(t) => set("capacity")(t.replace(/\D/g, ""))} keyboardType="number-pad" maxLength={3} error={err("capacity")} />

            <Text style={styles.h}>Where it's offered</Text>
            {tax.data!.locationModes.map((m) => (
              <CheckRow key={m.value} label={m.label} checked={form.locationModes.includes(m.value)}
                onPress={() => set("locationModes")(form.locationModes.includes(m.value) ? form.locationModes.filter((x) => x !== m.value) : [...form.locationModes, m.value])} />
            ))}
            {err("locationModes") ? <Text style={styles.err}>{err("locationModes")}</Text> : null}
            <TextField label="Country" optional value={form.country} onChangeText={set("country")} error={err("country")} />
            <TextField label="Region or state" optional value={form.region} onChangeText={set("region")} />
            <TextField label="City" optional value={form.city} onChangeText={set("city")} error={err("city")} />
            <TextField label="Service radius (km)" optional value={form.radius} onChangeText={(t) => set("radius")(t.replace(/\D/g, ""))} keyboardType="number-pad" maxLength={5} error={err("serviceRadiusKm")} />

            <Text style={styles.h}>Requirements and policies</Text>
            <TextField label="What the customer needs" optional value={form.requirements} onChangeText={set("requirements")} multiline />
            <TextField label="Preparation" optional value={form.preparation} onChangeText={set("preparation")} multiline />
            <TextField label="Cancellation policy" optional value={form.cancellationPolicy} onChangeText={set("cancellationPolicy")} multiline />
            <TextField label="Terms and conditions" optional value={form.terms} onChangeText={set("terms")} multiline />
            <TextField label="Image links (https, one per line)" optional value={form.images} onChangeText={set("images")} multiline autoCapitalize="none" error={err("images")} />
          </View>

          {formError ? <Text style={styles.err} accessibilityLiveRegion="polite">{formError}</Text> : null}
          {msg ? <Text style={styles.ok} accessibilityLiveRegion="polite">{msg}</Text> : null}
          {!locked ? (
            <>
              <Button label="Save draft" variant="outlinePill" onPress={() => persist()} loading={save.isPending} disabled={busy} style={{ marginTop: 14 }} />
              <Button label="Publish" variant="pill" onPress={publish} loading={act.isPending} disabled={busy} style={{ marginTop: 10 }} />
            </>
          ) : null}
          {id ? (
            <>
              <Button label="Preview as a member" variant="outlinePill" onPress={() => navigation.navigate("ListingDetail", { listingId: id, preview: true })} style={{ marginTop: 10 }} />
              <Button label="Set availability" variant="outlinePill" onPress={() => navigation.navigate("ListingAvailability", { listingId: id })} style={{ marginTop: 10 }} />
            </>
          ) : null}
        </ScrollView>
      </KeyboardAvoidingView>
    </Shell>
  );
}

function Shell({ children, title = "Listing" }: { children: React.ReactNode; title?: string }) {
  return <ScreenContainer><AppHeader title={title} />{children}</ScreenContainer>;
}

const styles = StyleSheet.create({
  content: { paddingHorizontal: spacing.lg, paddingTop: 8, paddingBottom: 48 },
  row: { flexDirection: "row", alignItems: "center", marginBottom: 10 },
  rej: { flex: 1, fontSize: 12.5, color: colors.error, marginLeft: 10 },
  warn: { backgroundColor: "#FFF1D6", color: "#7A4A00", borderRadius: radii.sm, padding: 12, fontSize: 12.5, marginBottom: 12, overflow: "hidden" },
  h: { fontSize: 15, fontWeight: "700", color: colors.text, marginTop: 18, marginBottom: 10 },
  hint: { fontSize: 12.5, color: colors.secondaryText, marginBottom: 8, lineHeight: 18 },
  err: { fontSize: 12.5, color: colors.error, marginBottom: 8, lineHeight: 18 },
  ok: { fontSize: 13, color: "#1B7A46", marginTop: 6 },
});
