import React, { useState } from "react";
import { Link } from "react-router-dom";
import { api, ApiError } from "../lib/api";

export default function ForgotPassword() {
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (busy) return;
    setBusy(true); setError(null);
    try {
      // `portal` makes the emailed link open this portal's reset page rather than the mobile app.
      await api.post("/v1/auth/password/forgot", { email: email.trim(), portal: true });
      setSent(true);
    } catch (err) {
      const x = err as ApiError;
      setError(x.isOffline ? "You appear to be offline. Check your connection and try again." : x.fields?.email || x.message || "That didn't work.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="login-shell">
      <form className="login-card" onSubmit={submit}>
        <h1 style={{ fontSize: 20, fontWeight: 700, marginBottom: 4 }}>Reset your password</h1>
        {sent ? (
          <>
            {/* The same message whether or not the account exists, so this can't be used to look up who has one. */}
            <p style={{ fontSize: 13.5, color: "var(--secondary-text)", lineHeight: 1.5, margin: "10px 0 20px" }}>
              If an account exists for <strong>{email.trim()}</strong>, a reset link is on its way. It expires in one hour.
            </p>
            <Link className="btn btn-outline" style={{ width: "100%" }} to="/login">Back to sign in</Link>
          </>
        ) : (
          <>
            <p style={{ fontSize: 13.5, color: "var(--secondary-text)", marginBottom: 22 }}>
              Enter your account email and we'll send you a link to choose a new password.
            </p>
            <div className="field">
              <label>Email address</label>
              <input type="email" autoComplete="username" value={email} onChange={(e) => setEmail(e.target.value)} required />
            </div>
            {error ? <p className="field-error" style={{ marginBottom: 12 }}>{error}</p> : null}
            <button type="submit" className="btn btn-primary" style={{ width: "100%" }} disabled={busy}>
              {busy ? "Sending…" : "Send reset link"}
            </button>
            <p style={{ fontSize: 13, marginTop: 16, textAlign: "center" }}><Link to="/login">Back to sign in</Link></p>
          </>
        )}
      </form>
    </div>
  );
}
