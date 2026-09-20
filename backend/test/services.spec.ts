import { closeApp, http, registerUser, type Session } from "./helpers";
afterAll(closeApp);

const day = (n: number) => new Date(Date.now() + n * 86400_000).toISOString().slice(0, 10);
type Clinic = { id: string; name: string; category: string };
type Svc = { id: string; name: string; kind?: string; priceLabel: string | null };

async function clinics(s: Session, category?: string): Promise<Clinic[]> {
  return (await (await http()).get("/v1/pet-clinics").set("Authorization", s.auth).query(category ? { category } : {}).expect(200)).body;
}
const clinicDetail = async (s: Session, id: string) =>
  (await (await http()).get(`/v1/pet-clinics/${id}`).set("Authorization", s.auth).expect(200)).body as
    { name: string; services: Svc[]; canBookAppointment: boolean; canRequestSitting: boolean };
const post = async (s: Session, url: string, body: object, key = `k-${Math.random()}`) =>
  (await http()).post(url).set("Authorization", s.auth).set("Idempotency-Key", key).send(body);

describe("pet clinics", () => {
  it("fills every tab: vet, pedicure and sitters all have providers", async () => {
    const s = await registerUser();
    for (const c of ["vet", "pedicure", "sitters"]) {
      const list = await clinics(s, c);
      expect(list.length).toBeGreaterThan(0);
      expect(list.every((x) => x.category === c)).toBe(true);
    }
  });

  it("shows the services a vendor has posted, with prices, dynamically", async () => {
    const s = await registerUser();
    const sitters = (await clinics(s, "sitters"))[0]!;
    const d = await clinicDetail(s, sitters.id);
    expect(d.services.length).toBeGreaterThan(0);
    expect(d.services.every((x) => x.priceLabel && x.priceLabel.startsWith("$"))).toBe(true);
    expect(d.canRequestSitting).toBe(true);
  });

  it("reports what each clinic can actually be asked for", async () => {
    const s = await registerUser();
    const vet = await clinicDetail(s, (await clinics(s, "vet"))[0]!.id);
    expect(vet.canBookAppointment).toBe(true);
  });

  it("404s for an unknown clinic", async () => {
    const s = await registerUser();
    await (await http()).get("/v1/pet-clinics/00000000-0000-4000-8000-000000000000").set("Authorization", s.auth).expect(404);
  });
});

