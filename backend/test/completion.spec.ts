import { Pool } from "pg";
import { closeApp, http, registerUser, firstHospitalId, type Session } from "./helpers";

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
afterAll(async () => { await pool.end(); await closeApp(); });

const auth = (s: Session) => ["Authorization", s.auth] as const;
const contact = { firstName: "Aisha", lastName: "Uwaiz", phone: "4035550101", relationship: "partner", accompanies: true };
const day = (n: number) => new Date(Date.now() + n * 86400_000).toISOString().slice(0, 10);

async function staffSession(): Promise<Session> {
  const email = `cmstaff${Date.now()}${Math.floor(Math.random() * 1e6)}@medpilot.test`;
  const u = await registerUser({ email });
  await pool.query("update users set role = 'staff' where id = $1", [u.userId]);
  const res = await (await http()).post("/v1/auth/login").send({ email, password: "password123" }).expect(200);
  return { ...u, accessToken: res.body.tokens.accessToken, auth: `Bearer ${res.body.tokens.accessToken}` };
}

async function confirmedAppointment(s: Session, staff: Session): Promise<string> {
  const hospitalId = await firstHospitalId(s);
  const created = await (await http()).post("/v1/appointments").set(...auth(s)).send({
    hospitalId, appointmentType: "general_checkup", requestedDate: day(30), underTreatment: false, emergencyContact: contact,
  }).expect(201);
  await (await http()).post(`/v1/staff/appointments/${created.body.id}/confirm`).set(...auth(staff)).send({}).expect(200);
  return created.body.id;
}

describe("booking completion", () => {
  it("staff completes an appointment on its date, and the member is asked to rate it", async () => {
    const s = await registerUser();
    const staff = await staffSession();
    const id = await confirmedAppointment(s, staff);
    await pool.query("update appointment_requests set requested_date = $2 where id = $1", [id, day(0)]);

    await (await http()).post(`/v1/staff/appointments/${id}/complete`).set(...auth(staff)).expect(200);

    const appt = await (await http()).get(`/v1/appointments/${id}`).set(...auth(s)).expect(200);
    expect(appt.body).toMatchObject({ status: "completed", canReview: true, reviewed: false, canCancel: false });
    const inbox = await (await http()).get("/v1/notifications").set(...auth(s)).expect(200);
    expect(inbox.body.items[0]).toMatchObject({ type: "appointment.completed", data: { url: `medpilot://appointments/${id}` } });
    const feed = await (await http()).get("/v1/activities").set(...auth(s)).expect(200);
    expect(feed.body.items[0]).toMatchObject({ type: "appointment", status: "completed" });
  });

  it("refuses to complete before the date, or a booking that isn't confirmed", async () => {
    const s = await registerUser();
    const staff = await staffSession();
    const id = await confirmedAppointment(s, staff);
    const early = await (await http()).post(`/v1/staff/appointments/${id}/complete`).set(...auth(staff));
    expect(early.status).toBe(409);

    const hospitalId = await firstHospitalId(s);
    const pending = await (await http()).post("/v1/appointments").set(...auth(s)).send({
      hospitalId, appointmentType: "general_checkup", requestedDate: day(40), underTreatment: false, emergencyContact: contact,
    }).expect(201);
    await pool.query("update appointment_requests set requested_date = $2 where id = $1", [pending.body.id, day(-5)]);
    const notConfirmed = await (await http()).post(`/v1/staff/appointments/${pending.body.id}/complete`).set(...auth(staff));
    expect(notConfirmed.status).toBe(409);
  });

  it("is staff-only", async () => {
    const s = await registerUser();
    const staff = await staffSession();
    const id = await confirmedAppointment(s, staff);
    await (await http()).post(`/v1/staff/appointments/${id}/complete`).set(...auth(s)).expect(403);
    await (await http()).post("/v1/staff/completion-sweep").set(...auth(s)).expect(403);
  });

  it("the sweep completes confirmed bookings more than a day past, and nothing else", async () => {
    const s = await registerUser();
    const staff = await staffSession();
    const old = await confirmedAppointment(s, staff);
    const recent = await confirmedAppointment(s, staff);
    await pool.query("update appointment_requests set requested_date = $2 where id = $1", [old, day(-3)]);
    await pool.query("update appointment_requests set requested_date = $2 where id = $1", [recent, day(-1)]);

    const res = await (await http()).post("/v1/staff/completion-sweep").set(...auth(staff)).expect(200);
    expect(res.body.appointments).toBeGreaterThanOrEqual(1);

    const status = async (id: string) => (await (await http()).get(`/v1/appointments/${id}`).set(...auth(s)).expect(200)).body.status;
    expect(await status(old)).toBe("completed");
    expect(await status(recent)).toBe("confirmed");

    // Running it again is a no-op for rows it already completed.
    const again = await (await http()).post("/v1/staff/completion-sweep").set(...auth(staff)).expect(200);
    expect(again.body.appointments).toBe(0);
  });

  it("completes transport and pet-clinic bookings too", async () => {
    const s = await registerUser();
    const staff = await staffSession();

    const provider = (await (await http()).get("/v1/transport-providers").set(...auth(s)).expect(200)).body[0];
    const reference = (await (await http()).get("/v1/reference").set(...auth(s)).expect(200)).body;
    const t = await (await http()).post("/v1/transport-bookings").set(...auth(s)).send({
      providerId: provider.id, pickupDate: day(35), pickupCountry: "Canada", pickupRegion: "Alberta",
      pickupSiteType: "helipad", dropoffCountry: "United Arab Emirates", dropoffSiteType: "airport",
      purposeIds: [reference.transportPurposes[0].id], needIds: [reference.specialNeeds[0].id], emergencyContact: contact,
    }).expect(201);
    await (await http()).post(`/v1/staff/transport/${t.body.id}/confirm`).set(...auth(staff)).send({}).expect(200);
    await pool.query("update transport_requests set pickup_date = $2 where id = $1", [t.body.id, day(0)]);
    await (await http()).post(`/v1/staff/transport/${t.body.id}/complete`).set(...auth(staff)).expect(200);
    const td = await (await http()).get(`/v1/transport-bookings/${t.body.id}`).set(...auth(s)).expect(200);
    expect(td.body).toMatchObject({ status: "completed", canReview: true });

    const clinic = (await (await http()).get("/v1/pet-clinics").set(...auth(s)).query({ category: "vet" }).expect(200)).body[0];
    const svc = (await (await http()).get(`/v1/pet-clinics/${clinic.id}`).set(...auth(s)).expect(200)).body.services
      .find((x: { kind?: string }) => x.kind === "appointment");
    const r = await (await http()).post(`/v1/pet-clinics/${clinic.id}/requests`).set(...auth(s)).send({
      kind: "appointment", serviceId: svc.id, petName: "Biscuit", petType: "dog", preferredDate: day(10),
    }).expect(201);
    await (await http()).post(`/v1/staff/service-requests/${r.body.id}/confirm`).set(...auth(staff)).send({}).expect(200);
    await pool.query("update service_requests set preferred_date = $2 where id = $1", [r.body.id, day(-4)]);
    await (await http()).post("/v1/staff/completion-sweep").set(...auth(staff)).expect(200);
    const rd = await (await http()).get(`/v1/service-requests/${r.body.id}`).set(...auth(s)).expect(200);
    expect(rd.body).toMatchObject({ status: "completed", canReview: true });
  });
});
