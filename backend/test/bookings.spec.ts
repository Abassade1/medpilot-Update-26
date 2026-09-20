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

  it("refuses a pickup place we don't operate in, on the country field", async () => {
    const s = await registerUser();
    const { provider, reference } = await base(s);
    const res = await (await http()).post("/v1/transport-bookings").set("Authorization", s.auth).send({
      providerId: provider.id, pickupDate: nearFuture(35), pickupCountry: "Atlantis", pickupSiteType: "airport",
      dropoffCountry: "Canada", dropoffSiteType: "airport",
      purposeIds: [reference.transportPurposes[0].id], needIds: [reference.specialNeeds[0].id],
      emergencyContact: contact,
    }).expect(422);
    expect(res.body.error.fields.pickupCountry).toMatch(/operate/i);
  });

  it("refuses a provider that doesn't serve the pickup place", async () => {
    const s = await registerUser();
    const providers = (await (await http()).get("/v1/transport-providers").set("Authorization", s.auth).expect(200)).body;
    const reference = (await (await http()).get("/v1/reference").set("Authorization", s.auth).expect(200)).body;
    const countries = (await (await http()).get("/v1/locations").set("Authorization", s.auth).expect(200)).body as { id: string; name: string }[];
    // Find a (provider, country) pair with no coverage.
    let pair: { providerId: string; country: string } | null = null;
    for (const c of countries) {
      const av = (await (await http()).get(`/v1/transport/availability?locationId=${c.id}`).set("Authorization", s.auth).expect(200)).body;
      const served = new Set(av.services.flatMap((sv: any) => sv.providers.map((p: any) => p.id)));
      const missing = providers.find((p: any) => !served.has(p.id));
      if (missing) { pair = { providerId: missing.id, country: c.name }; break; }
    }
    expect(pair).not.toBeNull();
    const res = await (await http()).post("/v1/transport-bookings").set("Authorization", s.auth).send({
      providerId: pair!.providerId, pickupDate: nearFuture(35), pickupCountry: pair!.country, pickupSiteType: "airport",
      dropoffCountry: "Zzzland", dropoffSiteType: "airport",
      purposeIds: [reference.transportPurposes[0].id], needIds: [reference.specialNeeds[0].id],
      emergencyContact: contact,
    }).expect(422);
    expect(res.body.error.fields.pickupCountry).toMatch(/doesn't serve/i);
  });

  it("stores the pickup city and address", async () => {
    const s = await registerUser();
    const { provider, reference } = await base(s);
    const res = await (await http()).post("/v1/transport-bookings").set("Authorization", s.auth).send({
      providerId: provider.id, pickupDate: nearFuture(35), pickupCountry: "Canada", pickupRegion: "Ontario",
      pickupCity: "Toronto", pickupAddress: "123 Main Street", pickupSiteType: "helipad",
      dropoffCountry: "Italy", dropoffSiteType: "airport",
      purposeIds: [reference.transportPurposes[0].id], needIds: [reference.specialNeeds[0].id],
      emergencyContact: contact,
    });
    // Either the provider covers Toronto (201) or the API says so plainly; it must never 500.
    expect([201, 422]).toContain(res.status);
    if (res.status === 201) {
      expect(res.body.pickup.city).toBe("Toronto");
      expect(res.body.pickup.address).toBe("123 Main Street");
    }
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

/**
 * Date.parse rolls impossible dates forward (31 Feb -> 3 Mar) instead of
 * failing, which once let "2027-02-31" through validation and crashed the insert
 * with a 500. These must be clean 422s that name the problem.
 */
describe("impossible calendar dates", () => {
  const body = (hospitalId: string, requestedDate: string) => ({
    hospitalId, appointmentType: "general_checkup", requestedDate,
    underTreatment: false, emergencyContact: contact,
  });

  it.each(["2027-02-31", "2027-02-29", "2027-04-31", "2027-06-31", "2027-09-31"])(
    "rejects %s with a 422, not a 500",
    async (date) => {
      const s = await registerUser();
      const res = await (await http()).post("/v1/appointments").set("Authorization", s.auth)
        .set("Idempotency-Key", `bad-${date}-${Math.random()}`)
        .send(body(await firstHospitalId(s), date));
      expect(res.status).toBe(422);
      expect(res.body.error.fields.requestedDate).toMatch(/doesn't exist/i);
    },
  );

  it("rejects today, since a booking must be in the future", async () => {
    const s = await registerUser();
    const res = await (await http()).post("/v1/appointments").set("Authorization", s.auth)
      .set("Idempotency-Key", `today-${Math.random()}`)
      .send(body(await firstHospitalId(s), nearFuture(0)));
    expect(res.status).toBe(422);
  });

  it("tells a real leap day from a fake one, independent of today's date", async () => {
    const { CreateAppointmentBody } = await import("../src/modules/bookings/bookings.schemas");
    const doesntExist = (date: string) => {
      const r = CreateAppointmentBody.safeParse(body("00000000-0000-4000-8000-000000000000", date));
      return !r.success && r.error.issues.some((i) => /doesn't exist/i.test(i.message));
    };
    expect(doesntExist("2028-02-29")).toBe(false); // 2028 is a leap year
    expect(doesntExist("2027-02-29")).toBe(true);  // 2027 is not
    expect(doesntExist("2100-02-29")).toBe(true);  // divisible by 100, not by 400
    expect(doesntExist("2400-02-29")).toBe(false); // divisible by 400
  });
});
