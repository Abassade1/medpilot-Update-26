import { NavLink, Outlet } from "react-router-dom";
import { useAuth } from "../lib/auth";
import { useMyProvider, useNotifications } from "../lib/queries";

const NAV = [
  { to: "/", label: "Overview", end: true },
  { to: "/profile", label: "Organization profile" },
  { to: "/services", label: "Services" },
  { to: "/packages", label: "Packages" },
  { to: "/bookings", label: "Bookings" },
  { to: "/notifications", label: "Notifications" },
  { to: "/settings", label: "Settings" },
];

export default function Layout() {
  const { logout } = useAuth();
  const me = useMyProvider();
  const provider = me.data?.provider;
  const notifications = useNotifications();
  const unread = notifications.data?.unreadCount ?? 0;

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="sidebar-brand"><span className="dot" />Medpilot</div>
        <nav>
          {NAV.map((n) => (
            <NavLink key={n.to} to={n.to} end={n.end} className={({ isActive }) => `nav-link${isActive ? " active" : ""}`}>
              {n.label}
              {n.to === "/notifications" && unread > 0 ? <span className="nav-badge">{unread > 9 ? "9+" : unread}</span> : null}
            </NavLink>
          ))}
        </nav>
        <div className="sidebar-footer">
          <div style={{ fontSize: 13, fontWeight: 600 }}>{provider?.name ?? "Your organization"}</div>
          <div style={{ fontSize: 12, color: "var(--secondary-text)", marginBottom: 10 }}>{provider?.typeLabel ?? ""}</div>
          <button className="btn btn-outline btn-sm" style={{ width: "100%" }} onClick={logout}>Sign out</button>
        </div>
      </aside>
      <div className="main">
        <Outlet />
      </div>
    </div>
  );
}
