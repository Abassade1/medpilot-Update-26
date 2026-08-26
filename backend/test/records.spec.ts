import { closeApp, conditionIds, http, jpegBytes, registerUser } from "./helpers";
afterAll(closeApp);

const pdf = (size = 200) => Buffer.concat([Buffer.from("%PDF-1.4\n"), Buffer.alloc(size - 9)]);

async function upload(auth: string, opts: { mimeType: string; bytes: Buffer; declaredSize?: number }) {
  const ticket = await (await http()).post("/v1/me/records/upload-url").set("Authorization", auth)
    .send({ fileName: "record", mimeType: opts.mimeType, sizeBytes: opts.declaredSize ?? opts.bytes.length });
  if (ticket.status !== 201) return { ticket, put: null };
  const token = ticket.body.uploadUrl.split("/v1/uploads/")[1];
  const put = await (await http()).put(`/v1/uploads/${token}`).set("Content-Type", opts.mimeType).send(opts.bytes);
  return { ticket, put };
}

describe("medical record upload", () => {
  it("accepts a valid PDF through the two-phase flow and lists it with a signed URL", async () => {
    const s = await registerUser();
    const { ticket, put } = await upload(s.auth, { mimeType: "application/pdf", bytes: pdf() });
    expect(put!.status).toBe(200);
    const rec = await (await http()).post("/v1/me/records").set("Authorization", s.auth)
      .send({ fileId: ticket.body.fileId, displayName: "clifford-record.pdf" }).expect(201);
    expect(rec.body.status).toBe("ready");

    const list = await (await http()).get("/v1/me/records").set("Authorization", s.auth).expect(200);
    expect(list.body).toHaveLength(1);
    expect(list.body[0].downloadUrl).toContain("/v1/files/");
    // storage internals must never leak to the client
    expect(JSON.stringify(list.body)).not.toContain("objectKey");
    expect(JSON.stringify(list.body)).not.toContain("medpilot-phi");
  });

  it("rejects an unsupported type before issuing a ticket", async () => {
    const s = await registerUser();
    const res = await (await http()).post("/v1/me/records/upload-url").set("Authorization", s.auth)
      .send({ fileName: "x.exe", mimeType: "application/x-msdownload", sizeBytes: 100 }).expect(422);
    expect(res.body.error.code).toBe("validation_failed");
  });

  it("rejects a file over the 10 MB limit", async () => {
    const s = await registerUser();
    const res = await (await http()).post("/v1/me/records/upload-url").set("Authorization", s.auth)
      .send({ fileName: "big.pdf", mimeType: "application/pdf", sizeBytes: 11 * 1024 * 1024 }).expect(413);
    expect(res.body.error.code).toBe("file_too_large");
  });

  it("rejects content whose magic bytes contradict the declared type", async () => {
    const s = await registerUser();
    const bogus = Buffer.from("this is definitely not a pdf file at all!!");
    const { put } = await upload(s.auth, { mimeType: "application/pdf", bytes: bogus });
    expect(put!.status).toBe(415);
    expect(put!.body.error.code).toBe("unsupported_type");
  });

  it("rejects a body whose length differs from the declaration", async () => {
    const s = await registerUser();
    const { put } = await upload(s.auth, { mimeType: "application/pdf", bytes: pdf(200), declaredSize: 999 });
    expect(put!.status).toBe(400);
  });

  it("will not attach a file that was never uploaded", async () => {
    const s = await registerUser();
    const ticket = await (await http()).post("/v1/me/records/upload-url").set("Authorization", s.auth)
      .send({ fileName: "ghost.pdf", mimeType: "application/pdf", sizeBytes: 200 }).expect(201);
    await (await http()).post("/v1/me/records").set("Authorization", s.auth)
      .send({ fileId: ticket.body.fileId, displayName: "ghost.pdf" }).expect(400);
  });

  it("enforces the 8-record ceiling", async () => {
    const s = await registerUser();
    for (let i = 0; i < 8; i++) {
      const { ticket } = await upload(s.auth, { mimeType: "image/jpeg", bytes: jpegBytes() });
      await (await http()).post("/v1/me/records").set("Authorization", s.auth)
        .send({ fileId: ticket.body.fileId, displayName: `scan-${i}.jpg` }).expect(201);
    }
    const res = await (await http()).post("/v1/me/records/upload-url").set("Authorization", s.auth)
      .send({ fileName: "ninth.pdf", mimeType: "application/pdf", sizeBytes: 200 }).expect(422);
    expect(res.body.error.message).toMatch(/up to 8/);
  });
});

describe("conditions and emergency contact", () => {
  it("replaces the condition set and flips historyComplete", async () => {
    const s = await registerUser();
    const ref = await (await http()).get("/v1/reference").set("Authorization", s.auth).expect(200);
    const conditions = await (await http()).get("/v1/me/conditions").set("Authorization", s.auth).expect(200);
    expect(conditions.body).toHaveLength(0);

    const all = await (await http()).put("/v1/me/conditions").set("Authorization", s.auth)
      .send({ conditionIds: [] }).expect(200);
    expect(all.body).toHaveLength(0);
    expect(ref.body.transportPurposes.length).toBeGreaterThan(0);

    const ids = await conditionIds(2);
    const saved = await (await http()).put("/v1/me/conditions").set("Authorization", s.auth)
      .send({ conditionIds: ids }).expect(200);
    expect(saved.body).toHaveLength(2);

    const status = await (await http()).get("/v1/me/setup-status").set("Authorization", s.auth).expect(200);
    expect(status.body.historyComplete).toBe(true);

    const replaced = await (await http()).put("/v1/me/conditions").set("Authorization", s.auth)
      .send({ conditionIds: [ids[0]] }).expect(200);
    expect(replaced.body).toHaveLength(1); // replace, not append
  });

  it("rejects an unknown condition id", async () => {
    const s = await registerUser();
    await (await http()).put("/v1/me/conditions").set("Authorization", s.auth)
      .send({ conditionIds: ["00000000-0000-4000-8000-000000000000"] }).expect(422);
  });

  it("upserts a single emergency contact", async () => {
    const s = await registerUser();
    expect((await (await http()).get("/v1/me/emergency-contact").set("Authorization", s.auth).expect(200)).body.contact).toBeNull();
    await (await http()).put("/v1/me/emergency-contact").set("Authorization", s.auth)
      .send({ firstName: "Aisha", lastName: "Uwaiz", phone: "4035550101", relationship: "partner" }).expect(200);
    const updated = await (await http()).put("/v1/me/emergency-contact").set("Authorization", s.auth)
      .send({ firstName: "Sara", lastName: "Uwaiz", phone: "4035550102", relationship: "sibling" }).expect(200);
    expect(updated.body.contact.firstName).toBe("Sara");
  });
});

describe("biometric binding", () => {
  it("requires a registered device", async () => {
    const s = await registerUser();
    await (await http()).post("/v1/me/devices/biometric").set("Authorization", s.auth)
      .send({ installId: "unknown-install-id", enabled: true }).expect(404);
  });

  it("binds biometrics to a registered device", async () => {
    const s = await registerUser();
    await (await http()).post("/v1/me/devices").set("Authorization", s.auth)
      .send({ platform: "ios", installId: "install-abc-12345", pushToken: "ExponentPushToken[x]" }).expect(201);
    const res = await (await http()).post("/v1/me/devices/biometric").set("Authorization", s.auth)
      .send({ installId: "install-abc-12345", enabled: true }).expect(201);
    expect(res.body.enabled).toBe(true);
  });
});
