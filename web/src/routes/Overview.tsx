import { Link } from "react-router-dom";
import { useDashboard, useMyProvider } from "../lib/queries";
import StatusPill from "../components/StatusPill";

export default function Overview() {
  const me = useMyProvider();
  const dash = useDashboard(!!me.data?.provider);

  if (me.isLoading) return <div className="content">Loading…</div>;
  if (me.isError) return <div className="content"><div className="banner banner-error">We couldn't load your account.</div></div>;

  const provider = me.data?.provider;
  if (!provider) {
    return (
      <div className="content">
        <div className="card" style={{ maxWidth: 520 }}>
          <h2 style={{ fontSize: 20, marginBottom: 8 }}>Set up your organization</h2>
          <p style={{ fontSize: 13.5, color: "var(--secondary-text)", marginBottom: 18, lineHeight: 1.6 }}>
            Create your organization's profile to start publishing services, packages and managing bookings from this portal.
          </p>
          <Link className="btn btn-primary" to="/profile">Set up profile</Link>
        </div>
      </div>
    );
  }

  const d = dash.data;
  const tiles: { label: string; value: number | string; to: string }[] = [
    { label: "Pending bookings", value: d?.bookings.pending ?? "–", to: "/bookings?status=pending" },
    { label: "Upcoming", value: d?.bookings.upcoming ?? "–", to: "/bookings?status=confirmed" },
    { label: "Completed", value: d?.bookings.completed ?? "–", to: "/bookings?status=completed" },
    { label: "Published services", value: d?.services.published ?? "–", to: "/services" },
    { label: "Published packages", value: d?.packages.published ?? "–", to: "/packages" },
    { label: "Drafts", value: d ? d.services.draft + d.packages.draft : "–", to: "/services" },
  ];

  return (
    <>
      <header className="topbar">
        <div>
          <h1 style={{ fontSize: 20, fontWeight: 700 }}>{provider.name}</h1>
          <p style={{ fontSize: 12.5, color: "var(--secondary-text)" }}>{provider.typeLabel}</p>
        </div>
        <StatusPill status={provider.verificationStatus} />
      </header>
      <div className="content">
        {provider.verificationStatus !== "verified" ? (
          <div className="banner banner-warn" style={{ marginBottom: 18 }}>
            {provider.verificationStatus === "pending"
              ? "Your verification is under review. Services you publish now go to review and appear to members once approved."
              : provider.verificationStatus === "rejected"
              ? `Verification wasn't approved${provider.verificationNote ? `: ${provider.verificationNote}` : "."} Update your details on the profile page and resubmit.`
              : "Submit your verification details so your services can go live for members."}
            {" "}<Link to="/profile">Open profile</Link>
          </div>
        ) : null}
        {!provider.profileComplete ? (
          <div className="banner banner-warn" style={{ marginBottom: 18 }}>
            Complete your profile to publish: {Object.values(provider.profileGaps).join(", ")}.
          </div>
        ) : null}

        <div className="grid-tiles" style={{ marginBottom: 24 }}>
          {tiles.map((t) => (
            <Link key={t.label} to={t.to} className="tile" style={{ textDecoration: "none", color: "inherit" }}>
              <div className="tile-label">{t.label}</div>
              <div className="tile-value">{t.value}</div>
            </Link>
          ))}
        </div>

        {d?.completedValueLabel ? (
          <div className="card" style={{ marginBottom: 18 }}>
            <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 4 }}>Completed bookings value</div>
            <div style={{ fontSize: 24, fontWeight: 700 }}>{d.completedValueLabel}</div>
            <div style={{ fontSize: 12, color: "var(--secondary-text)", marginTop: 4 }}>{d.completedValueNote}</div>
          </div>
        ) : null}

        {d && d.topListings.length ? (
          <div className="card">
            <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 10 }}>Most viewed</div>
            {d.topListings.map((l) => (
              <div key={l.id} style={{ display: "flex", justifyContent: "space-between", padding: "8px 0", borderBottom: "1px solid var(--border)" }}>
                <span style={{ fontSize: 14 }}>{l.name}</span>
                <span style={{ fontSize: 12.5, color: "var(--secondary-text)" }}>{l.views} views · {l.bookings} bookings</span>
              </div>
            ))}
          </div>
        ) : null}

        <div style={{ display: "flex", gap: 10, marginTop: 20 }}>
          <Link className="btn btn-primary" to="/services/new">Create a service</Link>
          <Link className="btn btn-outline" to="/packages/new">Create a package</Link>
        </div>
      </div>
    </>
  );
}
