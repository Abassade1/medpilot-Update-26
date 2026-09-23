/**
 * A styled stand-in for window.confirm(). Not just cosmetic: the native dialog blocks the render
 * thread, looks nothing like the rest of the app, and (as found while testing this app) simply
 * cannot be driven by an automated or embedded browser context, which a real confirm must be.
 */
export default function ConfirmDialog({ title, body, confirmLabel, danger = true, busy, onConfirm, onCancel }: {
  title: string; body: string; confirmLabel: string; danger?: boolean; busy?: boolean;
  onConfirm: () => void; onCancel: () => void;
}) {
  return (
    <div
      role="dialog" aria-modal="true" aria-labelledby="confirm-dialog-title"
      style={{ position: "fixed", inset: 0, background: "rgba(23,25,28,0.45)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 100 }}
      onClick={onCancel}
    >
      <div className="card" style={{ width: "100%", maxWidth: 380, margin: 16 }} onClick={(e) => e.stopPropagation()}>
        <h2 id="confirm-dialog-title" style={{ fontSize: 16, fontWeight: 700, marginBottom: 8 }}>{title}</h2>
        <p style={{ fontSize: 13.5, color: "var(--secondary-text)", lineHeight: 1.5, marginBottom: 20 }}>{body}</p>
        <div style={{ display: "flex", gap: 10, justifyContent: "flex-end" }}>
          <button className="btn btn-outline" onClick={onCancel} disabled={busy}>Cancel</button>
          <button className={danger ? "btn btn-danger" : "btn btn-primary"} onClick={onConfirm} disabled={busy}>
            {busy ? "Working…" : confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
