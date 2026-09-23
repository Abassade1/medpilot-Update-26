import React, { useEffect, useRef, useState } from "react";
import { TextField, SelectField } from "../components/Field";
import { ImageSlot } from "../components/ImageField";
import StatusPill from "../components/StatusPill";
import { useMyProvider, useSaveProvider, useSubmitVerification, useTaxonomy } from "../lib/queries";
import { ApiError } from "../lib/api";

const KEYS = ["name", "description", "phone", "email", "website", "address", "country", "region", "city", "serviceAreas", "operatingHours", "languages", "certifications", "logoUrl", "coverUrl"] as const;
type Form = Record<(typeof KEYS)[number], string> & { type: string };
const blank = (): Form => ({ ...(Object.fromEntries(KEYS.map((k) => [k, ""])) as Form), type: "" });

export default function Profile() {
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
        for (const k of KEYS) f[k] = (provider[k as keyof typeof provider] as string | null) ?? "";
        setForm(f);
        setLicence(provider.verificationInfo ?? "");
      }
    }
  }, [me.isSuccess, provider]);

  if (me.isLoading || tax.isLoading) return <div className="content">Loading…</div>;
  if (me.isError || tax.isError) return <div className="content"><div className="banner banner-error">We couldn't load this page.</div></div>;

  const types = tax.data!.providerTypes;
  const isNew = !provider;
  const set = (k: keyof Form) => (v: string) => { setForm((f) => ({ ...f, [k]: v })); setErrors((e) => ({ ...e, [k]: "" })); setMsg(null); };

  const onSave = (e: React.FormEvent) => {
    e.preventDefault();
    if (save.isPending) return;
    setErrors({}); setFormError(null); setMsg(null);
    const body: Record<string, unknown> = {};
    for (const k of KEYS) {
      const v = form[k].trim();
      if (v || !isNew) body[k] = v === "" && ["phone", "email", "website", "address", "country", "region", "city", "logoUrl", "coverUrl"].includes(k) ? null : v;
    }
    if (isNew) body.type = form.type;
    save.mutate({ create: isNew, body }, {
      onSuccess: () => setMsg("Profile saved"),
      onError: (err) => {
        const e2 = err as ApiError;
        if (e2.fields) setErrors(e2.fields);
        setFormError(e2.isOffline ? "You appear to be offline." : e2.fields ? "Check the highlighted fields." : e2.message || "We couldn't save your profile.");
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

  return (
    <>
      <header className="topbar">
        <h1 style={{ fontSize: 20, fontWeight: 700 }}>Organization profile</h1>
        {provider ? <StatusPill status={provider.verificationStatus} /> : null}
      </header>
      <div className="content">
        <form className="card" style={{ maxWidth: 760 }} onSubmit={onSave}>
          {isNew ? (
            <SelectField label="Provider type" value={form.type} onChange={set("type")} options={types.map((t) => ({ value: t.code, label: t.label }))} error={errors.type} />
          ) : (
            <p style={{ fontSize: 14, fontWeight: 600, color: "var(--primary)", marginBottom: 14 }}>{provider!.typeLabel}</p>
          )}
          <TextField label="Organization name" value={form.name} onChange={set("name")} error={errors.name} />
          <TextField label="About" value={form.description} onChange={set("description")} textarea optional error={errors.description} />
          <div className="form-grid">
            <TextField label="Phone" value={form.phone} onChange={set("phone")} optional error={errors.phone} />
            <TextField label="Public email" value={form.email} onChange={set("email")} optional error={errors.email} />
            <TextField label="Website" value={form.website} onChange={set("website")} optional error={errors.website} />
            <TextField label="Address" value={form.address} onChange={set("address")} optional error={errors.address} />
            <TextField label="Country" value={form.country} onChange={set("country")} optional error={errors.country} />
            <TextField label="Region or state" value={form.region} onChange={set("region")} optional />
            <TextField label="City" value={form.city} onChange={set("city")} optional error={errors.city} />
            <TextField label="Operating hours" value={form.operatingHours} onChange={set("operatingHours")} optional />
            <TextField label="Languages (comma separated)" value={form.languages} onChange={set("languages")} optional />
            <ImageSlot label="Logo" value={form.logoUrl || null} onChange={(url) => set("logoUrl")(url ?? "")} onError={setFormError} />
            <ImageSlot label="Cover photo" value={form.coverUrl || null} onChange={(url) => set("coverUrl")(url ?? "")} onError={setFormError} />
          </div>
          <TextField label="Service areas" value={form.serviceAreas} onChange={set("serviceAreas")} textarea optional />
          <TextField label="Certifications" value={form.certifications} onChange={set("certifications")} textarea optional />
          {formError ? <p className="field-error" style={{ marginBottom: 10 }}>{formError}</p> : null}
          {msg ? <p style={{ color: "#1B7A46", fontSize: 13, marginBottom: 10 }}>{msg}</p> : null}
          <button className="btn btn-primary" type="submit" disabled={save.isPending || (isNew && !form.type)}>
            {isNew ? "Create organization profile" : "Save profile"}
          </button>
        </form>

        {provider && provider.verificationStatus !== "verified" ? (
          <div className="card" style={{ maxWidth: 760, marginTop: 18 }}>
            <h3 style={{ fontSize: 15, marginBottom: 6 }}>Verification</h3>
            <p className="field-hint" style={{ marginBottom: 14 }}>
              Give your licence, registration or accreditation details. Our team reviews them before your services go live.
            </p>
            <TextField label="Licence or registration details" value={licence} onChange={setLicence} textarea error={errors.licenseInfo} />
            <button className="btn btn-outline" onClick={onVerify} disabled={verify.isPending || !licence.trim()}>
              {provider.verificationStatus === "pending" ? "Update submission" : "Submit for verification"}
            </button>
          </div>
        ) : null}
      </div>
    </>
  );
}
