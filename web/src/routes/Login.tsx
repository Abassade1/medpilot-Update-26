import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../lib/auth";
import { ApiError } from "../lib/api";

export default function Login() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (busy) return;
    setBusy(true); setError(null);
    try {
      await login(email.trim(), password);
      navigate("/", { replace: true });
    } catch (err) {
      const x = err as ApiError;
      setError(x.isOffline ? "You appear to be offline. Check your connection and try again." : x.message || "We couldn't sign you in.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="login-shell">
      <form className="login-card" onSubmit={submit}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 22 }}>
          <span style={{ width: 28, height: 28, borderRadius: 8, background: "var(--primary)", display: "inline-block" }} />
          <strong style={{ fontSize: 18 }}>Medpilot</strong>
        </div>
        <h1 style={{ fontSize: 20, fontWeight: 700, marginBottom: 4 }}>Provider portal</h1>
        <p style={{ fontSize: 13.5, color: "var(--secondary-text)", marginBottom: 22 }}>
          For hospitals, medical centers, veterinary centers and transportation providers. Sign in with your Medpilot account.
        </p>
        <div className="field">
          <label>Email address</label>
          <input type="email" autoComplete="username" value={email} onChange={(e) => setEmail(e.target.value)} required />
        </div>
        <div className="field">
          <label>Password</label>
          <input type="password" autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} required />
        </div>
        {error ? <p className="field-error" style={{ marginBottom: 12 }}>{error}</p> : null}
        <button type="submit" className="btn btn-primary" style={{ width: "100%" }} disabled={busy}>
          {busy ? "Signing in…" : "Sign in"}
        </button>
        <p style={{ fontSize: 12.5, color: "var(--secondary-text)", marginTop: 16, textAlign: "center" }}>
          Individual and independent providers manage their services from the Medpilot mobile app instead.
        </p>
      </form>
    </div>
  );
}
