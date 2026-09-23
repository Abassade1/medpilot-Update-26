import { useEffect, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useAvailability, useListing, usePutAvailability } from "../lib/queries";
import { ApiError } from "../lib/api";

const DAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
interface W { weekday: number; start: string; end: string }

export default function Availability() {
  const { id } = useParams();
  const navigate = useNavigate();
  const q = useAvailability(id!);
  const listing = useListing(id);
  const save = usePutAvailability(id!);
  const [windows, setWindows] = useState<W[]>([]);
  const [blackouts, setBlackouts] = useState<string[]>([]);
  const [newBlackout, setNewBlackout] = useState("");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [msg, setMsg] = useState<string | null>(null);
  const seeded = useRef(false);

  useEffect(() => {
    if (q.data && !seeded.current) { seeded.current = true; setWindows(q.data.windows); setBlackouts(q.data.blackouts); }
  }, [q.data]);

  if (q.isLoading) return <div className="content">Loading availability…</div>;
  if (q.isError) return <div className="content"><div className="banner banner-error">We couldn't load availability.</div></div>;

  const edit = (i: number, patch: Partial<W>) => { setWindows((w) => w.map((x, n) => (n === i ? { ...x, ...patch } : x))); setErrors({}); setMsg(null); };

  const onSave = () => {
    if (save.isPending) return;
    setErrors({}); setMsg(null);
    save.mutate({ windows, blackouts }, {
      onSuccess: (r) => setMsg(r.listingStatus === "unpublished" ? "Saved. With no hours set, this listing was unpublished." : "Availability saved"),
      onError: (e) => { const x = e as ApiError; setErrors(x.fields ?? { form: x.message || "We couldn't save." }); },
    });
  };

  return (
    <>
      <header className="topbar">
        <h1 style={{ fontSize: 20, fontWeight: 700 }}>Availability</h1>
        <button className="btn btn-outline btn-sm" onClick={() => navigate(-1)}>Back</button>
      </header>
      <div className="content" style={{ maxWidth: 680 }}>
        <p style={{ fontWeight: 700, fontSize: 16 }}>{listing.data?.name}</p>
        <p className="field-hint" style={{ marginBottom: 18 }}>
          Members can book slots inside these weekly hours{listing.data?.durationMinutes ? `, every ${listing.data.durationMinutes} minutes` : ""}. Each slot takes up to {listing.data?.capacity ?? 1} booking(s).
        </p>

        <div className="card">
          {DAYS.map((day, d) => {
            const rows = windows.map((w, i) => ({ w, i })).filter((r) => r.w.weekday === d);
            return (
              <div key={day} style={{ padding: "12px 0", borderTop: d > 0 ? "1px solid var(--border)" : "none" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <strong style={{ fontSize: 14 }}>{day}</strong>
                  <button className="btn btn-outline btn-sm" onClick={() => { setWindows((w) => [...w, { weekday: d, start: "09:00", end: "17:00" }]); setMsg(null); }}>+ Add hours</button>
                </div>
                {rows.length === 0 ? <p className="field-hint" style={{ marginTop: 4 }}>Closed</p> : null}
                {rows.map(({ w, i }) => {
                  const bad = errors[`windows.${i}.end`] || errors[`windows.${i}.start`];
                  return (
                    <div key={i} style={{ marginTop: 8 }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                        <input type="time" value={w.start} onChange={(e) => edit(i, { start: e.target.value })} />
                        <span>to</span>
                        <input type="time" value={w.end} onChange={(e) => edit(i, { end: e.target.value })} />
                        <button className="btn btn-danger btn-sm" onClick={() => { setWindows((x) => x.filter((_, n) => n !== i)); setMsg(null); }}>Remove</button>
                      </div>
                      {bad ? <p className="field-error">{bad}</p> : null}
                    </div>
                  );
                })}
              </div>
            );
          })}
        </div>

        <div className="card" style={{ marginTop: 18 }}>
          <h3 style={{ fontSize: 15, marginBottom: 4 }}>Blackout dates</h3>
          <p className="field-hint" style={{ marginBottom: 12 }}>Days you are unavailable, such as holidays.</p>
          {blackouts.map((b) => (
            <div key={b} style={{ display: "flex", justifyContent: "space-between", padding: "6px 0" }}>
              <span style={{ fontSize: 13.5 }}>{b}</span>
              <button className="btn btn-danger btn-sm" onClick={() => setBlackouts((x) => x.filter((y) => y !== b))}>Remove</button>
            </div>
          ))}
          <div style={{ display: "flex", gap: 8, marginTop: 10 }}>
            <input type="date" value={newBlackout} onChange={(e) => setNewBlackout(e.target.value)} />
            <button className="btn btn-outline btn-sm" onClick={() => { if (newBlackout && !blackouts.includes(newBlackout)) setBlackouts((x) => [...x, newBlackout].sort()); setNewBlackout(""); setMsg(null); }}>Add date</button>
          </div>
          {errors.blackouts || errors.form ? <p className="field-error" style={{ marginTop: 8 }}>{errors.blackouts || errors.form}</p> : null}
        </div>

        {msg ? <p style={{ color: "#1B7A46", fontSize: 13, marginTop: 14 }}>{msg}</p> : null}
        <button className="btn btn-primary" style={{ marginTop: 16 }} onClick={onSave} disabled={save.isPending}>Save availability</button>
      </div>
    </>
  );
}
