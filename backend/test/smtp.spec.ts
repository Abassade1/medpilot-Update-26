import { SMTPServer } from "smtp-server";
import type { AddressInfo } from "node:net";

/**
 * Drives the real SMTP driver against a real SMTP server listening on
 * localhost. Nothing here is mocked: nodemailer opens a socket, authenticates,
 * and the message is captured off the wire — so a broken transport, a bad
 * auth config or a malformed message fails this suite.
 */
describe("email over SMTP", () => {
  let server: SMTPServer;
  let port: number;
  const received: { to: string[]; raw: string; user?: string }[] = [];

  beforeAll(async () => {
    server = new SMTPServer({
      authOptional: false,
      disabledCommands: ["STARTTLS"], // plain socket for the test harness
      onAuth(auth, _session, cb) {
        if (auth.username === "medpilot" && auth.password === "test-password") {
          cb(null, { user: auth.username });
        } else {
          cb(new Error("Invalid username or password"));
        }
      },
      onData(stream, session, cb) {
        let raw = "";
        stream.on("data", (c) => { raw += c.toString(); });
        stream.on("end", () => {
          received.push({
            to: session.envelope.rcptTo.map((r) => r.address),
            raw,
            user: (session as unknown as { user?: string }).user,
          });
          cb();
        });
      },
    });
    await new Promise<void>((res) => server.listen(0, "127.0.0.1", res));
    port = (server.server.address() as AddressInfo).port;

    process.env.EMAIL_DRIVER = "smtp";
    process.env.SMTP_HOST = "127.0.0.1";
    process.env.SMTP_PORT = String(port);
    process.env.SMTP_SECURE = "false";
    process.env.SMTP_REQUIRE_TLS = "false";
    process.env.SMTP_ALLOW_INSECURE = "true";
    process.env.SMTP_USER = "medpilot";
    process.env.SMTP_PASSWORD = "test-password";
    process.env.EMAIL_FROM = "no-reply@medpilot.test";
    process.env.EMAIL_FROM_NAME = "MedPilot";
  });

  afterAll(async () => {
    await new Promise<void>((res) => server.close(() => res()));
  });

  /** Built after the env is set so the service picks up this suite's config. */
  async function freshService() {
    jest.resetModules();
    const { EmailService } = await import("../src/modules/email/email.service");
    return new EmailService();
  }

  it("connects and authenticates against the server", async () => {
    const email = await freshService();
    await expect(email.verifyTransport()).resolves.toBeUndefined();
  });

  it("delivers a verification message with its action link", async () => {
    const email = await freshService();
    received.length = 0;

    await email.send({
      to: "member@example.com",
      subject: "Verify your MedPilot email",
      text: "Tap the button below to verify your email address.",
      actionUrl: "https://app.medpilot.test/verify?token=vt_abc123",
      actionLabel: "Verify my email",
    });

    expect(received).toHaveLength(1);
    const msg = received[0]!;
    expect(msg.to).toEqual(["member@example.com"]);
    expect(msg.user).toBe("medpilot");
    expect(msg.raw).toContain("Verify your MedPilot email");
    expect(msg.raw).toContain("MedPilot");
    // The link must survive transport encoding in at least one of the two parts.
    const decoded = msg.raw.replace(/=\r?\n/g, "").replace(/=3D/g, "=");
    expect(decoded).toContain("https://app.medpilot.test/verify?token=vt_abc123");
    // Both a text and an HTML alternative are sent.
    expect(msg.raw).toMatch(/text\/plain/);
    expect(msg.raw).toMatch(/text\/html/);
  });

  it("escapes HTML so a crafted address cannot inject markup", async () => {
    const email = await freshService();
    received.length = 0;

    await email.send({
      to: "member@example.com",
      subject: "Reset your MedPilot password",
      text: `Hello <img src=x onerror="alert(1)">`,
      actionUrl: "https://app.medpilot.test/reset?token=pr_xyz",
    });

    const decoded = received[0]!.raw.replace(/=\r?\n/g, "").replace(/=3D/g, "=");
    // The plain-text alternative legitimately carries the raw characters; it is
    // the HTML part that must be escaped, so assert against that part alone.
    const htmlPart = decoded.slice(decoded.indexOf("text/html"));
    expect(htmlPart).toContain("&lt;img");
    expect(htmlPart).not.toContain(`<img src=x`);
  });

  it("surfaces an error when credentials are rejected", async () => {
    process.env.SMTP_PASSWORD = "wrong-password";
    const email = await freshService();
    await expect(
      email.send({ to: "member@example.com", subject: "nope", text: "nope" }),
    ).rejects.toThrow();
    process.env.SMTP_PASSWORD = "test-password";
  });

  it("fails clearly when the host is unset", async () => {
    process.env.SMTP_HOST = "";
    const email = await freshService();
    await expect(
      email.send({ to: "member@example.com", subject: "nope", text: "nope" }),
    ).rejects.toThrow(/SMTP_HOST/);
    process.env.SMTP_HOST = "127.0.0.1";
  });
});
