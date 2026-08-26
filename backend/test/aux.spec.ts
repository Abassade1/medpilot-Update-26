import { closeApp, http, jpegBytes, registerUser } from "./helpers";
afterAll(closeApp);

async function uploadMeal(auth: string) {
  const bytes = jpegBytes();
  const ticket = await (await http()).post("/v1/aux/meals/upload-url").set("Authorization", auth)
    .send({ mimeType: "image/jpeg", sizeBytes: bytes.length });
  if (ticket.status !== 201) return { ticket, fileId: null };
  const token = ticket.body.uploadUrl.split("/v1/uploads/")[1];
  await (await http()).put(`/v1/uploads/${token}`).set("Content-Type", "image/jpeg").send(bytes).expect(200);
  return { ticket, fileId: ticket.body.fileId as string };
}

describe("triage funnel", () => {
  it("walks symptom → condition → result with a disclaimer attached", async () => {
    const s = await registerUser();
    const step1 = await (await http()).post("/v1/aux/triage").set("Authorization", s.auth)
      .send({ symptomCode: "chest_pain" }).expect(200);
    expect(step1.body.step).toBe("conditions");
    expect(step1.body.conditions.length).toBeGreaterThan(0);

    const step2 = await (await http()).post("/v1/aux/triage").set("Authorization", s.auth)
      .send({ sessionId: step1.body.sessionId, conditionCode: "none" }).expect(200);
    expect(step2.body.step).toBe("result");
    expect(step2.body.result.title).toBe("Chest pain");
    // every AI output carries a server-attached disclaimer (spec §14)
    expect(step2.body.result.disclaimer).toMatch(/not a medical diagnosis/i);
    expect(step2.body.result.severity).toBeTruthy();
  });

  it("rejects an unknown symptom", async () => {
    const s = await registerUser();
    await (await http()).post("/v1/aux/triage").set("Authorization", s.auth)
      .send({ symptomCode: "not_a_symptom" }).expect(422);
  });

  it("will not let a member read another member's session", async () => {
    const a = await registerUser();
    const b = await registerUser();
    const step1 = await (await http()).post("/v1/aux/triage").set("Authorization", a.auth)
      .send({ symptomCode: "coughing" }).expect(200);
    await (await http()).post("/v1/aux/triage").set("Authorization", a.auth)
      .send({ sessionId: step1.body.sessionId, conditionCode: "none" }).expect(200);
    await (await http()).get(`/v1/aux/sessions/${step1.body.sessionId}`).set("Authorization", b.auth).expect(404);
  });

  it("translates a result and records an escalation", async () => {
    const s = await registerUser();
    const step1 = await (await http()).post("/v1/aux/triage").set("Authorization", s.auth)
      .send({ symptomCode: "chest_pain" }).expect(200);
    await (await http()).post("/v1/aux/triage").set("Authorization", s.auth)
      .send({ sessionId: step1.body.sessionId, conditionCode: "none" }).expect(200);

    const fr = await (await http()).post(`/v1/aux/sessions/${step1.body.sessionId}/translate`)
      .set("Authorization", s.auth).send({ locale: "fr" }).expect(200);
    expect(fr.body.title).toBe("Douleur thoracique");

    await (await http()).post(`/v1/aux/sessions/${step1.body.sessionId}/translate`)
      .set("Authorization", s.auth).send({ locale: "xx" }).expect(422);

    await (await http()).post(`/v1/aux/sessions/${step1.body.sessionId}/escalate`)
      .set("Authorization", s.auth).send({ kind: "evacuation" }).expect(202);
    const feed = await (await http()).get("/v1/activities?type=diagnosis").set("Authorization", s.auth).expect(200);
    expect(feed.body.items.some((i: any) => i.title === "Escalation requested")).toBe(true);
  });
});

describe("meal analysis and the free tier", () => {
  it("analyses an uploaded photo and returns segments summing to 100", async () => {
    const s = await registerUser();
    const { fileId } = await uploadMeal(s.auth);
    const queued = await (await http()).post("/v1/aux/meals").set("Authorization", s.auth)
      .send({ fileId }).expect(202);
    const result = await (await http()).get(`/v1/aux/meals/${queued.body.id}`).set("Authorization", s.auth).expect(200);
    expect(result.body.status).toBe("complete");
    expect(result.body.caloriesEstimate).toBe(250);
    const sum = result.body.segments.reduce((t: number, x: any) => t + x.percentage, 0);
    expect(sum).toBe(100); // guards the 130% defect found in the frontend mock
    expect(result.body.disclaimer).toBeTruthy();
  });

  it("blocks a second analysis on the free plan with 402", async () => {
    const s = await registerUser();
    const { fileId } = await uploadMeal(s.auth);
    await (await http()).post("/v1/aux/meals").set("Authorization", s.auth).send({ fileId }).expect(202);
    const blocked = await (await http()).post("/v1/aux/meals/upload-url").set("Authorization", s.auth)
      .send({ mimeType: "image/jpeg", sizeBytes: 400 }).expect(402);
    expect(blocked.body.error.code).toBe("quota_exceeded");
    expect(blocked.body.error.metric).toBe("meal_analysis");
  });

  it("lifts the cap after a verified Pro receipt", async () => {
    const s = await registerUser();
    const { fileId } = await uploadMeal(s.auth);
    await (await http()).post("/v1/aux/meals").set("Authorization", s.auth).send({ fileId }).expect(202);
    await (await http()).post("/v1/aux/meals/upload-url").set("Authorization", s.auth)
      .send({ mimeType: "image/jpeg", sizeBytes: 400 }).expect(402);

    const sub = await (await http()).post("/v1/me/subscription/verify").set("Authorization", s.auth)
      .send({ platform: "apple", receipt: "sandbox-receipt-abcdefgh", productId: "app.medpilot.pro.monthly" }).expect(200);
    expect(sub.body.planCode).toBe("pro");
    expect(sub.body.usage.mealAnalysis.limit).toBeNull();

    await (await http()).post("/v1/aux/meals/upload-url").set("Authorization", s.auth)
      .send({ mimeType: "image/jpeg", sizeBytes: 400 }).expect(201);
  });

  it("refuses an unverifiable receipt", async () => {
    const s = await registerUser();
    await (await http()).post("/v1/me/subscription/verify").set("Authorization", s.auth)
      .send({ platform: "apple", receipt: "x", productId: "p" }).expect(422);
  });
});
