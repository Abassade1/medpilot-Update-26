import { useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import StatusPill from "../components/StatusPill";
import { useBookings } from "../lib/queries";

const TABS = [["", "All"], ["pending", "Pending"], ["confirmed", "Confirmed"], ["completed", "Completed"], ["cancelled", "Cancelled"]] as const;

export default function Bookings() {
  const [params] = useSearchParams();
  const [status, setStatus] = useState(params.get("status") ?? "");
  const q = useBookings(status || undefined);

  return (
    <>
      <header className="topbar"><h1 style={{ fontSize: 20, fontWeight: 700 }}>Bookings</h1></header>
      <div className="content">
        <div className="chips">
          {TABS.map(([v, label]) => <button key={v} className={`chip${status === v ? " active" : ""}`} onClick={() => setStatus(v)}>{label}</button>)}
        </div>
        {q.isLoading ? <p>Loading…</p> : q.isError ? (
          <div className="banner banner-error">We couldn't load bookings.</div>
        ) : q.data && q.data.length ? (
          <div className="card" style={{ padding: 0, overflowX: "auto" }}>
            <table className="table">
              <thead><tr><th>Reference</th><th>Service</th><th>Customer</th><th>Date</th><th>Price</th><th>Status</th></tr></thead>
              <tbody>
                {q.data.map((b) => (
                  <tr key={b.id}>
                    <td><Link to={`/bookings/${b.id}`}>{b.reference}</Link></td>
                    <td>{b.listing?.name ?? "—"}</td>
                    <td>{b.customer.name}</td>
                    <td>{b.date ?? "—"}{b.time ? ` at ${b.time}` : ""}</td>
                    <td>{b.priceLabel ?? "—"}</td>
                    <td><StatusPill status={b.status} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="card" style={{ textAlign: "center", padding: 40 }}>No bookings here. When members book your services, they appear here.</div>
        )}
      </div>
    </>
  );
}
