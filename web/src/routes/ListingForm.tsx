import { useEffect, useRef, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { TextField, SelectField, CheckField } from "../components/Field";
import DynamicField from "../components/DynamicField";
import StatusPill from "../components/StatusPill";
import { useListingAction, useListings, useMyProvider, useSaveListing, useTaxonomy } from "../lib/queries";
import { useListing } from "../lib/queries";
import { ApiError } from "../lib/api";
import { centsToDollars, dollarsToCents } from "../lib/money";

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

export default function ListingForm({ kind }: { kind: "service" | "package" }) {
  const { id } = useParams();
  const navigate = useNavigate();
  const me = useMyProvider();
  const tax = useTaxonomy();
  const existing = useListing(id);
  const services = useListings("service");
  const [savedId, setSavedId] = useState<string | undefined>(id);
  const save = useSaveListing(savedId);
  const act = useListingAction();
  const [form, setForm] = useState<Form>(empty);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [newInclude, setNewInclude] = useState("");
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

  const loading = me.isLoading || tax.isLoading || (!!id && existing.isLoading);
  if (loading) return <div className="content">Loading…</div>;
  if (me.isError || tax.isError) return <div className="content"><div className="banner banner-error">We couldn't load this form.</div></div>;

  const provider = me.data?.provider;
  if (!provider) {
    return (
      <div className="content">
        <div className="banner banner-warn" style={{ maxWidth: 480 }}>
          Set up your organization profile first. <Link to="/profile">Set up profile</Link>
        </div>
      </div>
    );
  }

  const type = tax.data!.providerTypes.find((t) => t.code === provider.type)!;
  const cat = type.categories.find((c) => c.code === form.category);
  const dynamic = effKind === "package" ? type.packageFields : type.serviceFields;
  const locked = l?.status === "published" || l?.status === "review";
  const set = <K extends keyof Form>(k: K) => (v: Form[K]) => { setForm((f) => ({ ...f, [k]: v })); setErrors((e) => ({ ...e, [k]: "" })); setMsg(null); };
  const err = (k: string) => errors[k] || undefined;
  const backTo = `/${kind === "service" ? "services" : "packages"}`;

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
      ...(savedId ? {} : { kind: effKind }),
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
    setFormError(x.isOffline ? "You appear to be offline." : x.fields ? "Fix the highlighted fields." : x.message || "Something went wrong.");
  };

  const persist = (then?: (id: string) => void) => {
    if (busy) return;
    setErrors({}); setFormError(null); setMsg(null);
    const body = build();
    if (!body) return;
    save.mutate(body, {
      onSuccess: (saved) => { setSavedId(saved.id); then ? then(saved.id) : setMsg("Draft saved"); },
      onError: fail,
    });
  };

  const publish = () => persist((sid) => act.mutate({ id: sid, action: "publish" }, { onSuccess: () => navigate(backTo), onError: fail }));

  const pickable = (services.data ?? []).filter((s) => s.status !== "archived");
  const toggleInclude = (sid: string, name: string) =>
    set("includes")(form.includes.some((i) => i.listingId === sid) ? form.includes.filter((i) => i.listingId !== sid) : [...form.includes, { label: name, listingId: sid }]);

  return (
    <>
      <header className="topbar">
        <h1 style={{ fontSize: 20, fontWeight: 700 }}>{savedId ? `Edit ${effKind}` : `New ${effKind}`}</h1>
        {l ? <StatusPill status={l.status} /> : null}
      </header>
      <div className="content" style={{ maxWidth: 760 }}>
        {locked ? <div className="banner banner-warn" style={{ marginBottom: 16 }}>This is live or in review. Unpublish it before editing.</div> : null}
        <fieldset disabled={locked} style={{ border: "none", padding: 0, margin: 0 }}>
          <div className="card">
            <TextField label={effKind === "package" ? "Package name" : "Service name"} value={form.name} onChange={set("name")} error={err("name")} />
            <div className="form-grid">
              <SelectField label="Category" value={form.category} onChange={(v) => setForm((f) => ({ ...f, category: v, subcategory: "" }))}
                options={type.categories.map((c) => ({ value: c.code, label: c.label }))} error={err("category")} />
              {cat && cat.subcategories.length ? (
                <SelectField label="Subcategory" optional value={form.subcategory} onChange={set("subcategory")}
                  options={cat.subcategories.map((s) => ({ value: s.code, label: s.label }))} />
              ) : null}
            </div>
            <TextField label="Description" value={form.description} onChange={set("description")} textarea error={err("description")} />

            {dynamic.length ? (
              <>
                <h3 style={{ fontSize: 15, margin: "18px 0 10px" }}>{type.label} details</h3>
                <div className="form-grid">
                  {dynamic.map((d) => (
                    <DynamicField key={d.key} def={d} value={form.attributes[d.key]} error={err(`attributes.${d.key}`)}
                      onChange={(v) => { setForm((f) => ({ ...f, attributes: { ...f.attributes, [d.key]: v } })); setErrors((e) => ({ ...e, [`attributes.${d.key}`]: "" })); }} />
                  ))}
                </div>
              </>
            ) : null}

            {effKind === "package" ? (
              <>
                <h3 style={{ fontSize: 15, margin: "18px 0 10px" }}>What's included</h3>
                {pickable.length ? pickable.map((s) => (
                  <CheckField key={s.id} label={s.name} checked={form.includes.some((i) => i.listingId === s.id)} onChange={() => toggleInclude(s.id, s.name)} />
                )) : <p className="field-hint">You have no services yet. Create services first, then combine them here.</p>}
                <div style={{ display: "flex", gap: 8, marginTop: 10, marginBottom: 8 }}>
                  <input placeholder="Add another inclusion, e.g. Airport pickup" value={newInclude} onChange={(e) => setNewInclude(e.target.value)} style={{ flex: 1 }} />
                  <button type="button" className="btn btn-outline btn-sm" onClick={() => { if (newInclude.trim()) { set("includes")([...form.includes, { label: newInclude.trim() }]); setNewInclude(""); } }}>Add</button>
                </div>
                {form.includes.filter((i) => !i.listingId).map((i, n) => <p key={n} className="field-hint">• {i.label}</p>)}
                {err("includes") ? <p className="field-error">{err("includes")}</p> : null}
              </>
            ) : null}

            <h3 style={{ fontSize: 15, margin: "18px 0 10px" }}>Pricing and capacity</h3>
            <div className="form-grid">
              <SelectField label="Price type" value={form.priceType} onChange={set("priceType")} options={tax.data!.priceTypes} />
              {form.priceType !== "quote" ? <TextField label="Price (USD)" value={form.price} onChange={set("price")} error={err("price") || err("priceAmount")} /> : null}
              <TextField label="Duration (minutes)" optional value={form.duration} onChange={(v) => set("duration")(v.replace(/\D/g, ""))} error={err("durationMinutes")} />
              <TextField label="Bookings per time slot" value={form.capacity} onChange={(v) => set("capacity")(v.replace(/\D/g, ""))} error={err("capacity")} />
            </div>

            <h3 style={{ fontSize: 15, margin: "18px 0 10px" }}>Where it's offered</h3>
            {tax.data!.locationModes.map((m) => (
              <CheckField key={m.value} label={m.label} checked={form.locationModes.includes(m.value)}
                onChange={(v) => set("locationModes")(v ? [...form.locationModes, m.value] : form.locationModes.filter((x) => x !== m.value))} />
            ))}
            {err("locationModes") ? <p className="field-error">{err("locationModes")}</p> : null}
            <div className="form-grid" style={{ marginTop: 10 }}>
              <TextField label="Country" optional value={form.country} onChange={set("country")} error={err("country")} />
              <TextField label="Region or state" optional value={form.region} onChange={set("region")} />
              <TextField label="City" optional value={form.city} onChange={set("city")} error={err("city")} />
              <TextField label="Service radius (km)" optional value={form.radius} onChange={(v) => set("radius")(v.replace(/\D/g, ""))} error={err("serviceRadiusKm")} />
            </div>

            <h3 style={{ fontSize: 15, margin: "18px 0 10px" }}>Requirements and policies</h3>
            <TextField label="What the customer needs" optional value={form.requirements} onChange={set("requirements")} textarea />
            <TextField label="Preparation" optional value={form.preparation} onChange={set("preparation")} textarea />
            <TextField label="Cancellation policy" optional value={form.cancellationPolicy} onChange={set("cancellationPolicy")} textarea />
            <TextField label="Terms and conditions" optional value={form.terms} onChange={set("terms")} textarea />
            <TextField label="Image links (https, one per line)" optional value={form.images} onChange={set("images")} textarea error={err("images")} />
          </div>
        </fieldset>

        {formError ? <p className="field-error" style={{ marginTop: 14 }}>{formError}</p> : null}
        {msg ? <p style={{ color: "#1B7A46", fontSize: 13, marginTop: 14 }}>{msg}</p> : null}
        <div style={{ display: "flex", gap: 10, marginTop: 16, flexWrap: "wrap" }}>
          {!locked ? (
            <>
              <button className="btn btn-outline" onClick={() => persist()} disabled={busy}>Save draft</button>
              <button className="btn btn-primary" onClick={publish} disabled={busy}>Publish</button>
            </>
          ) : null}
          {savedId ? (
            <>
              <Link className="btn btn-outline" to={`/listing/${savedId}/preview`}>Preview</Link>
              <Link className="btn btn-outline" to={`/listing/${savedId}/availability`}>Set availability</Link>
            </>
          ) : null}
          <Link className="btn btn-outline" to={backTo}>Back to list</Link>
        </div>
      </div>
    </>
  );
}
