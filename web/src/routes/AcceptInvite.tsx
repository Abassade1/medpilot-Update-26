import React, { useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { TextField } from "../components/Field";
import { ApiError } from "../lib/api";
import { useAuth } from "../lib/auth";
import { useAcceptInvite, useInvitePreview } from "../lib/queries";

const ROLE_LABEL: Record<string, string> = { manager: "a manager", staff: "a staff member" };

export default function AcceptInvite() {
  const [params] = useSearchParams();
  const token = params.get("token");
  const navigate = useNavigate();
  const { login, register } = useAuth();
  const preview = useInvitePreview(token);
  const accept = useAcceptInvite();

  const [mode, setMode] = useState<"signin" | "create">("create");
  const [password, setPassword] = useState("");
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [phone, setPhone] = useState("");
  const [dateOfBirth, setDateOfBirth] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const email = preview.data?.email ?? "";

  const finish = async () => {
    try {
      await accept.mutateAsync(token!);
      navigate("/", { replace: true });
    } catch (err) {
      setError((err as ApiError).message || "We couldn't add you to this team. Try opening the invite link again.");
    }
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (busy) return;
    setBusy(true); setError(null);
    try {
      if (mode === "signin") {
        await login(email, password);
      } else {
        await register({ email, password, firstName: firstName.trim(), lastName: lastName.trim(), phone: phone.trim(), dateOfBirth });
      }
      await finish();
    } catch (err) {
      const x = err as ApiError;
      setError(x.fields ? Object.values(x.fields)[0]! : x.isOffline ? "You appear to be offline." : x.message || "That didn't work.");
    } finally {
      setBusy(false);
    }
  };

  if (!token) {
    return (
      <div className="login-shell"><div className="login-card">
        <h1 style={{ fontSize: 20, fontWeight: 700, marginBottom: 8 }}>Invite link missing</h1>
        <p style={{ fontSize: 13.5, color: "var(--secondary-text)" }}>Open this page using the link from your invite email.</p>
      </div></div>
    );
  }
  if (preview.isLoading) return <div className="login-shell"><div className="login-card">Loading…</div></div>;
  if (preview.isError) {
    return (
      <div className="login-shell"><div className="login-card">
        <h1 style={{ fontSize: 20, fontWeight: 700, marginBottom: 8 }}>This invite isn't valid</h1>
        <p style={{ fontSize: 13.5, color: "var(--secondary-text)" }}>{(preview.error as ApiError).message || "It may have expired or already been used. Ask the provider to send a new one."}</p>
      </div></div>
    );
  }

  return (
    <div className="login-shell">
      <form className="login-card" onSubmit={submit}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 22 }}>
          <span style={{ width: 28, height: 28, borderRadius: 8, background: "var(--primary)", display: "inline-block" }} />
          <strong style={{ fontSize: 18 }}>Medpilot</strong>
        </div>
        <h1 style={{ fontSize: 20, fontWeight: 700, marginBottom: 4 }}>Join {preview.data!.providerName}</h1>
        <p style={{ fontSize: 13.5, color: "var(--secondary-text)", marginBottom: 22 }}>
          You've been invited as {ROLE_LABEL[preview.data!.role] ?? preview.data!.role} for <strong>{email}</strong>.
        </p>

        <div style={{ display: "flex", gap: 6, marginBottom: 18 }}>
          <button type="button" className={mode === "create" ? "btn btn-primary btn-sm" : "btn btn-outline btn-sm"} onClick={() => setMode("create")}>Create account</button>
          <button type="button" className={mode === "signin" ? "btn btn-primary btn-sm" : "btn btn-outline btn-sm"} onClick={() => setMode("signin")}>I already have an account</button>
        </div>

        {mode === "create" ? (
          <>
            <div className="form-grid">
              <TextField label="First name" value={firstName} onChange={setFirstName} />
              <TextField label="Last name" value={lastName} onChange={setLastName} />
            </div>
            <TextField label="Phone" value={phone} onChange={setPhone} placeholder="+1 403 555 0100" />
            <TextField label="Date of birth" value={dateOfBirth} onChange={setDateOfBirth} type="date" />
          </>
        ) : null}
        <div className="field">
          <label>Password</label>
          <input type="password" autoComplete={mode === "create" ? "new-password" : "current-password"} value={password} onChange={(e) => setPassword(e.target.value)} required minLength={8} />
        </div>

        {error ? <p className="field-error" style={{ marginBottom: 12 }}>{error}</p> : null}
        <button type="submit" className="btn btn-primary" style={{ width: "100%" }} disabled={busy}>
          {busy ? "Working…" : mode === "create" ? "Create account & join" : "Sign in & join"}
        </button>
      </form>
    </div>
  );
}
