import React, { useState } from "react";
import { api, ApiError } from "../lib/api";
import { useAuth } from "../lib/auth";

export default function Settings() {
  const { logout } = useAuth();
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (busy) return;
    setBusy(true); setError(null); setMsg(null);
    try {
      await api.post("/v1/me/password", { password: next, currentPassword: current });
      setMsg("Password updated");
      setCurrent(""); setNext("");
    } catch (err) {
      const x = err as ApiError;
      setError(x.fields?.password || x.fields?.currentPassword || x.message || "We couldn't update your password.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <header className="topbar"><h1 style={{ fontSize: 20, fontWeight: 700 }}>Settings</h1></header>
      <div className="content" style={{ maxWidth: 480 }}>
        <form className="card" onSubmit={submit}>
          <h3 style={{ fontSize: 15, marginBottom: 14 }}>Change password</h3>
          <div className="field">
            <label>Current password</label>
            <input type="password" value={current} onChange={(e) => setCurrent(e.target.value)} required />
          </div>
          <div className="field">
            <label>New password</label>
            <input type="password" value={next} onChange={(e) => setNext(e.target.value)} minLength={8} required />
          </div>
          {error ? <p className="field-error" style={{ marginBottom: 10 }}>{error}</p> : null}
          {msg ? <p style={{ color: "#1B7A46", fontSize: 13, marginBottom: 10 }}>{msg}</p> : null}
          <button className="btn btn-primary" type="submit" disabled={busy}>Update password</button>
        </form>

        <div className="card" style={{ marginTop: 18 }}>
          <h3 style={{ fontSize: 15, marginBottom: 10 }}>Account</h3>
          <button className="btn btn-outline" onClick={logout}>Sign out</button>
        </div>
      </div>
    </>
  );
}
