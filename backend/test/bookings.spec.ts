import { closeApp, firstHospitalId, http, registerUser } from "./helpers";
afterAll(closeApp);

const contact = { firstName: "Aisha", lastName: "Uwaiz", phone: "4035550101", relationship: "partner", accompanies: true };

/** Dates must sit inside the 365-day booking window, so derive them from today. */
const nearFuture = (days: number) =>
  new Date(Date.now() + days * 86400_000).toISOString().slice(0, 10);

describe("appointment requests", () => {
  it("creates a pending request with a reference and writes an activity", async () => {
    const s = await registerUser();
    const hospitalId = await firstHospitalId(s);
    const res = await (await http()).post("/v1/appointments").set("Authorization", s.auth).send({
      hospitalId, appointmentType: "specialist_consultation", requestedDate: nearFuture(30),
      underTreatment: true, conditionNote: "Managed hypertension", emergencyContact: contact,
    }).expect(201);

    // status is server truth: a request, never an auto-confirmed booking (spec §04 J2)
    expect(res.body.status).toBe("pending");
    expect(res.body.reference).toMatch(/^#CA\d{2}-\d{4}-\d{3}$/);
    expect(res.body.contactPerson).toBeNull();

    const feed = await (await http()).get("/v1/activities").set("Authorization", s.auth).expect(200);
    expect(feed.body.items[0]).toMatchObject({ type: "appointment", status: "pending", day: "Today" });
  });

  it("requires a condition note when the member says they are under treatment", async () => {
    const s = await registerUser();
    const hospitalId = await firstHospitalId(s);
    const res = await (await http()).post("/v1/appointments").set("Authorization", s.auth).send({
      hospitalId, appointmentType: "surgery", requestedDate: nearFuture(30),
      underTreatment: true, emergencyContact: contact,
    }).expect(422);
    expect(res.body.error.fields.conditionNote).toBeTruthy();
  });

  it("rejects a date in the past and beyond a year", async () => {
    const s = await registerUser();
    const hospitalId = await firstHospitalId(s);
    for (const date of ["2020-01-01", "2099-01-01"]) {
      const res = await (await http()).post("/v1/appointments").set("Authorization", s.auth).send({
        hospitalId, appointmentType: "general_checkup", requestedDate: date,
        underTreatment: false, emergencyContact: contact,
      }).expect(422);
      expect(res.body.error.fields.requestedDate).toBeTruthy();
    }
  });

  it("404s an unknown hospital", async () => {
    const s = await registerUser();
    await (await http()).post("/v1/appointments").set("Authorization", s.auth).send({
      hospitalId: "00000000-0000-4000-8000-000000000000",
      appointmentType: "general_checkup", requestedDate: nearFuture(30),
      underTreatment: false, emergencyContact: contact,
    }).expect(404);
  });

  it("returns the original response for a replayed idempotency key", async () => {
    const s = await registerUser();
    const hospitalId = await firstHospitalId(s);
    const body = {
      hospitalId, appointmentType: "general_checkup", requestedDate: nearFuture(45),
      underTreatment: false, emergencyContact: contact,
    };
    const a = await (await http()).post("/v1/appointments").set("Authorization", s.auth)
      .set("Idempotency-Key", "form-1").send(body).expect(201);
    const b = await (await http()).post("/v1/appointments").set("Authorization", s.auth)
      .set("Idempotency-Key", "form-1").send(body).expect(201);
    expect(b.body.id).toBe(a.body.id);
    const list = await (await http()).get("/v1/appointments").set("Authorization", s.auth).expect(200);
    expect(list.body).toHaveLength(1); // no double-booking
  });

  it("allows cancelling while pending and blocks it afterwards", async () => {
    const s = await registerUser();
    const hospitalId = await firstHospitalId(s);
    const created = await (await http()).post("/v1/appointments").set("Authorization", s.auth).send({
      hospitalId, appointmentType: "general_checkup", requestedDate: nearFuture(120),
      underTreatment: false, emergencyContact: contact,
    }).expect(201);
    const cancelled = await (await http()).post(`/v1/appointments/${created.body.id}/cancel`)
      .set("Authorization", s.auth).expect(200);
    expect(cancelled.body.status).toBe("cancelled");
    const again = await (await http()).post(`/v1/appointments/${created.body.id}/cancel`)
      .set("Authorization", s.auth).expect(409);
    expect(again.body.error.code).toBe("conflict");
  });
});

describe("transport requests", () => {
  const base = async (s: Awaited<ReturnType<typeof registerUser>>) => {
    const providers = await (await http()).get("/v1/transport-providers").set("Authorization", s.auth).expect(200);
    const provider = providers.body[0];
    const detail = await (await http()).get(`/v1/transport-providers/${provider.id}`).set("Authorization", s.auth).expect(200);
    const reference = await (await http()).get("/v1/reference").set("Authorization", s.auth).expect(200);
    return { provider, aircraft: detail.body.aircraft, reference: reference.body };
  };

  it("creates a pending transport request with purposes and needs", async () => {
    const s = await registerUser();
    const { provider, aircraft, reference } = await base(s);
    const res = await (await http()).post("/v1/transport-bookings").set("Authorization", s.auth).send({
      providerId: provider.id, aircraftId: aircraft[0].id,
      pickupDate: nearFuture(35), pickupCountry: "Canada", pickupRegion: "Alberta",
      pickupSiteType: "helipad", pickupSiteCode: "CYYC1",
      dropoffCountry: "United Arab Emirates", dropoffRegion: "Abu Dhabi", dropoffSiteType: "airport",
      purposeIds: [reference.transportPurposes[0].id],
      needIds: [reference.specialNeeds[0].id],
      emergencyContact: contact,
    }).expect(201);
    expect(res.body.status).toBe("pending");
    expect(res.body.pickup.country).toBe("Canada");
  });

  it("refuses an aircraft that belongs to a different operator", async () => {
    const s = await registerUser();
    const providers = await (await http()).get("/v1/transport-providers").set("Authorization", s.auth).expect(200);
    const [p1, p2] = providers.body;
    const other = await (await http()).get(`/v1/transport-providers/${p2.id}`).set("Authorization", s.auth).expect(200);
    const reference = await (await http()).get("/v1/reference").set("Authorization", s.auth).expect(200);
    const res = await (await http()).post("/v1/transport-bookings").set("Authorization", s.auth).send({
      providerId: p1.id, aircraftId: other.body.aircraft[0].id,
      pickupDate: nearFuture(35), pickupCountry: "Canada", pickupSiteType: "airport",
      dropoffCountry: "Italy", dropoffSiteType: "airport",
      purposeIds: [reference.body.transportPurposes[0].id],
      needIds: [reference.body.specialNeeds[0].id],
      emergencyContact: contact,
    }).expect(422);
    expect(res.body.error.message).toMatch(/aircraft/i);
  });

  it("requires a purpose and a need, and a differing drop-off", async () => {
    const s = await registerUser();
    const { provider } = await base(s);
    const res = await (await http()).post("/v1/transport-bookings").set("Authorization", s.auth).send({
      providerId: provider.id, pickupDate: nearFuture(35),
      pickupCountry: "Canada", pickupSiteType: "airport",
      dropoffCountry: "Canada", dropoffSiteType: "airport",
      purposeIds: [], needIds: [], emergencyContact: contact,
    }).expect(422);
    expect(res.body.error.fields.purposeIds).toBeTruthy();
    expect(res.body.error.fields.needIds).toBeTruthy();
    expect(res.body.error.fields.dropoffCountry).toBeTruthy();
  });
});

describe("activity feed", () => {
  it("filters by type and paginates with an opaque cursor", async () => {
    const s = await registerUser();
    const hospitalId = await firstHospitalId(s);
    for (const d of [nearFuture(30), nearFuture(31), nearFuture(32)]) {
      await (await http()).post("/v1/appointments").set("Authorization", s.auth).send({
        hospitalId, appointmentType: "general_checkup", requestedDate: d,
        underTreatment: false, emergencyContact: contact,
      }).expect(201);
    }
    const page1 = await (await http()).get("/v1/activities?limit=2").set("Authorization", s.auth).expect(200);
    expect(page1.body.items).toHaveLength(2);
    expect(page1.body.nextCursor).toBeTruthy();
    const page2 = await (await http()).get(`/v1/activities?limit=2&cursor=${encodeURIComponent(page1.body.nextCursor)}`)
      .set("Authorization", s.auth).expect(200);
    const ids = new Set([...page1.body.items, ...page2.body.items].map((i: any) => i.id));
    expect(ids.size).toBe(3); // no overlap between pages

    const filtered = await (await http()).get("/v1/activities?type=meal").set("Authorization", s.auth).expect(200);
    expect(filtered.body.items).toHaveLength(0);
  });

  it("caps the page size at 50", async () => {
    const s = await registerUser();
    await (await http()).get("/v1/activities?limit=500").set("Authorization", s.auth).expect(422);
  });
});