describe("pet requests", () => {
  async function pick(s: Session, kind: "appointment" | "sitting") {
    const cat = kind === "sitting" ? "sitters" : "vet";
    const clinic = (await clinics(s, cat))[0]!;
    const svc = (await clinicDetail(s, clinic.id)).services.find((x) => x.kind === kind)!;
    return { clinic, svc };
  }

  it("books a pet appointment and returns a confirmation with a reference", async () => {
    const s = await registerUser();
    const { clinic, svc } = await pick(s, "appointment");
    const res = await post(s, `/v1/pet-clinics/${clinic.id}/requests`, {
      kind: "appointment", serviceId: svc.id, petName: "Biscuit", petType: "dog", preferredDate: day(10), preferredTime: "10:30",
    });
    expect(res.status).toBe(201);
    expect(res.body).toMatchObject({
      status: "pending", kind: "pet_appointment", canCancel: true,
      preferredDate: day(10), preferredTime: "10:30", details: { petName: "Biscuit", petType: "dog" },
    });
    expect(res.body.reference).toMatch(/^#SR\d{2}-\d{4}-\d{3}$/);
    expect(res.body.target.name).toBe(clinic.name);
    expect(res.body.service.name).toBe(svc.name);
  });

  it("requests pet sitting over a date range", async () => {
    const s = await registerUser();
    const { clinic, svc } = await pick(s, "sitting");
    const res = await post(s, `/v1/pet-clinics/${clinic.id}/requests`, {
      kind: "sitting", serviceId: svc.id, petName: "Miso", petType: "cat", preferredDate: day(20), endDate: day(25),
    });
    expect(res.status).toBe(201);
    expect(res.body).toMatchObject({ kind: "pet_sitting", preferredDate: day(20), endDate: day(25) });
  });

  it("defaults a sitting's end date to its start date", async () => {
    const s = await registerUser();
    const { clinic, svc } = await pick(s, "sitting");
    const res = await post(s, `/v1/pet-clinics/${clinic.id}/requests`, {
      kind: "sitting", serviceId: svc.id, petName: "Miso", petType: "cat", preferredDate: day(20),
    });
    expect(res.body.endDate).toBe(day(20));
  });

  it("shows up in the member's requests and their activity feed", async () => {
    const s = await registerUser();
    const { clinic, svc } = await pick(s, "appointment");
    const made = (await post(s, `/v1/pet-clinics/${clinic.id}/requests`, {
      kind: "appointment", serviceId: svc.id, petName: "Biscuit", petType: "dog", preferredDate: day(10),
    })).body;
    const list = (await (await http()).get("/v1/service-requests").set("Authorization", s.auth).expect(200)).body;
    expect(list.map((r: { id: string }) => r.id)).toContain(made.id);
    const feed = (await (await http()).get("/v1/activities").set("Authorization", s.auth).query({ type: "service" }).expect(200)).body.items;
    expect(feed.length).toBe(1);
    expect(feed[0]).toMatchObject({ type: "service", status: "pending" });
  });

  it("is idempotent: a retried submit does not create a second request", async () => {
    const s = await registerUser();
    const { clinic, svc } = await pick(s, "appointment");
    const body = { kind: "appointment", serviceId: svc.id, petName: "Biscuit", petType: "dog", preferredDate: day(10) };
    const a = await post(s, `/v1/pet-clinics/${clinic.id}/requests`, body, "same-key");
    const b = await post(s, `/v1/pet-clinics/${clinic.id}/requests`, body, "same-key");
    expect(b.body.id).toBe(a.body.id);
    expect((await (await http()).get("/v1/service-requests").set("Authorization", s.auth).expect(200)).body).toHaveLength(1);
  });

  it("rejects a service from a different clinic", async () => {
    const s = await registerUser();
    const [a, b] = await clinics(s, "vet");
    const foreign = (await clinicDetail(s, b!.id)).services[0]!;
    const res = await post(s, `/v1/pet-clinics/${a!.id}/requests`, {
      kind: "appointment", serviceId: foreign.id, petName: "Biscuit", petType: "dog", preferredDate: day(10),
    });
    expect(res.status).toBe(422);
    expect(res.body.error.fields.serviceId).toMatch(/isn't offered/);
  });

  it("rejects booking a sitting service as an appointment, and says which to use", async () => {
    const s = await registerUser();
    const { clinic, svc } = await pick(s, "sitting");
    const res = await post(s, `/v1/pet-clinics/${clinic.id}/requests`, {
      kind: "appointment", serviceId: svc.id, petName: "Biscuit", petType: "dog", preferredDate: day(10),
    });
    expect(res.status).toBe(422);
    expect(res.body.error.fields.serviceId).toMatch(/sitting/i);
  });

  it.each([
    ["missing pet name", { petName: "" }, "petName"],
    ["whitespace-only pet name", { petName: "   " }, "petName"],
    ["unknown pet type", { petType: "dragon" }, "petType"],
    ["past date", { preferredDate: "2020-01-01" }, "preferredDate"],
    ["today", { preferredDate: day(0) }, "preferredDate"],
    ["impossible date", { preferredDate: "2027-02-31" }, "preferredDate"],
    ["bad time", { preferredTime: "9:30" }, "preferredTime"],
    ["end before start", { kind: "sitting", preferredDate: day(20), endDate: day(15) }, "endDate"],
    ["sitting longer than the limit", { kind: "sitting", preferredDate: day(20), endDate: day(80) }, "endDate"],
    ["over-long message", { message: "x".repeat(501) }, "message"],
  ])("rejects %s", async (_label, over, field) => {
    const s = await registerUser();
    const { clinic, svc } = await pick(s, "appointment");
    const sit = await pick(s, "sitting");
    const isSitting = (over as { kind?: string }).kind === "sitting";
    const res = await post(s, `/v1/pet-clinics/${isSitting ? sit.clinic.id : clinic.id}/requests`, {
      kind: "appointment", serviceId: isSitting ? sit.svc.id : svc.id, petName: "Biscuit", petType: "dog", preferredDate: day(10), ...over,
    });
    expect(res.status).toBe(422);
    expect(res.body.error.fields[field]).toBeTruthy();
  });

  it("rejects an appointment given an end date", async () => {
    const s = await registerUser();
    const { clinic, svc } = await pick(s, "appointment");
    const res = await post(s, `/v1/pet-clinics/${clinic.id}/requests`, {
      kind: "appointment", serviceId: svc.id, petName: "B", petType: "dog", preferredDate: day(10), endDate: day(12),
    });
    expect(res.status).toBe(422);
  });

  it("requires authentication", async () => {
    await (await http()).post("/v1/pet-clinics/00000000-0000-4000-8000-000000000000/requests").send({}).expect(401);
  });
});

describe("independent specialists", () => {
  const list = async (s: Session, q: Record<string, string> = {}) =>
    (await (await http()).get("/v1/independent-specialists").set("Authorization", s.auth).query(q).expect(200)).body as
      { id: string; name: string; categoryTitle: string; acceptingRequests: boolean }[];

  it("lists specialists and narrows by category", async () => {
    const s = await registerUser();
    const cats = (await (await http()).get("/v1/independent-specialist-categories").set("Authorization", s.auth).expect(200)).body as { id: string; title: string }[];
    const nurses = cats.find((c) => c.title === "Private Nurses")!;
    const all = await list(s);
    const only = await list(s, { categoryId: nurses.id });
    expect(all.length).toBeGreaterThan(only.length);
    expect(only.length).toBeGreaterThan(0);
    expect(only.every((x) => x.categoryTitle === "Private Nurses")).toBe(true);
  });

  it("searches by name, role and place, ignoring case", async () => {
    const s = await registerUser();
    expect((await list(s, { q: "amara" })).map((x) => x.name)).toContain("Amara Okafor");
    expect((await list(s, { q: "CALGARY" })).length).toBeGreaterThan(0);
    expect(await list(s, { q: "zzzzzz-no-such-thing" })).toEqual([]);
  });

  it("treats % and _ in a search as plain characters, not wildcards", async () => {
    const s = await registerUser();
    expect(await list(s, { q: "%" })).toEqual([]);
  });

  it("returns a profile with bio, languages and services", async () => {
    const s = await registerUser();
    const amara = (await list(s, { q: "Amara" }))[0]!;
    const d = (await (await http()).get(`/v1/independent-specialists/${amara.id}`).set("Authorization", s.auth).expect(200)).body;
    expect(d.bio.length).toBeGreaterThan(20);
    expect(d.languages).toBeTruthy();
    expect(d.services.length).toBeGreaterThan(0);
    expect(d.availabilityLabel).toBeTruthy();
  });

  async function amara(s: Session) {
    const a = (await list(s, { q: "Amara" }))[0]!;
    const d = (await (await http()).get(`/v1/independent-specialists/${a.id}`).set("Authorization", s.auth).expect(200)).body;
    return { id: a.id as string, svc: d.services[0] as Svc };
  }

  it("books a specialist's service for a date", async () => {
    const s = await registerUser();
    const { id, svc } = await amara(s);
    const res = await post(s, `/v1/independent-specialists/${id}/requests`, { kind: "booking", serviceId: svc.id, preferredDate: day(14), preferredTime: "11:00" });
    expect(res.status).toBe(201);
    expect(res.body).toMatchObject({ kind: "specialist_booking", status: "pending", preferredDate: day(14), preferredTime: "11:00" });
    expect(res.body.target.name).toBe("Amara Okafor");
    expect(res.body.service.name).toBe(svc.name);
  });

  it("sends a connection request that is just a message", async () => {
    const s = await registerUser();
    const { id } = await amara(s);
    const res = await post(s, `/v1/independent-specialists/${id}/requests`, { kind: "connect", message: "I need help after my surgery." });
    expect(res.status).toBe(201);
    expect(res.body).toMatchObject({ kind: "specialist_connect", preferredDate: null, service: null, message: "I need help after my surgery." });
  });

  it("requires a service and a date to book, and a message to connect", async () => {
    const s = await registerUser();
    const { id } = await amara(s);
    const booking = await post(s, `/v1/independent-specialists/${id}/requests`, { kind: "booking" });
    expect(booking.status).toBe(422);
    expect(booking.body.error.fields).toMatchObject({ serviceId: expect.any(String), preferredDate: expect.any(String) });
    const connect = await post(s, `/v1/independent-specialists/${id}/requests`, { kind: "connect", message: "  " });
    expect(connect.status).toBe(422);
    expect(connect.body.error.fields.message).toMatch(/what you need/i);
  });

  it("rejects another specialist's service", async () => {
    const s = await registerUser();
    const a = await amara(s);
    const daniel = (await list(s, { q: "Daniel" }))[0]!;
    const res = await post(s, `/v1/independent-specialists/${daniel.id}/requests`, { kind: "booking", serviceId: a.svc.id, preferredDate: day(14) });
    expect(res.status).toBe(422);
    expect(res.body.error.fields.serviceId).toMatch(/isn't offered/);
  });

  it("refuses a specialist who isn't accepting requests", async () => {
    const s = await registerUser();
    const { id, svc } = await amara(s);
    const { Pool } = await import("pg");
    const pool = new Pool({ connectionString: process.env.DATABASE_URL });
    await pool.query("update independent_specialists set accepting_requests = false where id = $1", [id]);
    try {
      const res = await post(s, `/v1/independent-specialists/${id}/requests`, { kind: "booking", serviceId: svc.id, preferredDate: day(14) });
      expect(res.status).toBe(422);
      expect(res.body.error.message).toMatch(/isn't accepting/i);
    } finally {
      await pool.query("update independent_specialists set accepting_requests = true where id = $1", [id]);
      await pool.end();
    }
  });
});

describe("managing requests", () => {
  async function made(s: Session) {
    const clinic = (await clinics(s, "vet"))[0]!;
    const svc = (await clinicDetail(s, clinic.id)).services.find((x) => x.kind === "appointment")!;
    return (await post(s, `/v1/pet-clinics/${clinic.id}/requests`, {
      kind: "appointment", serviceId: svc.id, petName: "Biscuit", petType: "dog", preferredDate: day(10),
    })).body;
  }

  it("cancels a request, and can't cancel it twice", async () => {
    const s = await registerUser();
    const r = await made(s);
    const c = await (await http()).post(`/v1/service-requests/${r.id}/cancel`).set("Authorization", s.auth);
    expect(c.status).toBe(200);
    expect(c.body).toMatchObject({ status: "cancelled", canCancel: false });
    const again = await (await http()).post(`/v1/service-requests/${r.id}/cancel`).set("Authorization", s.auth);
    expect(again.status).toBe(409);
    expect(again.body.error.message).toMatch(/already been cancelled/i);
  });

  it("keeps a cancelled request in history", async () => {
    const s = await registerUser();
    const r = await made(s);
    await (await http()).post(`/v1/service-requests/${r.id}/cancel`).set("Authorization", s.auth).expect(200);
    const list = (await (await http()).get("/v1/service-requests").set("Authorization", s.auth).expect(200)).body;
    expect(list.find((x: { id: string }) => x.id === r.id)).toMatchObject({ status: "cancelled" });
  });

  it("hides one member's requests from another (404, not 403)", async () => {
    const owner = await registerUser();
    const other = await registerUser();
    const r = await made(owner);
    await (await http()).get(`/v1/service-requests/${r.id}`).set("Authorization", other.auth).expect(404);
    await (await http()).post(`/v1/service-requests/${r.id}/cancel`).set("Authorization", other.auth).expect(404);
    expect((await (await http()).get("/v1/service-requests").set("Authorization", other.auth).expect(200)).body).toEqual([]);
  });
});
