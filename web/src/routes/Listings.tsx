import { useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import StatusPill from "../components/StatusPill";
import ConfirmDialog from "../components/ConfirmDialog";
import { useListingAction, useListings } from "../lib/queries";
import { ApiError } from "../lib/api";
import type { ListingDto } from "../lib/types";

const STATUSES = [["", "All"], ["draft", "Draft"], ["review", "In review"], ["published", "Published"], ["unpublished", "Unpublished"], ["archived", "Archived"]] as const;

type Action = "publish" | "unpublish" | "archive" | "duplicate" | "delete";
const CONFIRM: Partial<Record<Action, { title: (name: string) => string; body: string; confirmLabel: string }>> = {
  delete: { title: (n) => `Delete "${n}"?`, body: "This can't be undone.", confirmLabel: "Delete" },
  unpublish: { title: (n) => `Unpublish "${n}"?`, body: "Members will no longer find or book it.", confirmLabel: "Unpublish" },
  archive: { title: (n) => `Archive "${n}"?`, body: "It's hidden from members. Existing bookings are unaffected.", confirmLabel: "Archive" },
};

export default function Listings({ kind }: { kind: "service" | "package" }) {
  const [params] = useSearchParams();
  const [status, setStatus] = useState(params.get("status") ?? "");
  const q = useListings(kind, status || undefined);
  const act = useListingAction();
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState<{ listing: ListingDto; action: Action } | null>(null);

  const run = (l: ListingDto, action: Action) => {
    if (CONFIRM[action] && pending?.listing.id !== l.id) { setPending({ listing: l, action }); return; }
    if (act.isPending) return;
    setError(null);
    setPending(null);
    act.mutate({ id: l.id, action }, {
      onError: (e) => { const x = e as ApiError; setError(x.fields ? Object.values(x.fields).join(" ") : x.message || "That didn't work."); },
    });
  };

  const title = kind === "service" ? "Services" : "Packages";
  const confirmSpec = pending ? CONFIRM[pending.action] : null;

  return (
    <>
      <header className="topbar">
        <h1 style={{ fontSize: 20, fontWeight: 700 }}>{title}</h1>
        <Link className="btn btn-primary" to={`/${kind === "service" ? "services" : "packages"}/new`}>New {kind}</Link>
      </header>
      <div className="content">
        <div className="chips">
          {STATUSES.map(([v, label]) => (
            <button key={v} className={`chip${status === v ? " active" : ""}`} onClick={() => setStatus(v)}>{label}</button>
          ))}
        </div>
        {error ? <div className="banner banner-error" style={{ marginBottom: 14 }}>{error}</div> : null}
        {q.isLoading ? <p>Loading…</p> : q.isError ? (
          <div className="banner banner-error">We couldn't load your {title.toLowerCase()}.</div>
        ) : q.data && q.data.length ? (
          <div className="card" style={{ padding: 0, overflowX: "auto" }}>
            <table className="table">
              <thead>
                <tr>
                  <th>{kind === "service" ? "Service" : "Package"}</th>
                  <th>Category</th>
                  <th>Status</th>
                  <th>Price</th>
                  <th>Availability</th>
                  <th>Bookings</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {q.data.map((l) => (
                  <tr key={l.id}>
                    <td style={{ fontWeight: 600 }}>{l.name}{l.rejectionNote ? <div className="field-error" style={{ fontWeight: 400 }}>{l.rejectionNote}</div> : null}</td>
                    <td>{l.categoryLabel || "—"}</td>
                    <td><StatusPill status={l.status} /></td>
                    <td>{l.priceLabel}</td>
                    <td>{l.bookable ? "Bookable" : "No availability"}</td>
                    <td>{l.bookingCount}</td>
                    <td>
                      <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                        <Link className="btn btn-outline btn-sm" to={`/listing/${l.id}/preview`}>View</Link>
                        {l.status !== "published" && l.status !== "review" ? <Link className="btn btn-outline btn-sm" to={`/${kind === "service" ? "services" : "packages"}/${l.id}`}>Edit</Link> : null}
                        <Link className="btn btn-outline btn-sm" to={`/listing/${l.id}/availability`}>Availability</Link>
                        {(l.status === "draft" || l.status === "unpublished") ? <button className="btn btn-outline btn-sm" onClick={() => run(l, "publish")} disabled={act.isPending}>Publish</button> : null}
                        {(l.status === "published" || l.status === "review") ? <button className="btn btn-outline btn-sm" onClick={() => run(l, "unpublish")} disabled={act.isPending}>Unpublish</button> : null}
                        <button className="btn btn-outline btn-sm" onClick={() => run(l, "duplicate")} disabled={act.isPending}>Duplicate</button>
                        {l.status !== "archived" ? <button className="btn btn-outline btn-sm" onClick={() => run(l, "archive")} disabled={act.isPending}>Archive</button> : null}
                        {l.status !== "published" && l.status !== "review" ? <button className="btn btn-danger btn-sm" onClick={() => run(l, "delete")} disabled={act.isPending}>Delete</button> : null}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="card" style={{ textAlign: "center", padding: 40 }}>
            <p style={{ marginBottom: 14 }}>No {title.toLowerCase()} yet. Create one and publish it so members can find and book it.</p>
            <Link className="btn btn-primary" to={`/${kind === "service" ? "services" : "packages"}/new`}>Create a {kind}</Link>
          </div>
        )}
      </div>
      {pending && confirmSpec ? (
        <ConfirmDialog
          title={confirmSpec.title(pending.listing.name)}
          body={confirmSpec.body}
          confirmLabel={confirmSpec.confirmLabel}
          busy={act.isPending}
          onConfirm={() => run(pending.listing, pending.action)}
          onCancel={() => setPending(null)}
        />
      ) : null}
    </>
  );
}
