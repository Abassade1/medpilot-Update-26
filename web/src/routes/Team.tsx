import { useState } from "react";
import ConfirmDialog from "../components/ConfirmDialog";
import { SelectField, TextField } from "../components/Field";
import StatusPill from "../components/StatusPill";
import { ApiError } from "../lib/api";
import { useInviteMember, useMyProvider, useRemoveMember, useResendInvite, useTeam } from "../lib/queries";
import type { TeamMemberDto, TeamMemberRole } from "../lib/types";

const ROLE_LABEL: Record<TeamMemberRole, string> = { manager: "Manager", staff: "Staff" };

function timeAgo(iso: string) {
  const mins = Math.round((Date.now() - new Date(iso).getTime()) / 60_000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  if (mins < 1440) return `${Math.round(mins / 60)}h ago`;
  return `${Math.round(mins / 1440)}d ago`;
}

export default function Team() {
  const me = useMyProvider();
  const team = useTeam();
  const invite = useInviteMember();
  const resend = useResendInvite();
  const remove = useRemoveMember();

  const [email, setEmail] = useState("");
  const [role, setRole] = useState<TeamMemberRole | "">("");
  const [formError, setFormError] = useState<string | null>(null);
  const [removing, setRemoving] = useState<TeamMemberDto | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  const canManage = me.data?.myRole === "owner" || me.data?.myRole === "manager";

  const submitInvite = (e: React.FormEvent) => {
    e.preventDefault();
    if (invite.isPending || !role) return;
    setFormError(null);
    invite.mutate({ email: email.trim(), role }, {
      onSuccess: () => { setEmail(""); setRole(""); },
      onError: (err) => setFormError((err as ApiError).fields?.email || (err as ApiError).message || "We couldn't send that invite."),
    });
  };

  const doResend = (id: string) => {
    setBusyId(id);
    resend.mutate(id, { onSettled: () => setBusyId(null) });
  };
  const confirmRemove = () => {
    if (!removing) return;
    setBusyId(removing.id);
    remove.mutate(removing.id, { onSuccess: () => setRemoving(null), onSettled: () => setBusyId(null) });
  };

  if (me.isLoading || team.isLoading) return <div className="content">Loading…</div>;
  if (team.isError) return <div className="content"><div className="banner banner-error">We couldn't load your team.</div></div>;

  return (
    <>
      <header className="topbar"><h1 style={{ fontSize: 20, fontWeight: 700 }}>Team</h1></header>
      <div className="content">
        <div className="card" style={{ padding: 0, overflowX: "auto", marginBottom: canManage ? 24 : 0 }}>
          <table className="table">
            <thead><tr><th>Person</th><th>Role</th><th>Status</th><th>Invited</th>{canManage ? <th>Actions</th> : null}</tr></thead>
            <tbody>
              <tr>
                <td style={{ fontWeight: 600 }}>{team.data?.owner.email}</td>
                <td>Owner</td>
                <td><StatusPill status="active" /></td>
                <td>—</td>
                {canManage ? <td /> : null}
              </tr>
              {team.data?.members.map((m) => (
                <tr key={m.id}>
                  <td style={{ fontWeight: 600 }}>{m.email}</td>
                  <td>{ROLE_LABEL[m.role]}</td>
                  <td><StatusPill status={m.status} /></td>
                  <td>{timeAgo(m.invitedAt)}</td>
                  {canManage ? (
                    <td>
                      <div style={{ display: "flex", gap: 8 }}>
                        {m.status === "invited" ? (
                          <button className="btn btn-outline btn-sm" disabled={busyId === m.id} onClick={() => doResend(m.id)}>
                            {busyId === m.id && resend.isPending ? "Sending…" : "Resend"}
                          </button>
                        ) : null}
                        <button className="btn btn-danger btn-sm" disabled={busyId === m.id} onClick={() => setRemoving(m)}>Remove</button>
                      </div>
                    </td>
                  ) : null}
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {canManage ? (
          <form className="card" style={{ maxWidth: 480 }} onSubmit={submitInvite}>
            <h3 style={{ fontSize: 15, marginBottom: 14 }}>Invite a team member</h3>
            <TextField label="Email address" value={email} onChange={setEmail} type="email" />
            <SelectField
              label="Role" value={role} onChange={(v) => setRole(v as TeamMemberRole)}
              options={[{ value: "manager", label: "Manager — full access, including the team" }, { value: "staff", label: "Staff — can manage listings and bookings" }]}
            />
            {formError ? <p className="field-error" style={{ marginBottom: 10 }}>{formError}</p> : null}
            <button className="btn btn-primary" type="submit" disabled={invite.isPending || !email.trim() || !role}>
              {invite.isPending ? "Sending invite…" : "Send invite"}
            </button>
          </form>
        ) : (
          <p className="field-hint">Only the owner or a manager can invite or remove team members.</p>
        )}
      </div>

      {removing ? (
        <ConfirmDialog
          title={`Remove ${removing.email}?`}
          body={removing.status === "invited" ? "This cancels their pending invite." : "They will immediately lose access to this provider's portal."}
          confirmLabel="Remove" busy={remove.isPending}
          onConfirm={confirmRemove} onCancel={() => setRemoving(null)}
        />
      ) : null}
    </>
  );
}
