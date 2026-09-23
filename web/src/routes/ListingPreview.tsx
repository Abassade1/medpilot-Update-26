import { useNavigate, useParams } from "react-router-dom";
import { useListingPreview } from "../lib/queries";
import StatusPill from "../components/StatusPill";

const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

export default function ListingPreview() {
  const { id } = useParams();
  const navigate = useNavigate();
  const q = useListingPreview(id!);
  if (q.isLoading) return <div className="content">Loading…</div>;
  if (q.isError || !q.data) return <div className="content"><div className="banner banner-error">We couldn't load this listing.</div></div>;
  const l = q.data;

  return (
    <>
      <header className="topbar">
        <h1 style={{ fontSize: 20, fontWeight: 700 }}>{l.name}</h1>
        <StatusPill status={l.status} />
      </header>
      <div className="content" style={{ maxWidth: 720 }}>
        <div className="banner banner-warn" style={{ marginBottom: 18 }}>This is a preview of how members will see this listing.</div>
        {l.images[0] ? <img src={l.images[0]} alt="" style={{ width: "100%", maxHeight: 260, objectFit: "cover", borderRadius: 12, marginBottom: 16 }} /> : null}
        <p style={{ fontSize: 12, fontWeight: 700, color: "var(--primary)" }}>{l.category.label}{l.subcategory.label ? ` · ${l.subcategory.label}` : ""}</p>
        <p style={{ fontSize: 18, fontWeight: 600, marginTop: 6 }}>{l.priceLabel}{l.durationMinutes ? ` · ${l.durationMinutes} min` : ""}</p>
        <p style={{ fontSize: 13.5, color: "var(--secondary-text)", marginTop: 8, lineHeight: 1.6 }}>{l.description}</p>

        {l.details.length ? (
          <div className="card" style={{ marginTop: 18 }}>
            <h3 style={{ fontSize: 14, marginBottom: 10 }}>Details</h3>
            {l.details.map((d) => <div key={d.label} style={{ display: "flex", padding: "4px 0", fontSize: 13.5 }}><span style={{ width: 160, color: "var(--secondary-text)" }}>{d.label}</span><span>{d.value}</span></div>)}
          </div>
        ) : null}
        {l.includes.length ? (
          <div className="card" style={{ marginTop: 18 }}>
            <h3 style={{ fontSize: 14, marginBottom: 10 }}>What's included</h3>
            {l.includes.map((i, n) => <p key={n} style={{ fontSize: 13.5, margin: "4px 0" }}>• {i.label}</p>)}
          </div>
        ) : null}
        <div className="card" style={{ marginTop: 18 }}>
          <h3 style={{ fontSize: 14, marginBottom: 10 }}>Availability</h3>
          {l.availability.length ? l.availability.map((w, n) => <p key={n} style={{ fontSize: 13.5, margin: "4px 0" }}>{DAYS[w.weekday]}  {w.start}–{w.end}</p>) : (
            <p className="field-hint">No availability set yet, so this can't be booked online.</p>
          )}
        </div>
        <button className="btn btn-outline" style={{ marginTop: 18 }} onClick={() => navigate(-1)}>Back</button>
      </div>
    </>
  );
}
