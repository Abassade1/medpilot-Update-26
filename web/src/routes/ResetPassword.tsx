import React, { useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { api, ApiError } from "../lib/api";

export default function ResetPassword() {
  const [params] = useSearchParams();
  const token = params.get("token");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (busy || !token) return;
    setBusy(true); setError(null);
    try {
      await api.post("/v1/auth/password/reset", { token, password });
      setDone(true);
    } catch (err) {
      const x = err as ApiError;
      setError(x.isOffline ? "You appear to be offline. Check your connection and try again." : x.fields?.password || x.message || "That didn't work.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="login-shell">
      <form className="login-card" onSubmit={submit}>
        <h1 style={{ fontSize: 20, fontWeight: 700, marginBottom: 4 }}>Choose a new password</h1>
        {!token ? (
          <>
            <p style={{ fontSize: 13.5, color: "var(--secondary-text)", margin: "10px 0 20px" }}>Open this page using the link from your reset email.</p>
            <Link className="btn btn-outline" style={{ width: "100%" }} to="/forgot">Send a new link</Link>
          </>
        ) : done ? (
          <>
            <p style={{ fontSize: 13.5, color: "var(--secondary-text)", lineHeight: 1.5, margin: "10px 0 20px" }}>
              Your password has been changed and you've been signed out everywhere. Sign in with your new password.
            </p>
            <Link className="btn btn-primary" style={{ width: "100%" }} to="/login">Sign in</Link>
          </>
        ) : (
          <>
            <p style={{ fontSize: 13.5, color: "var(--secondary-text)", marginBottom: 22 }}>Use at least 8 characters.</p>
            <div className="field">
              <label>New password</label>
              <input type="password" autoComplete="new-password" value={password} onChange={(e) => setPassword(e.target.value)} required minLength={8} />
            </div>
            {error ? <p className="field-error" style={{ marginBottom: 12 }}>{error}</p> : null}
            <button type="submit" className="btn btn-primary" style={{ width: "100%" }} disabled={busy}>
              {busy ? "Saving…" : "Change password"}
            </button>
            {error ? <p style={{ fontSize: 13, marginTop: 16, textAlign: "center" }}><Link to="/forgot">Send a new link</Link></p> : null}
          </>
        )}
      </form>
    </div>
  );
}
