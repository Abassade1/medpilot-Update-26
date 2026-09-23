import { useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import StatusPill from "../components/StatusPill";
import { useBooking, useBookingAction } from "../lib/queries";
import { ApiError } from "../lib/api";

export default function BookingDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const q = useBooking(id!);
  const act = useBookingAction(id!);
  const [reason, setReason] = useState("");
  const [asking, setAsking] = useState<"decline" | "cancel" | null>(null);
  const [error, setError] = useState<string | null>(null);
  const b = q.data;

  if (q.isLoading) return <div className="content">Loading…</div>;
  if (q.isError || !b) return <div className="content"><div className="banner banner-error">We couldn't load this booking.</div></div>;

  const run = (action: "confirm" | "decline" | "complete" | "cancel", why?: string) => {
    if (act.isPending) return;
    setError(null);
    act.mutate({ action, reason: why }, {
      onSuccess: () => { setAsking(null); setReason(""); },
      onError: (e) => { const x = e as ApiError; setError(x.isOffline ? "You appear to be offline." : x.message || "That didn't work."); },
    });
  };

  const Row = ({ label, value }: { label: string; value: string }) => (
    <div style={{ display: "flex", padding: "10px 0", borderBottom: "1px solid var(--border)", fontSize: 14 }}>
      <span style={{ width: 140, color: "var(--secondary-text)", fontSize: 13 }}>{label}</span><span>{value}</span>
    </div>
  );

  return (
    <>
      <header className="topbar">
        <h1 style={{ fontSize: 20, fontWeight: 700 }}>{b.reference}</h1>
        <button className="btn btn-outline btn-sm" onClick={() => navigate(-1)}>Back</button>
      </header>
      <div className="content" style={{ maxWidth: 560 }}>
        <div className="card">
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
            <strong>{b.listing?.name ?? "Booking"}</strong>
            <StatusPill status={b.status} />
          </div>
          <Row label="Date" value={b.date ? `${b.date}${b.time ? ` at ${b.time}` : ""}` : "—"} />
          <Row label="Price" value={b.priceLabel ?? "—"} />
          <Row label="Customer" value={b.customer.name} />
          <Row label="Phone" value={b.customer.phone ?? "Not provided"} />
          {b.notes ? <Row label="Notes" value={b.notes} /> : null}
          {b.cancelledReason ? <Row label="Reason" value={b.cancelledReason} /> : null}
        </div>

        {error ? <div className="banner banner-error" style={{ marginTop: 14 }}>{error}</div> : null}

        {asking ? (
          <div className="card" style={{ marginTop: 16 }}>
            <div className="field">
              <label>Reason for {asking === "decline" ? "declining" : "cancelling"} <span className="optional">(Optional)</span></label>
              <textarea value={reason} onChange={(e) => setReason(e.target.value)} />
            </div>
            <div style={{ display: "flex", gap: 10 }}>
              <button className="btn btn-danger" disabled={act.isPending} onClick={() => run(asking, reason.trim() || undefined)}>
                {asking === "decline" ? "Decline booking" : "Cancel booking"}
              </button>
              <button className="btn btn-outline" onClick={() => setAsking(null)}>Back</button>
            </div>
          </div>
        ) : (
          <div style={{ display: "flex", gap: 10, marginTop: 18, flexWrap: "wrap" }}>
            {b.canConfirm ? <button className="btn btn-primary" disabled={act.isPending} onClick={() => run("confirm")}>Accept booking</button> : null}
            {b.canComplete ? <button className="btn btn-primary" disabled={act.isPending} onClick={() => run("complete")}>Mark as completed</button> : null}
            {b.canDecline ? <button className="btn btn-danger" onClick={() => setAsking("decline")}>Decline</button> : null}
            {b.canCancel ? <button className="btn btn-danger" onClick={() => setAsking("cancel")}>Cancel booking</button> : null}
          </div>
        )}
        <p className="field-hint" style={{ marginTop: 18 }}>Rescheduling isn't supported yet. Decline or cancel, and the member can book a new time.</p>
      </div>
    </>
  );
}
