import request from "supertest";
import { getApp, registerUser, jpegBytes, closeApp } from "./helpers";


/**
 * Regression cover for the signed-upload-ticket leak: a ticket reached the
 * access log verbatim because it travelled in a URL *path*, where the
 * key-based redaction could not see it. These tests capture everything the
 * process writes to stdout/stderr while real requests run, and assert no
 * credential-shaped value survives.
 */
describe("log redaction", () => {
  let app: Awaited<ReturnType<typeof getApp>>;
  let captured: string[] = [];
  let restore: (() => void) | null = null;

  beforeAll(async () => {
    process.env.LOG_IN_TEST = "1"; // the logger is silent under test by default
    app = await getApp();
  }, 60_000);

  afterAll(async () => {
    delete process.env.LOG_IN_TEST;
    await closeApp();
  });

  beforeEach(() => {
    captured = [];
    const out = process.stdout.write.bind(process.stdout);
    const err = process.stderr.write.bind(process.stderr);
    const grab = (chunk: unknown) => { captured.push(String(chunk)); return true; };
    (process.stdout as { write: unknown }).write = grab;
    (process.stderr as { write: unknown }).write = grab;
    restore = () => {
      (process.stdout as { write: unknown }).write = out;
      (process.stderr as { write: unknown }).write = err;
    };
  });

  afterEach(() => { restore?.(); restore = null; });

  const logs = () => captured.join("\n");

  it("does not log the signed upload ticket during a real upload", async () => {
    const user = await registerUser();

    const ticket = await request(app.getHttpServer())
      .post("/v1/aux/meals/upload-url")
      .set("authorization", `Bearer ${user.accessToken}`)
      .send({ mimeType: "image/jpeg", sizeBytes: jpegBytes().length })
      .expect(201);

    const uploadUrl: string = ticket.body.uploadUrl;
    const token = uploadUrl.split("/v1/uploads/")[1]!;
    expect(token.length).toBeGreaterThan(40); // a real signed ticket

    await request(app.getHttpServer())
      .put(`/v1/uploads/${token}`)
      .set("content-type", "image/jpeg")
      .send(jpegBytes())
      .expect(200);

    const written = logs();
    expect(written).toContain("/v1/uploads/"); // the request was logged at all
    expect(written).not.toContain(token);
    expect(written).not.toContain(token.slice(0, 40));
  }, 60_000);

  it("does not log the access token presented on a request", async () => {
    const user = await registerUser();
    await request(app.getHttpServer())
      .get("/v1/me")
      .set("authorization", `Bearer ${user.accessToken}`)
      .expect(200);

    expect(logs()).not.toContain(user.accessToken);
  }, 60_000);

  it("does not log a signed download link", async () => {
    const user = await registerUser();
    const ticket = await request(app.getHttpServer())
      .post("/v1/me/records/upload-url")
      .set("authorization", `Bearer ${user.accessToken}`)
      .send({ fileName: "scan.jpg", mimeType: "image/jpeg", sizeBytes: jpegBytes().length })
      .expect(201);

    const token = (ticket.body.uploadUrl as string).split("/v1/uploads/")[1]!;
    await request(app.getHttpServer())
      .put(`/v1/uploads/${token}`)
      .set("content-type", "image/jpeg")
      .send(jpegBytes())
      .expect(200);

    await request(app.getHttpServer())
      .post("/v1/me/records")
      .set("authorization", `Bearer ${user.accessToken}`)
      .send({ fileId: ticket.body.fileId, displayName: "scan.jpg", source: "upload" })
      .expect(201);

    const list = await request(app.getHttpServer())
      .get("/v1/me/records")
      .set("authorization", `Bearer ${user.accessToken}`)
      .expect(200);

    const url: string | null = list.body[0]?.downloadUrl ?? null;
    if (url) {
      const dlToken = url.split("/v1/files/")[1]!;
      await request(app.getHttpServer()).get(`/v1/files/${dlToken}`).expect(200);
      expect(logs()).not.toContain(dlToken);
    }
  }, 60_000);

  it("does not log the password on a failed login", async () => {
    await request(app.getHttpServer())
      .post("/v1/auth/login")
      .send({ email: "nobody@example.com", password: "Sup3rSecretPassw0rd!" });

    expect(logs()).not.toContain("Sup3rSecretPassw0rd!");
  }, 60_000);

  it("scrubs credential-shaped values wherever they appear, not just in known keys", async () => {
    const { log, scrubValue } = await import("../src/common/logger");

    // The exact shape of a signed ticket: base64url JSON, a dot, then a MAC.
    const ticket =
      "eyJmIjoiMDFhMDNmNTQiLCJiIjoibWVkcGlsb3QtcGhpIn0.Zm9vYmFyYmF6cXV4c2lnbmF0dXJl";
    expect(scrubValue(`/v1/uploads/${ticket}`)).not.toContain(ticket);
    expect(scrubValue(`Bearer ${ticket}`)).not.toContain(ticket);
    expect(scrubValue("?token=vt_abcdefghijklmnopqrstuvwx")).toContain("[redacted]");
    expect(scrubValue("vt_abcdefghijklmnopqrstuvwxyz01")).toBe("[token]");
    expect(scrubValue("AKIAIOSFODNN7EXAMPLE")).toBe("[redacted]");

    // And through the logger itself, under an innocuous key name.
    log.info("probe", { somewhereUnexpected: `/v1/uploads/${ticket}` });
    expect(logs()).not.toContain(ticket);
  }, 60_000);

  it("still logs enough to operate: method, path, status, duration, request id", async () => {
    await request(app.getHttpServer()).get("/v1/plans").expect(200);
    const line = captured.map((c) => c.trim()).find((c) => c.includes('"msg":"request"'));
    expect(line).toBeTruthy();
    const entry = JSON.parse(line!);
    expect(entry).toMatchObject({ method: "GET", path: "/v1/plans", status: 200 });
    expect(typeof entry.ms).toBe("number");
    expect(entry.requestId).toBeTruthy();
  }, 60_000);
});
