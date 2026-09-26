import { Pool } from "pg";
import { closeApp, http, registerUser, firstHospitalId, type Session } from "./helpers";

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
afterAll(async () => { await pool.end(); await closeApp(); });

const auth = (s: Session) => ["Authorization", s.auth] as const;
const contact = { firstName: "Aisha", lastName: "Uwaiz", phone: "4035550101", relationship: "partner", accompanies: true };
const nearFuture = (days: number) => new Date(Date.now() + days * 86400_000).toISOString().slice(0, 10);

async function staffSession(): Promise<Session> {
  const email = `rvstaff${Date.now()}${Math.floor(Math.random() * 1e6)}@medpilot.test`;
  const u = await registerUser({ email });
  await pool.query("update users set role = 'staff' where id = $1", [u.userId]);
  const res = await (await http()).post("/v1/auth/login").send({ email, password: "password123" }).expect(200);
  return { ...u, accessToken: res.body.tokens.accessToken, auth: `Bearer ${res.body.tokens.accessToken}` };
}

async function completedAppointment(s: Session): Promise<{ id: string; hospitalId: string }> {
  const hospitalId = await firstHospitalId(s);
  const created = await (await http()).post("/v1/appointments").set(...auth(s)).send({
    hospitalId, appointmentType: "general_checkup", requestedDate: nearFuture(30),
    underTreatment: false, emergencyContact: contact,
  }).expect(201);
  const staff = await staffSession();
  await (await http()).post(`/v1/staff/appointments/${created.body.id}/confirm`).set(...auth(staff)).send({}).expect(200);
  await pool.query("update appointment_requests set status = 'completed' where id = $1", [created.body.id]);
  return { id: created.body.id, hospitalId };
}

