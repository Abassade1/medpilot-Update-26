import { useRef, useState } from "react";
import { ApiError, uploadProviderImage } from "../lib/api";

/** A single-image picker: a provider's logo or cover photo. */
export function ImageSlot({ label, value, onChange, onError }: {
  label: string; value: string | null; onChange: (url: string | null) => void; onError: (msg: string) => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);

  const pick = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = ""; // let the same file be re-picked later
    if (!file || busy) return;
    setBusy(true);
    try {
      onChange(await uploadProviderImage(file));
    } catch (err) {
      onError(err instanceof ApiError ? err.message : "That upload didn't go through. Please try again.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="field">
      <label>{label} <span className="optional">(Optional)</span></label>
      <input ref={inputRef} type="file" accept="image/jpeg,image/png" onChange={pick} style={{ display: "none" }} />
      <button
        type="button"
        onClick={() => inputRef.current?.click()}
        disabled={busy}
        style={{
          width: 220, height: 120, border: "1px dashed var(--border)", borderRadius: "var(--radius-md)",
          background: "var(--surface-alt)", position: "relative", overflow: "hidden",
          display: "flex", alignItems: "center", justifyContent: "center", cursor: busy ? "wait" : "pointer", padding: 0,
        }}
      >
        {value ? <img src={value} alt="" style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover" }} /> : null}
        {busy ? <span style={{ position: "relative", fontSize: 12.5, color: "var(--secondary-text)" }}>Uploading…</span>
          : !value ? <span style={{ fontSize: 12.5, color: "var(--tertiary-text)" }}>Click to upload</span> : null}
      </button>
      {value && !busy ? (
        <button type="button" onClick={() => onChange(null)} style={{ background: "none", border: "none", color: "var(--error)", fontSize: 12.5, fontWeight: 600, padding: "6px 0", cursor: "pointer", textAlign: "left" }}>
          Remove
        </button>
      ) : null}
    </div>
  );
}

/** A gallery of up to `max` images, e.g. a listing's photo set. */
export function ImageGallery({ label, values, onChange, onError, max = 8 }: {
  label: string; values: string[]; onChange: (urls: string[]) => void; onError: (msg: string) => void; max?: number;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);

  const add = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file || busy || values.length >= max) return;
    setBusy(true);
    try {
      onChange([...values, await uploadProviderImage(file)]);
    } catch (err) {
      onError(err instanceof ApiError ? err.message : "That upload didn't go through. Please try again.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="field">
      <label>{label} <span className="optional">(Optional, up to {max})</span></label>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 10 }}>
        {values.map((url) => (
          <div key={url} style={{ position: "relative" }}>
            <img src={url} alt="" style={{ width: 84, height: 84, borderRadius: "var(--radius-sm)", objectFit: "cover", border: "1px solid var(--border)" }} />
            <button
              type="button" onClick={() => onChange(values.filter((v) => v !== url))}
              aria-label="Remove this photo"
              style={{
                position: "absolute", top: -6, right: -6, width: 20, height: 20, borderRadius: "50%", background: "var(--error)",
                color: "#fff", border: "none", cursor: "pointer", fontSize: 12, lineHeight: "20px", padding: 0,
              }}
            >
              ×
            </button>
          </div>
        ))}
        {values.length < max ? (
          <>
            <input ref={inputRef} type="file" accept="image/jpeg,image/png" onChange={add} style={{ display: "none" }} />
            <button
              type="button" onClick={() => inputRef.current?.click()} disabled={busy}
              style={{
                width: 84, height: 84, borderRadius: "var(--radius-sm)", border: "1px dashed var(--border)", background: "var(--surface-alt)",
                display: "flex", alignItems: "center", justifyContent: "center", cursor: busy ? "wait" : "pointer", fontSize: busy ? 11 : 22, color: "var(--primary)",
              }}
            >
              {busy ? "…" : "+"}
            </button>
          </>
        ) : null}
      </div>
    </div>
  );
}
