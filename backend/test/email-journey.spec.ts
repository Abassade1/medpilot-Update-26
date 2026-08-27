import request from "supertest";
import { SMTPServer } from "smtp-server";
import type { AddressInfo } from "node:net";
import { getApp, closeApp } from "./helpers";

/**
 * The account-activation journey end to end over a real SMTP socket:
 * register -> message delivered -> token extracted from the delivered body ->
 * verification succeeds. Nothing reads the token out of the database, so a
 * broken link or a message that never leaves the process fails this suite.
 */
describe("email journey", () => {
  let server: SMTPServer;
  let app: Awaited<ReturnType<typeof getApp>>;
  const inbox: { to: string; body: string }[] = [];

  const linkIn = (body: string, path: "verify" | "reset"): string | null => {
    const decoded = body.replace(/=\r?\n/g, "").replace(/=3D/g, "=");
    const m = new RegExp(`medpilot://${path}\\?token=([A-Za-z0-9_%-]+)`).exec(decoded);
    return m ? decodeURIComponent(m[1]!) : null;
  };

  beforeAll(async () => {
    server = new SMTPServer({
      authOptional: true,
      disabledCommands: ["STARTTLS", "AUTH"],
      onData(stream, session, cb) {
        let raw = "";
        stream.on("data", (c) => { raw += c.toString(); });
        stream.on("end", () => {
          inbox.push({ to: session.envelope.rcptTo[0]!.address, body: raw });
          cb();
        });
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

  const register = async (email: string) => {
    const res = await request(app.getHttpServer()).post("/v1/auth/register").send({
      email, password: "Str0ngPassw0rd!", firstName: "Mail", lastName: "Tester",
      phone: "+14165551234", dateOfBirth: "1990-01-01",
    });
    expect(res.status).toBe(201);
    return res.body as { tokens: { accessToken: string } };
  };

  it("registration delivers a verification link that verifies the account", async () => {
    inbox.length = 0;
    const address = `verify-${Date.now()}@example.com`;
    const { tokens } = await register(address);

    // Delivered over the wire, to the right person.
    expect(inbox).toHaveLength(1);
    expect(inbox[0]!.to).toBe(address);

    const before = await request(app.getHttpServer())
      .get("/v1/auth/verification-status")
      .set("authorization", `Bearer ${tokens.accessToken}`);
    expect(before.body.emailVerified).toBe(false);

    const token = linkIn(inbox[0]!.body, "verify");
    expect(token).toBeTruthy();

    await request(app.getHttpServer())
      .post("/v1/auth/verification/confirm").send({ token }).expect(204);

    const after = await request(app.getHttpServer())
      .get("/v1/auth/verification-status")
      .set("authorization", `Bearer ${tokens.accessToken}`);
    expect(after.body.emailVerified).toBe(true);
  }, 60_000);

  it("a verification token cannot be replayed", async () => {
    inbox.length = 0;
    await register(`replay-${Date.now()}@example.com`);
    const token = linkIn(inbox[0]!.body, "verify")!;

    await request(app.getHttpServer())
      .post("/v1/auth/verification/confirm").send({ token }).expect(204);
    const second = await request(app.getHttpServer())
      .post("/v1/auth/verification/confirm").send({ token });

    expect(second.status).toBe(400);
    expect(second.body.error.message).toMatch(/invalid or has expired/i);
    expect(JSON.stringify(second.body)).not.toContain(token);
  }, 60_000);

  it("rejects invalid and malformed verification tokens with a safe message", async () => {
    for (const token of ["vt_not-a-real-token", "", "../../etc/passwd", "a".repeat(500)]) {
      const res = await request(app.getHttpServer())
        .post("/v1/auth/verification/confirm").send({ token });
      expect([400, 422]).toContain(res.status);
      // Never leaks whether the token merely expired vs never existed.
      expect(JSON.stringify(res.body)).not.toMatch(/stack|sql|postgres|constraint/i);
    }
  }, 60_000);

  it("password reset delivers a working link, and the old password stops working", async () => {
    inbox.length = 0;
    const address = `reset-${Date.now()}@example.com`;
    await register(address);
    inbox.length = 0;

    await request(app.getHttpServer())
      .post("/v1/auth/password/forgot").send({ email: address }).expect(202);
    expect(inbox).toHaveLength(1);

    const token = linkIn(inbox[0]!.body, "reset")!;
    expect(token).toBeTruthy();

    await request(app.getHttpServer())
      .post("/v1/auth/password/reset")
      .send({ token, password: "N3wPassw0rd!x" }).expect(204);

    const oldPw = await request(app.getHttpServer())
      .post("/v1/auth/login").send({ email: address, password: "Str0ngPassw0rd!" });
    expect(oldPw.status).toBe(401);

    const newPw = await request(app.getHttpServer())
      .post("/v1/auth/login").send({ email: address, password: "N3wPassw0rd!x" });
    expect(newPw.status).toBe(200);
  }, 60_000);

  it("a reset token is single-use", async () => {
    inbox.length = 0;
    const address = `reset2-${Date.now()}@example.com`;
    await register(address);
    inbox.length = 0;
    await request(app.getHttpServer())
      .post("/v1/auth/password/forgot").send({ email: address }).expect(202);
    const token = linkIn(inbox[0]!.body, "reset")!;

    await request(app.getHttpServer())
      .post("/v1/auth/password/reset").send({ token, password: "N3wPassw0rd!x" }).expect(204);
    const again = await request(app.getHttpServer())
      .post("/v1/auth/password/reset").send({ token, password: "An0therPass!x" });
    expect(again.status).toBe(400);
  }, 60_000);

  it("forgot-password neither confirms nor denies that an account exists", async () => {
    inbox.length = 0;
    const unknown = await request(app.getHttpServer())
      .post("/v1/auth/password/forgot").send({ email: `nobody-${Date.now()}@example.com` });
    expect(unknown.status).toBe(202);
    expect(inbox).toHaveLength(0); // nothing sent, but the caller cannot tell

    const address = `known-${Date.now()}@example.com`;
    await register(address);
    inbox.length = 0;
    const known = await request(app.getHttpServer())
      .post("/v1/auth/password/forgot").send({ email: address });

    expect(known.status).toBe(unknown.status);
    expect(known.body).toEqual(unknown.body); // byte-identical responses
  }, 60_000);

  it("never puts a password or session token in an email body", async () => {
    inbox.length = 0;
    const address = `secrets-${Date.now()}@example.com`;
    await register(address);
    const body = inbox.map((m) => m.body).join("\n");
    expect(body).not.toContain("Str0ngPassw0rd!");
    expect(body).not.toMatch(/eyJ[A-Za-z0-9_-]{10,}/); // no JWT
    expect(body).not.toMatch(/refresh[_-]?token/i);
  }, 60_000);
});