describe("reviews", () => {
  it("rates a completed hospital appointment and recomputes the hospital's rating", async () => {
    const s = await registerUser();
    const { id, hospitalId } = await completedAppointment(s);

    const res = await (await http()).post("/v1/reviews").set(...auth(s)).send({
      targetType: "hospital", requestId: id, rating: 5, comment: "Excellent care.",
    }).expect(201);
    expect(res.body).toMatchObject({ rating: 5 });

    const hospital = await (await http()).get(`/v1/hospitals/${hospitalId}`).set(...auth(s)).expect(200);
    expect(hospital.body.rating).toBe(5);

    const list = await (await http()).get("/v1/reviews").set(...auth(s)).query({ targetType: "hospital", targetId: hospitalId }).expect(200);
    expect(list.body).toMatchObject({ total: 1, average: 5 });
    expect(list.body.items[0]).toMatchObject({ rating: 5, comment: "Excellent care.", reviewer: "Test M." });

    const appt = await (await http()).get(`/v1/appointments/${id}`).set(...auth(s)).expect(200);
    expect(appt.body).toMatchObject({ canReview: true, reviewed: true });
  });

  it("averages multiple reviews for the same hospital", async () => {
    const a = await registerUser();
    const { id: id1, hospitalId } = await completedAppointment(a);
    await (await http()).post("/v1/reviews").set(...auth(a)).send({ targetType: "hospital", requestId: id1, rating: 4 }).expect(201);

    const b = await registerUser();
    const created = await (await http()).post("/v1/appointments").set(...auth(b)).send({
      hospitalId, appointmentType: "general_checkup", requestedDate: nearFuture(31),
      underTreatment: false, emergencyContact: contact,
    }).expect(201);
    const staff = await staffSession();
    await (await http()).post(`/v1/staff/appointments/${created.body.id}/confirm`).set(...auth(staff)).send({}).expect(200);
    await pool.query("update appointment_requests set status = 'completed' where id = $1", [created.body.id]);
    await (await http()).post("/v1/reviews").set(...auth(b)).send({ targetType: "hospital", requestId: created.body.id, rating: 2 }).expect(201);

    // Hospital seed data is shared across tests, so assert the aggregate matches the review list,
    // not a hardcoded value — other tests in this file may have already reviewed the same hospital.
    const list = await (await http()).get("/v1/reviews").set(...auth(b)).query({ targetType: "hospital", targetId: hospitalId }).expect(200);
    const ratings = list.body.items.map((r: { rating: number }) => r.rating);
    expect(ratings).toEqual(expect.arrayContaining([4, 2]));
    expect(list.body.total).toBe(ratings.length);
    const expected = Math.round((ratings.reduce((a: number, r: number) => a + r, 0) / ratings.length) * 10) / 10;
    expect(list.body.average).toBe(expected);
    const hospital = await (await http()).get(`/v1/hospitals/${hospitalId}`).set(...auth(b)).expect(200);
    expect(hospital.body.rating).toBe(expected);

    // The page size caps the items but never the total.
    const page = await (await http()).get("/v1/reviews").set(...auth(b)).query({ targetType: "hospital", targetId: hospitalId, limit: 1 }).expect(200);
    expect(page.body.items).toHaveLength(1);
    expect(page.body.total).toBe(ratings.length);
  });

  it("packages show their hospital's live rating, and hospital specialists carry none", async () => {
    const s = await registerUser();
    const { id, hospitalId } = await completedAppointment(s);
    await (await http()).post("/v1/reviews").set(...auth(s)).send({ targetType: "hospital", requestId: id, rating: 1 }).expect(201);

    const hospital = await (await http()).get(`/v1/hospitals/${hospitalId}`).set(...auth(s)).expect(200);
    const packages = await (await http()).get("/v1/packages").set(...auth(s)).expect(200);
    const mine = packages.body.filter((p: { hospital: { id: string } }) => p.hospital.id === hospitalId);
    for (const p of mine) expect(p.rating).toBe(hospital.body.rating);

    expect(hospital.body.specialists.length).toBeGreaterThan(0);
    for (const sp of hospital.body.specialists) expect(sp).not.toHaveProperty("rating");
  });

  it("blocks reviewing before the appointment is confirmed or completed", async () => {
    const s = await registerUser();
    const hospitalId = await firstHospitalId(s);
    const created = await (await http()).post("/v1/appointments").set(...auth(s)).send({
      hospitalId, appointmentType: "general_checkup", requestedDate: nearFuture(30),
      underTreatment: false, emergencyContact: contact,
    }).expect(201);
    const res = await (await http()).post("/v1/reviews").set(...auth(s)).send({ targetType: "hospital", requestId: created.body.id, rating: 5 });
    expect(res.status).toBe(409);
  });

  it("allows reviewing a confirmed appointment once its date has passed, without an explicit completion", async () => {
    const s = await registerUser();
    const hospitalId = await firstHospitalId(s);
    const created = await (await http()).post("/v1/appointments").set(...auth(s)).send({
      hospitalId, appointmentType: "general_checkup", requestedDate: nearFuture(30),
      underTreatment: false, emergencyContact: contact,
    }).expect(201);
    const staff = await staffSession();
    await (await http()).post(`/v1/staff/appointments/${created.body.id}/confirm`).set(...auth(staff)).send({}).expect(200);
    // The app compares against the UTC date, so set yesterday in UTC, not the DB server's local date.
    await pool.query("update appointment_requests set requested_date = $2 where id = $1", [created.body.id, nearFuture(-1)]);

    const res = await (await http()).post("/v1/reviews").set(...auth(s)).send({ targetType: "hospital", requestId: created.body.id, rating: 4 });
    expect(res.status).toBe(201);
  });

  it("won't let someone review a booking that isn't theirs", async () => {
    const owner = await registerUser();
    const { id } = await completedAppointment(owner);
    const stranger = await registerUser();
    const res = await (await http()).post("/v1/reviews").set(...auth(stranger)).send({ targetType: "hospital", requestId: id, rating: 5 });
    expect(res.status).toBe(404);
  });

  it("won't allow a second review of the same booking", async () => {
    const s = await registerUser();
    const { id } = await completedAppointment(s);
    await (await http()).post("/v1/reviews").set(...auth(s)).send({ targetType: "hospital", requestId: id, rating: 5 }).expect(201);
    const again = await (await http()).post("/v1/reviews").set(...auth(s)).send({ targetType: "hospital", requestId: id, rating: 3 });
    expect(again.status).toBe(409);
  });

  it("rejects a rating outside 1-5", async () => {
    const s = await registerUser();
    const { id } = await completedAppointment(s);
    for (const rating of [0, 6]) {
      const res = await (await http()).post("/v1/reviews").set(...auth(s)).send({ targetType: "hospital", requestId: id, rating });
      expect(res.status).toBe(422);
    }
  });

  it("rates a completed transport booking", async () => {
    const s = await registerUser();
    const providers = await (await http()).get("/v1/transport-providers").set(...auth(s)).expect(200);
    const provider = providers.body[0];
    const reference = await (await http()).get("/v1/reference").set(...auth(s)).expect(200);
    const created = await (await http()).post("/v1/transport-bookings").set(...auth(s)).send({
      providerId: provider.id, pickupDate: nearFuture(35), pickupCountry: "Canada", pickupRegion: "Alberta",
      pickupSiteType: "helipad", pickupSiteCode: "CYYC1",
      dropoffCountry: "United Arab Emirates", dropoffRegion: "Abu Dhabi", dropoffSiteType: "airport",
      purposeIds: [reference.body.transportPurposes[0].id], needIds: [reference.body.specialNeeds[0].id],
      emergencyContact: contact,
    }).expect(201);
    await pool.query("update transport_requests set status = 'completed' where id = $1", [created.body.id]);

    const res = await (await http()).post("/v1/reviews").set(...auth(s)).send({ targetType: "transport_provider", requestId: created.body.id, rating: 5 }).expect(201);
    expect(res.body.rating).toBe(5);
    const p = await (await http()).get(`/v1/transport-providers/${provider.id}`).set(...auth(s)).expect(200);
    expect(p.body.rating).toBe(5);
  });

  it("rates a completed pet-clinic visit", async () => {
    const s = await registerUser();
    const clinics = await (await http()).get("/v1/pet-clinics").set(...auth(s)).query({ category: "vet" }).expect(200);
    const clinic = clinics.body[0];
    const detail = await (await http()).get(`/v1/pet-clinics/${clinic.id}`).set(...auth(s)).expect(200);
    const svc = detail.body.services.find((x: { kind?: string }) => x.kind === "appointment");
    const created = await (await http()).post(`/v1/pet-clinics/${clinic.id}/requests`).set(...auth(s)).send({
      kind: "appointment", serviceId: svc.id, petName: "Biscuit", petType: "dog", preferredDate: nearFuture(10),
    }).expect(201);
    await pool.query("update service_requests set status = 'completed' where id = $1", [created.body.id]);

    const res = await (await http()).post("/v1/reviews").set(...auth(s)).send({ targetType: "pet_clinic", requestId: created.body.id, rating: 4 }).expect(201);
    expect(res.body.rating).toBe(4);
    const req = await (await http()).get(`/v1/service-requests/${created.body.id}`).set(...auth(s)).expect(200);
    expect(req.body).toMatchObject({ canReview: true, reviewed: true });
  });
});
