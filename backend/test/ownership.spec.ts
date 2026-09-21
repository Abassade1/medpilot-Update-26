import { closeApp, firstHospitalId, http, registerUser, type Session } from "./helpers";
afterAll(closeApp);

const day = (n: number) => new Date(Date.now() + n * 86400_000).toISOString().slice(0, 10);
const contact = { firstName: "A", lastName: "B", phone: "4035550101", relationship: "friend", accompanies: false };
const auth = (s: Session) => ["Authorization", s.auth] as const;

/** A member must never be able to read or change another member's bookings; the API answers 404, not 403. */
describe("cross-member access", () => {
  it("hides and protects another member's appointment", async () => {
    const owner = await registerUser();
    const other = await registerUser();
    const created = await (await http()).post("/v1/appointments").set(...auth(owner)).set("Idempotency-Key", `k-${Math.random()}`).send({
      hospitalId: await firstHospitalId(owner), appointmentType: "general_checkup", requestedDate: day(30),
      underTreatment: false, emergencyContact: contact,
    }).expect(201);
    const id = created.body.id;

    await (await http()).get(`/v1/appointments/${id}`).set(...auth(other)).expect(404);
    await (await http()).patch(`/v1/appointments/${id}`).set(...auth(other)).send({ requestedDate: day(40) }).expect(404);
    await (await http()).post(`/v1/appointments/${id}/cancel`).set(...auth(other)).expect(404);

    // Nothing changed for the owner.
    const still = await (await http()).get(`/v1/appointments/${id}`).set(...auth(owner)).expect(200);
    expect(still.body.status).toBe("pending");
    expect(still.body.requestedDate).toBe(day(30));
    const list = await (await http()).get("/v1/appointments").set(...auth(other)).expect(200);
    expect(list.body).toEqual([]);
  });

  it("hides and protects another member's pet or specialist request", async () => {
    const owner = await registerUser();
    const other = await registerUser();
    const clinics = (await (await http()).get("/v1/pet-clinics").set(...auth(owner)).expect(200)).body;
    const detail = (await (await http()).get(`/v1/pet-clinics/${clinics[0].id}`).set(...auth(owner)).expect(200)).body;
    const svc = detail.services.find((x: any) => (x.kind ?? "appointment") === "appointment");
    const created = await (await http()).post(`/v1/pet-clinics/${clinics[0].id}/requests`).set(...auth(owner))
      .set("Idempotency-Key", `k-${Math.random()}`)
      .send({ kind: "appointment", serviceId: svc.id, petName: "Rex", petType: "dog", preferredDate: day(10) }).expect(201);
    const id = created.body.id;

    await (await http()).get(`/v1/service-requests/${id}`).set(...auth(other)).expect(404);
    await (await http()).post(`/v1/service-requests/${id}/cancel`).set(...auth(other)).expect(404);
    const list = await (await http()).get("/v1/service-requests").set(...auth(other)).expect(200);
    expect(list.body).toEqual([]);
    const still = await (await http()).get(`/v1/service-requests/${id}`).set(...auth(owner)).expect(200);
    expect(still.body.status).toBe("pending");
  });

  it("only marks the caller's own notifications as read", async () => {
    const owner = await registerUser();
    const other = await registerUser();
    await (await http()).post("/v1/appointments").set(...auth(owner)).set("Idempotency-Key", `k-${Math.random()}`).send({
      hospitalId: await firstHospitalId(owner), appointmentType: "general_checkup", requestedDate: day(30),
      underTreatment: false, emergencyContact: contact,
    }).expect(201);
    const mine = (await (await http()).get("/v1/notifications").set(...auth(owner)).expect(200)).body;
    expect(mine.unreadCount).toBeGreaterThan(0);

    // Another member "reading" the owner's notification ids and "all" must not touch them.
    await (await http()).post("/v1/notifications/read").set(...auth(other)).send({ ids: mine.items.map((n: any) => n.id) }).expect(200);
    await (await http()).post("/v1/notifications/read").set(...auth(other)).send({ ids: "all" }).expect(200);
    const after = (await (await http()).get("/v1/notifications").set(...auth(owner)).expect(200)).body;
    expect(after.unreadCount).toBe(mine.unreadCount);
  });

  it("keeps emergency contacts and preferences private to their owner", async () => {
    const a = await registerUser();
    const b = await registerUser();
    await (await http()).put("/v1/me/emergency-contact").set(...auth(a)).send({ ...contact, firstName: "Alice" }).expect(200);
    await (await http()).patch("/v1/me/preferences").set(...auth(a)).send({ emailUpdates: false }).expect(200);
    const bContact = (await (await http()).get("/v1/me/emergency-contact").set(...auth(b)).expect(200)).body;
    expect(bContact.contact).toBeNull();
    const bPrefs = (await (await http()).get("/v1/me/preferences").set(...auth(b)).expect(200)).body;
    expect(bPrefs.emailUpdates).toBe(true);
  });

  it("refuses every one of these without a session", async () => {
    for (const [method, url] of [
      ["get", "/v1/appointments"], ["get", "/v1/service-requests"], ["get", "/v1/notifications"],
      ["get", "/v1/me/preferences"], ["get", "/v1/locations"], ["get", "/v1/aux/chat"],
    ] as const) {
      await (await http())[method](url).expect(401);
    }
  });
});
