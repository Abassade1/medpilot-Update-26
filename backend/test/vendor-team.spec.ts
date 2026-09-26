import request from "supertest";
import { SMTPServer } from "smtp-server";
import type { AddressInfo } from "node:net";
import { getApp, closeApp, registerUser, uniqueEmail } from "./helpers";

/**
 * The provider team-roster journey over a real SMTP socket, mirroring email-journey.spec.ts:
 * invite -> message delivered -> token extracted from the delivered body -> accept succeeds.
 */
describe("provider team roster", () => {
  let server: SMTPServer;
  let app: Awaited<ReturnType<typeof getApp>>;
  const inbox: { to: string; body: string }[] = [];

  const linkIn = (body: string): string | null => {
    const decoded = body.replace(/=\r?\n/g, "").replace(/=3D/g, "=");
    const m = /http:\/\/localhost:5173\/invite\?token=([A-Za-z0-9_%-]+)/.exec(decoded);
    return m ? decodeURIComponent(m[1]!) : null;
  };

  beforeAll(async () => {
    server = new SMTPServer({
      authOptional: true,
      disabledCommands: ["STARTTLS", "AUTH"],
      onData(stream, session, cb) {
        let raw = "";
        stream.on("data", (c) => { raw += c.toString(); });
        stream.on("end", () => { inbox.push({ to: session.envelope.rcptTo[0]!.address, body: raw }); cb(); });
      },
    });
    await new Promise<void>((res) => server.listen(0, "127.0.0.1", res));
    const port = (server.server.address() as AddressInfo).port;

    process.env.EMAIL_DRIVER = "smtp";
    process.env.SMTP_HOST = "127.0.0.1";
    process.env.SMTP_PORT = String(port);
    process.env.SMTP_SECURE = "false";
    process.env.SMTP_REQUIRE_TLS = "false";
    process.env.SMTP_ALLOW_INSECURE = "true";
    process.env.SMTP_USER = "";
    process.env.SMTP_PASSWORD = "";

    app = await getApp();
  }, 60_000);

  afterAll(async () => {
    await closeApp();
    await new Promise<void>((res) => server.close(() => res()));
  });

  const auth = (t: string) => ["Authorization", t] as const;
  const req = () => request(app.getHttpServer());

  async function makeProvider() {
    const ownerEmail = uniqueEmail("owner");
    const owner = await registerUser({ email: ownerEmail });
    await req().post("/v1/provider").set(...auth(owner.auth)).send({
      type: "hospital", name: "Riverside General Hospital",
      description: "A full-service regional hospital offering emergency, surgical and inpatient care.",
      country: "Canada", city: "Calgary",
    }).expect(201);
    return { ...owner, email: ownerEmail };
  }

  it("invites a manager, who accepts and gains provider access", async () => {
    const owner = await makeProvider();
    inbox.length = 0;
    const inviteeEmail = uniqueEmail("manager");

    const invited = await req().post("/v1/provider/team/invite").set(...auth(owner.auth))
      .send({ email: inviteeEmail, role: "manager" }).expect(201);
    expect(invited.body.members).toHaveLength(1);
    expect(invited.body.members[0]).toMatchObject({ email: inviteeEmail.toLowerCase(), role: "manager", status: "invited" });

    expect(inbox).toHaveLength(1);
    expect(inbox[0]!.to).toBe(inviteeEmail);
    const token = linkIn(inbox[0]!.body);
    expect(token).toBeTruthy();

    // Preview works before signing in.
    const preview = await req().get(`/v1/provider/team/invite/${encodeURIComponent(token!)}`).expect(200);
    expect(preview.body).toMatchObject({ providerName: "Riverside General Hospital", role: "manager" });

    const invitee = await registerUser({ email: inviteeEmail });
    const accepted = await req().post("/v1/provider/team/accept").set(...auth(invitee.auth)).send({ token }).expect(200);
    expect(accepted.body.provider).toBeTruthy();
    expect(accepted.body.myRole).toBe("manager");

    // The now-active member can reach provider-scoped routes, e.g. the dashboard.
    await req().get("/v1/provider/dashboard").set(...auth(invitee.auth)).expect(200);

    const roster = await req().get("/v1/provider/team").set(...auth(owner.auth)).expect(200);
    expect(roster.body.members[0]).toMatchObject({ email: inviteeEmail.toLowerCase(), status: "active" });
  }, 60_000);

  it("a staff member can operate the provider portal but cannot manage the team", async () => {
    const owner = await makeProvider();
    const inviteeEmail = uniqueEmail("staffer");
    inbox.length = 0;
    const invited = await req().post("/v1/provider/team/invite").set(...auth(owner.auth)).send({ email: inviteeEmail, role: "staff" }).expect(201);
    const token = linkIn(inbox[0]!.body)!;
    const memberId = invited.body.members[0].id as string;

    const invitee = await registerUser({ email: inviteeEmail });
    await req().post("/v1/provider/team/accept").set(...auth(invitee.auth)).send({ token }).expect(200);

    await req().get("/v1/provider/listings").set(...auth(invitee.auth)).expect(200);
    const blocked = await req().post("/v1/provider/team/invite").set(...auth(invitee.auth))
      .send({ email: uniqueEmail("nope"), role: "staff" });
    expect(blocked.status).toBe(403);

    const blockedRemove = await req().delete(`/v1/provider/team/${memberId}`).set(...auth(invitee.auth));
    expect(blockedRemove.status).toBe(403);
  }, 60_000);

  it("removing a member revokes their provider access", async () => {
    const owner = await makeProvider();
    const inviteeEmail = uniqueEmail("removed");
    inbox.length = 0;
    const invited = await req().post("/v1/provider/team/invite").set(...auth(owner.auth)).send({ email: inviteeEmail, role: "staff" }).expect(201);
    const token = linkIn(inbox[0]!.body)!;
    const memberId = invited.body.members[0].id as string;

    const invitee = await registerUser({ email: inviteeEmail });
    await req().post("/v1/provider/team/accept").set(...auth(invitee.auth)).send({ token }).expect(200);
    await req().get("/v1/provider/dashboard").set(...auth(invitee.auth)).expect(200);

    await req().delete(`/v1/provider/team/${memberId}`).set(...auth(owner.auth)).expect(200);
    await req().get("/v1/provider/dashboard").set(...auth(invitee.auth)).expect(403);
  }, 60_000);

  it("rejects an invite accepted by the wrong email, and an expired/invalid token", async () => {
    const owner = await makeProvider();
    const inviteeEmail = uniqueEmail("mismatch");
    inbox.length = 0;
    await req().post("/v1/provider/team/invite").set(...auth(owner.auth)).send({ email: inviteeEmail, role: "staff" }).expect(201);
    const token = linkIn(inbox[0]!.body)!;

    const stranger = await registerUser();
    const wrong = await req().post("/v1/provider/team/accept").set(...auth(stranger.auth)).send({ token });
    expect(wrong.status).toBe(403);

    const bad = await req().post("/v1/provider/team/accept").set(...auth(stranger.auth)).send({ token: "not-a-real-token" });
    expect(bad.status).toBe(400);
  }, 60_000);

  it("won't double-invite the same pending email, and can't invite the owner's own address", async () => {
    const owner = await makeProvider();
    const email = uniqueEmail("dup");
    await req().post("/v1/provider/team/invite").set(...auth(owner.auth)).send({ email, role: "staff" }).expect(201);
    const dupe = await req().post("/v1/provider/team/invite").set(...auth(owner.auth)).send({ email, role: "manager" });
    expect(dupe.status).toBe(409);

    const ownEmail = await req().post("/v1/provider/team/invite").set(...auth(owner.auth)).send({ email: owner.email, role: "manager" });
    expect(ownEmail.status).toBe(409);
  }, 60_000);

  async function invite(role: "manager" | "staff" = "staff") {
    const owner = await makeProvider();
    const email = uniqueEmail("joiner");
    inbox.length = 0;
    await req().post("/v1/provider/team/invite").set(...auth(owner.auth)).send({ email, role }).expect(201);
    return { owner, email, token: linkIn(inbox[0]!.body)! };
  }

  it("an invitee can create an account with just a name and password, and lands on the team", async () => {
    const { owner, email, token } = await invite("staff");
    const res = await req().post("/v1/provider/team/join")
      .send({ token, firstName: "Grace", lastName: "Hopper", password: "Str0ngPassw0rd!" }).expect(201);
    expect(res.body.user).toMatchObject({ email, emailVerified: true });
    expect(res.body.profile).toMatchObject({ firstName: "Grace", lastName: "Hopper" });

    const bearer = `Bearer ${res.body.tokens.accessToken}`;
    const me = await req().get("/v1/provider/me").set("Authorization", bearer).expect(200);
    expect(me.body.myRole).toBe("staff");
    const roster = await req().get("/v1/provider/team").set(...auth(owner.auth)).expect(200);
    expect(roster.body.members[0]).toMatchObject({ email, status: "active" });

    // The new account can sign in normally afterwards.
    await req().post("/v1/auth/login").send({ email, password: "Str0ngPassw0rd!" }).expect(200);
  }, 60_000);

  it("won't create a second account for an email that already has one", async () => {
    const { owner, email, token } = await invite();
    await registerUser({ email });
    const res = await req().post("/v1/provider/team/join")
      .send({ token, firstName: "Grace", lastName: "Hopper", password: "Str0ngPassw0rd!" });
    expect(res.status).toBe(409);
    const roster = await req().get("/v1/provider/team").set(...auth(owner.auth)).expect(200);
    expect(roster.body.members[0]).toMatchObject({ email, status: "invited" });
  }, 60_000);

  it("rejects an invalid invite token and a weak password", async () => {
    const bad = await req().post("/v1/provider/team/join")
      .send({ token: "pmi_not-a-real-token", firstName: "Grace", lastName: "Hopper", password: "Str0ngPassw0rd!" });
    expect(bad.status).toBe(400);
    const { token } = await invite();
    const weak = await req().post("/v1/provider/team/join").send({ token, firstName: "Grace", lastName: "Hopper", password: "short" });
    expect(weak.status).toBe(422);
  }, 60_000);
});
