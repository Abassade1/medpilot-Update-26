import { useState } from "react";
import StatusPill from "../components/StatusPill";
import { TextField } from "../components/Field";
import { ApiError } from "../lib/api";
import { useStaffBookingAction, useStaffBookings } from "../lib/queries";
import type { StaffBookingDto } from "../lib/types";

type Action = "confirm" | "cancel" | "complete";
const TABS = [{ value: "pending", label: "Waiting for a decision" }, { value: "confirmed", label: "Confirmed" }] as const;

const fmtDate = (iso: string | null) =>
  iso ? new Date(`${iso}T00:00:00Z`).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" }) : "Flexible";
function timeAgo(iso: string) {
  const mins = Math.round((Date.now() - new Date(iso).getTime()) / 60_000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  if (mins < 1440) return `${Math.round(mins / 60)}h ago`;
  return `${Math.round(mins / 1440)}d ago`;
}

/**
 * Where MedPilot operations staff confirm, decline and complete member bookings for hospitals,
 * transport, pet clinics and independent specialists. The backend's role guard is the real
 * boundary; this page is only reachable from the staff section of the navigation.
 */
export default function StaffOps() {
  const [tab, setTab] = useState<(typeof TABS)[number]["value"]>("pending");
  const q = useStaffBookings(tab);
  const act = useStaffBookingAction();
  const [open, setOpen] = useState<{ booking: StaffBookingDto; action: Action } | null>(null);
  const [form, setForm] = useState({ scheduledAt: "", staffName: "", staffRole: "", flightNumber: "", reason: "" });
  const [error, setError] = useState<string | null>(null);

  const start = (booking: StaffBookingDto, action: Action) => {
    setForm({ scheduledAt: "", staffName: "", staffRole: "", flightNumber: "", reason: "" });
    setError(null);
    setOpen({ booking, action });
  };
  const set = (k: keyof typeof form) => (v: string) => setForm((f) => ({ ...f, [k]: v }));

  const submit = () => {
    if (!open || act.isPending) return;
    const { booking, action } = open;
    const body: Record<string, string> = {};
    if (action === "confirm") {
      if (form.scheduledAt) body.scheduledAt = new Date(form.scheduledAt).toISOString();
      if (booking.kind === "appointment" && form.staffName.trim()) body.staffName = form.staffName.trim();
      if (booking.kind === "appointment" && form.staffRole.trim()) body.staffRole = form.staffRole.trim();
      if (booking.kind === "transport" && form.flightNumber.trim()) body.flightNumber = form.flightNumber.trim();
    }
    if (action === "cancel" && form.reason.trim()) body.reason = form.reason.trim();
    setError(null);
    act.mutate({ kind: booking.kind, id: booking.id, decision: action, body }, {
      onSuccess: () => setOpen(null),
      onError: (e) => setError(e instanceof ApiError ? e.message : "That didn't work."),
    });
  };

  const items = q.data?.items ?? [];
  const today = new Date().toISOString().slice(0, 10); // bookings are dated in UTC
  const title = open
    ? { confirm: "Confirm", cancel: "Decline", complete: "Mark completed" }[open.action] + ` ${open.booking.reference}?`
    : "";

  return (
    <>
      <header className="topbar"><h1 style={{ fontSize: 20, fontWeight: 700 }}>Operations</h1></header>
      <div className="content">
        <div className="chips">
          {TABS.map((t) => (
            <button key={t.value} className={`chip${tab === t.value ? " active" : ""}`} onClick={() => setTab(t.value)}>{t.label}</button>
          ))}
        </div>

        {q.isLoading ? <p>Loading…</p> : q.isError ? (
          <div className="banner banner-error">We couldn't load the bookings.</div>
        ) : items.length === 0 ? (
          <div className="card" style={{ textAlign: "center", padding: 28 }}>
            {tab === "pending" ? "Nothing is waiting for a decision." : "No confirmed bookings."}
          </div>
        ) : (
          <div className="card" style={{ padding: 0, overflowX: "auto" }}>
            <table className="table">
              <thead><tr><th>Reference</th><th>Type</th><th>With</th><th>Member</th><th>Date</th><th>{tab === "pending" ? "Requested" : "Status"}</th><th>Actions</th></tr></thead>
              <tbody>
                {items.map((b) => (
                  <tr key={`${b.kind}-${b.id}`}>
                    <td style={{ fontWeight: 600, whiteSpace: "nowrap" }}>{b.reference}</td>
                    <td>{b.kindLabel}</td>
                    <td>{b.target}</td>
                    <td>{b.member}</td>
                    <td style={{ whiteSpace: "nowrap" }}>
                      {fmtDate(b.date)}{b.time ? ` at ${b.time}` : ""}
                      {b.canDecide && b.date && b.date < today ? <div className="field-error">Date has passed</div> : null}
                    </td>
                    <td>{tab === "pending" ? timeAgo(b.createdAt) : <StatusPill status={b.status === "in_transit" ? "confirmed" : b.status} />}</td>
                    <td>
                      <div style={{ display: "flex", gap: 8 }}>
                        {b.canDecide ? (
                          <>
                            <button className="btn btn-primary btn-sm" onClick={() => start(b, "confirm")}>Confirm</button>
                            <button className="btn btn-danger btn-sm" onClick={() => start(b, "cancel")}>Decline</button>
                          </>
                        ) : b.canComplete ? (
                          <button className="btn btn-primary btn-sm" onClick={() => start(b, "complete")}>Mark completed</button>
                        ) : (
                          <span className="field-hint">Completable from {fmtDate(b.date)}</span>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {open ? (
        <div role="dialog" aria-modal="true" aria-labelledby="staff-ops-title" style={{ position: "fixed", inset: 0, background: "rgba(23,25,28,0.45)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 100 }} onClick={() => setOpen(null)}>
          <div className="card" style={{ width: "100%", maxWidth: 440, margin: 16 }} onClick={(e) => e.stopPropagation()}>
            <h2 id="staff-ops-title" style={{ fontSize: 16, fontWeight: 700, marginBottom: 6 }}>{title}</h2>
            <p style={{ fontSize: 13.5, color: "var(--secondary-text)", lineHeight: 1.5, marginBottom: 16 }}>
              {open.booking.kindLabel} with {open.booking.target} for {open.booking.member}, {fmtDate(open.booking.date)}.
              {open.action === "complete" ? " The member will be asked to rate the visit." : " The member will be notified."}
            </p>

            {open.action === "confirm" && open.booking.kind !== "service_request" ? (
              <div className="field">
                <label>{open.booking.kind === "transport" ? "Departure time" : "Confirmed time"} <span className="optional">(Optional)</span></label>
                <input type="datetime-local" value={form.scheduledAt} onChange={(e) => set("scheduledAt")(e.target.value)} />
              </div>
            ) : null}
            {open.action === "confirm" && open.booking.kind === "appointment" ? (
              <div className="form-grid">
                <TextField label="Contact person" value={form.staffName} onChange={set("staffName")} optional />
                <TextField label="Their role" value={form.staffRole} onChange={set("staffRole")} optional />
              </div>
            ) : null}
            {open.action === "confirm" && open.booking.kind === "transport" ? (
              <TextField label="Flight number" value={form.flightNumber} onChange={set("flightNumber")} optional />
            ) : null}
            {open.action === "cancel" ? (
              <TextField label="Reason" value={form.reason} onChange={set("reason")} textarea optional placeholder="Shown to the member with the cancelled booking" />
            ) : null}

            {error ? <p className="field-error" style={{ marginBottom: 12 }}>{error}</p> : null}
            <div style={{ display: "flex", gap: 10, justifyContent: "flex-end" }}>
              <button className="btn btn-outline" onClick={() => setOpen(null)} disabled={act.isPending}>Back</button>
              <button className={open.action === "cancel" ? "btn btn-danger" : "btn btn-primary"} onClick={submit} disabled={act.isPending}>
                {act.isPending ? "Working…" : { confirm: "Confirm booking", cancel: "Decline booking", complete: "Mark completed" }[open.action]}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
