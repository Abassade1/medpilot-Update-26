import { useState } from "react";
import { useDecideListing, useDecideProvider, useStaffQueue } from "../lib/queries";
import { ApiError } from "../lib/api";

function timeAgo(iso: string) {
  const mins = Math.round((Date.now() - new Date(iso).getTime()) / 60_000);
  if (mins < 60) return `${mins}m ago`;
  if (mins < 1440) return `${Math.round(mins / 60)}h ago`;
  return `${Math.round(mins / 1440)}d ago`;
}

/**
 * Internal review queue for staff/admin accounts: verify providers and approve/reject listings
 * submitted for review. Every action here is re-checked by the backend's own @Roles guard — this
 * page hiding itself for non-staff accounts is a convenience, not the security boundary.
 */
export default function StaffReview() {
  const q = useStaffQueue();
  const decideProvider = useDecideProvider();
  const decideListing = useDecideListing();
  const [rejecting, setRejecting] = useState<{ kind: "provider" | "listing"; id: string; label: string } | null>(null);
  const [reason, setReason] = useState("");
  const [error, setError] = useState<string | null>(null);
  const busy = decideProvider.isPending || decideListing.isPending;

  const fail = (e: unknown) => setError(e instanceof ApiError ? e.message : "That didn't work.");

  const verifyProvider = (id: string) => {
    setError(null);
    decideProvider.mutate({ id, decision: "verify" }, { onError: fail });
  };
  const approveListing = (id: string) => {
    setError(null);
    decideListing.mutate({ id, decision: "approve" }, { onError: fail });
  };
  const submitReject = () => {
    if (!rejecting) return;
    setError(null);
    const opts = { onSuccess: () => { setRejecting(null); setReason(""); }, onError: fail };
    if (rejecting.kind === "provider") decideProvider.mutate({ id: rejecting.id, decision: "reject", reason: reason.trim() || undefined }, opts);
    else decideListing.mutate({ id: rejecting.id, decision: "reject", reason: reason.trim() || undefined }, opts);
  };

  return (
    <>
      <header className="topbar"><h1 style={{ fontSize: 20, fontWeight: 700 }}>Staff review</h1></header>
      <div className="content">
        {error ? <div className="banner banner-error" style={{ marginBottom: 16 }}>{error}</div> : null}

        {q.isLoading ? <p>Loading…</p> : q.isError ? (
          <div className="banner banner-error">We couldn't load the review queue.</div>
        ) : (
          <>
            <h2 style={{ fontSize: 15, fontWeight: 700, marginBottom: 10 }}>Providers awaiting verification ({q.data?.providers.length ?? 0})</h2>
            {q.data && q.data.providers.length ? (
              <div className="card" style={{ padding: 0, overflowX: "auto", marginBottom: 28 }}>
                <table className="table">
                  <thead><tr><th>Provider</th><th>Type</th><th>Licence / registration info</th><th>Submitted</th><th>Decision</th></tr></thead>
                  <tbody>
                    {q.data.providers.map((p) => (
                      <tr key={p.id}>
                        <td style={{ fontWeight: 600 }}>{p.name}</td>
                        <td>{p.typeLabel}</td>
                        <td style={{ maxWidth: 320, whiteSpace: "pre-wrap" }}>{p.info || "—"}</td>
                        <td>{timeAgo(p.createdAt)}</td>
                        <td>
                          <div style={{ display: "flex", gap: 8 }}>
                            <button className="btn btn-primary btn-sm" disabled={busy} onClick={() => verifyProvider(p.id)}>Verify</button>
                            <button className="btn btn-danger btn-sm" disabled={busy} onClick={() => setRejecting({ kind: "provider", id: p.id, label: p.name })}>Reject</button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="card" style={{ textAlign: "center", padding: 28, marginBottom: 28 }}>Nothing waiting on verification.</div>
            )}

            <h2 style={{ fontSize: 15, fontWeight: 700, marginBottom: 10 }}>Listings awaiting review ({q.data?.listings.length ?? 0})</h2>
            {q.data && q.data.listings.length ? (
              <div className="card" style={{ padding: 0, overflowX: "auto" }}>
                <table className="table">
                  <thead><tr><th>Listing</th><th>Kind</th><th>Provider</th><th>Submitted</th><th>Decision</th></tr></thead>
                  <tbody>
                    {q.data.listings.map((l) => (
                      <tr key={l.id}>
                        <td style={{ fontWeight: 600 }}>{l.name}</td>
                        <td>{l.kind === "package" ? "Package" : "Service"}</td>
                        <td>{l.providerName} <span style={{ color: "var(--secondary-text)" }}>· {l.providerTypeLabel}</span></td>
                        <td>{timeAgo(l.createdAt)}</td>
                        <td>
                          <div style={{ display: "flex", gap: 8 }}>
                            <button className="btn btn-primary btn-sm" disabled={busy} onClick={() => approveListing(l.id)}>Publish</button>
                            <button className="btn btn-danger btn-sm" disabled={busy} onClick={() => setRejecting({ kind: "listing", id: l.id, label: l.name })}>Reject</button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="card" style={{ textAlign: "center", padding: 28 }}>Nothing waiting on review.</div>
            )}
          </>
        )}
      </div>

      {rejecting ? (
        <div role="dialog" aria-modal="true" style={{ position: "fixed", inset: 0, background: "rgba(23,25,28,0.45)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 100 }} onClick={() => setRejecting(null)}>
          <div className="card" style={{ width: "100%", maxWidth: 420, margin: 16 }} onClick={(e) => e.stopPropagation()}>
            <h2 style={{ fontSize: 16, fontWeight: 700, marginBottom: 8 }}>
              Reject {rejecting.kind === "provider" ? "verification for" : ""} “{rejecting.label}”?
            </h2>
            <div className="field">
              <label>Reason <span className="optional">(sent to the provider)</span></label>
              <textarea value={reason} onChange={(e) => setReason(e.target.value)} placeholder="What needs to change before this can be approved" />
            </div>
            <div style={{ display: "flex", gap: 10, justifyContent: "flex-end" }}>
              <button className="btn btn-outline" onClick={() => setRejecting(null)} disabled={busy}>Cancel</button>
              <button className="btn btn-danger" onClick={submitReject} disabled={busy}>{busy ? "Working…" : "Reject"}</button>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
