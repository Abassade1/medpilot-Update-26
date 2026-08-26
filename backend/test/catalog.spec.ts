import { closeApp, http, registerUser } from "./helpers";
afterAll(closeApp);

describe("catalog", () => {
  it("requires authentication", async () => {
    await (await http()).get("/v1/home").expect(401);
    await (await http()).get("/v1/hospitals").expect(401);
  });

  it("returns the home aggregate the frontend expects", async () => {
    const s = await registerUser();
    const res = await (await http()).get("/v1/home").set("Authorization", s.auth).expect(200);
    expect(res.body.heroSlides).toHaveLength(3);
    expect(res.body.services).toHaveLength(5);
    expect(res.body.packages).toHaveLength(3);
    expect(res.body.independentSpecialists).toHaveLength(3);
    expect(res.body.hospitals).toHaveLength(5);
    expect(res.body.services[0]).toHaveProperty("color");
    expect(res.body.services[0]).toHaveProperty("imageAsset");
  });

  it("searches hospitals across name, specialty and country", async () => {
    const s = await registerUser();
    const byName = await (await http()).get("/v1/hospitals?q=Burjeel").set("Authorization", s.auth).expect(200);
    expect(byName.body).toHaveLength(1);
    const bySpecialty = await (await http()).get("/v1/hospitals?q=Neurology").set("Authorization", s.auth).expect(200);
    expect(bySpecialty.body[0].name).toMatch(/Presbyterian/);
    const byCountry = await (await http()).get("/v1/hospitals?q=France").set("Authorization", s.auth).expect(200);
    expect(byCountry.body[0].name).toMatch(/ERN GUARD/);
    const none = await (await http()).get("/v1/hospitals?q=zzzznothing").set("Authorization", s.auth).expect(200);
    expect(none.body).toHaveLength(0); // empty state, not an error
  });

  it("returns hospital detail with specialists and their expertise", async () => {
    const s = await registerUser();
    const list = await (await http()).get("/v1/hospitals?q=Burjeel").set("Authorization", s.auth).expect(200);
    const detail = await (await http()).get(`/v1/hospitals/${list.body[0].id}`).set("Authorization", s.auth).expect(200);
    expect(detail.body.specialists).toHaveLength(3);
    expect(detail.body.careSystem).toBeTruthy();
    const sp = await (await http()).get(`/v1/specialists/${detail.body.specialists[0].id}`).set("Authorization", s.auth).expect(200);
    expect(Array.isArray(sp.body.expertise)).toBe(true);
    expect(sp.body.expertise.length).toBeGreaterThan(0);
  });

  it("returns package detail with the three tabs the UI renders", async () => {
    const s = await registerUser();
    const list = await (await http()).get("/v1/packages").set("Authorization", s.auth).expect(200);
    const detail = await (await http()).get(`/v1/packages/${list.body[0].id}`).set("Authorization", s.auth).expect(200);
    expect(detail.body.hospital).toBeTruthy();
    expect(detail.body.transportProvider).toBeTruthy();
    expect(detail.body.costSummary).toBeTruthy();
    expect(detail.body.packageInclude.length).toBeGreaterThan(0);
  });

  it("filters transport providers by category and exposes the fleet", async () => {
    const s = await registerUser();
    const jets = await (await http()).get("/v1/transport-providers?category=jet").set("Authorization", s.auth).expect(200);
    expect(jets.body.every((p: any) => p.category === "jet")).toBe(true);
    const detail = await (await http()).get(`/v1/transport-providers/${jets.body[0].id}`).set("Authorization", s.auth).expect(200);
    expect(detail.body.aircraft.length).toBeGreaterThan(0);
    expect(detail.body.aircraft[0].facilities.length).toBe(3);
  });

  it("rejects a malformed id and 404s an unknown one", async () => {
    const s = await registerUser();
    await (await http()).get("/v1/hospitals/not-a-uuid").set("Authorization", s.auth).expect(422);
    await (await http()).get("/v1/hospitals/00000000-0000-4000-8000-000000000000").set("Authorization", s.auth).expect(404);
  });

  it("serves reference lists used by the booking forms", async () => {
    const s = await registerUser();
    const res = await (await http()).get("/v1/reference").set("Authorization", s.auth).expect(200);
    expect(res.body.appointmentTypes).toHaveLength(3);
    expect(res.body.transportPurposes).toHaveLength(5);
    expect(res.body.specialNeeds).toHaveLength(5);
    expect(res.body.triageSymptoms).toHaveLength(4);
    expect(res.body.conditions).toHaveLength(6); // medical-history checklist
  });
});

describe("operational endpoints", () => {
  it("reports health including the database", async () => {
    const res = await (await http()).get("/healthz").expect(200);
    expect(res.body.status).toBe("ok");
    expect(res.body.database).toBe("ok");
  });

  it("publishes an OpenAPI document matching the implementation", async () => {
    const res = await (await http()).get("/docs.json").expect(200);
    expect(res.body.openapi).toBe("3.1.0");
    expect(Object.keys(res.body.paths).length).toBeGreaterThan(40);
    expect(res.body.paths["/v1/auth/register"].post).toBeTruthy();
    expect(res.body.paths["/v1/appointments"].post.security).toHaveLength(1);
  });

  it("returns a request id on every error for support correlation", async () => {
    const res = await (await http()).get("/v1/me").expect(401);
    expect(res.body.error.requestId).toBeTruthy();
    expect(res.body.error).not.toHaveProperty("stack");
  });
});
