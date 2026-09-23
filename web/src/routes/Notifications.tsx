import { useNavigate } from "react-router-dom";
import { useMarkNotificationsRead, useNotifications } from "../lib/queries";
import type { NotificationsDto } from "../lib/types";

type Item = NotificationsDto["items"][number];

/** Deep links are `medpilot://<kind>/<id>`, shared with the mobile app's push/in-app links. */
function destination(url?: string): string | null {
  if (!url) return null;
  if (url === "medpilot://provider") return "/";
  const booking = /^medpilot:\/\/provider\/bookings\/([\w-]+)$/.exec(url);
  if (booking) return `/bookings/${booking[1]}`;
  const listing = /^medpilot:\/\/provider\/listings\/([\w-]+)$/.exec(url);
  if (listing) return `/listing/${listing[1]}/preview`;
  return null;
}

function when(iso: string) {
  const d = new Date(iso);
  const diffMin = Math.round((Date.now() - d.getTime()) / 60_000);
  if (diffMin < 1) return "Just now";
  if (diffMin < 60) return `${diffMin}m ago`;
  if (diffMin < 1440) return `${Math.round(diffMin / 60)}h ago`;
  return d.toLocaleDateString();
}

export default function Notifications() {
  const q = useNotifications();
  const markRead = useMarkNotificationsRead();
  const navigate = useNavigate();
  const items = q.data?.items ?? [];

  const open = (n: Item) => {
    if (!n.read) markRead.mutate([n.id]);
    const dest = destination(n.data?.url);
    if (dest) navigate(dest);
  };

  return (
    <>
      <header className="topbar">
        <h1 style={{ fontSize: 20, fontWeight: 700 }}>Notifications</h1>
        {items.some((i) => !i.read) ? (
          <button className="btn btn-outline btn-sm" onClick={() => markRead.mutate("all")} disabled={markRead.isPending}>Mark all read</button>
        ) : null}
      </header>
      <div className="content">
        {q.isLoading ? <p>Loading…</p> : q.isError ? (
          <div className="banner banner-error">We couldn't load notifications.</div>
        ) : items.length ? (
          <div className="card" style={{ padding: 0 }}>
            {items.map((n, i) => (
              <button
                key={n.id}
                onClick={() => open(n)}
                style={{
                  display: "block", width: "100%", textAlign: "left", background: n.read ? "transparent" : "var(--primary-light)",
                  border: "none", borderBottom: i < items.length - 1 ? "1px solid var(--border)" : "none",
                  padding: "14px 18px", cursor: "pointer", font: "inherit", color: "inherit",
                }}
              >
                <div style={{ display: "flex", justifyContent: "space-between", gap: 12 }}>
                  <span style={{ fontWeight: n.read ? 500 : 700, fontSize: 14 }}>{n.title}</span>
                  <span style={{ fontSize: 12, color: "var(--secondary-text)", whiteSpace: "nowrap" }}>{when(n.createdAt)}</span>
                </div>
                <p style={{ fontSize: 13, color: "var(--secondary-text)", marginTop: 4 }}>{n.body}</p>
              </button>
            ))}
          </div>
        ) : (
          <div className="card" style={{ textAlign: "center", padding: 40 }}>Nothing here yet. Booking and account updates will show up here.</div>
        )}
      </div>
    </>
  );
}
