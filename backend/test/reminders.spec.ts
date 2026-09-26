import { Pool } from "pg";
import { closeApp, firstHospitalId, http, registerUser, type Session } from "./helpers";

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
afterAll(async () => { await pool.end(); await closeApp(); });

const auth = (s: Session) => ["Authorization", s.auth] as const;
const contact = { firstName: "Aisha", lastName: "Uwaiz", phone: "4035550101", relationship: "partner", accompanies: true };
// The app works in UTC dates, so these must too.
const day = (n: number) => new Date(Date.now() + n * 86400_000).toISOString().slice(0, 10);

async function staffSession(): Promise<Session> {
  const email = `rmstaff${Date.now()}${Math.floor(Math.random() * 1e6)}@medpilot.test`;
  const u = await registerUser({ email });
  await pool.query("update users set role = 'staff' where id = $1", [u.userId]);
  const res = await (await http()).post("/v1/auth/login").send({ email, password: "password123" }).expect(200);
  return { ...u, accessToken: res.body.tokens.accessToken, auth: `Bearer ${res.body.tokens.accessToken}` };
}

/** A confirmed appointment moved to `date`, as if it had been booked for then. */
async function appointmentOn(s: Session, staff: Session, date: string, confirm = true): Promise<string> {
  const created = await (await http()).post("/v1/appointments").set(...auth(s)).send({
    hospitalId: await firstHospitalId(s), appointmentType: "general_checkup", requestedDate: day(30), requestedTime: "09:30",
    underTreatment: false, emergencyContact: contact,
  }).expect(201);
  if (confirm) await (await http()).post(`/v1/staff/appointments/${created.body.id}/confirm`).set(...auth(staff)).send({}).expect(200);
  await pool.query("update appointment_requests set requested_date = $2 where id = $1", [created.body.id, date]);
  return created.body.id;
}

const reminders = async (s: Session) =>
  ((await (await http()).get("/v1/notifications").set(...auth(s)).expect(200)).body.items as { type: string; body: string; data: { url?: string } | null }[])
    .filter((n) => n.type.endsWith(".reminder"));
const sweep = async (staff: Session) => (await http()).post("/v1/staff/reminder-sweep").set(...auth(staff)).expect(200);

describe("booking reminders", () => {
  it("reminds the member the day before a confirmed appointment, exactly once", async () => {
    const s = await registerUser();
    const staff = await staffSession();
    const id = await appointmentOn(s, staff, day(1));

    await sweep(staff);
    const [r] = await reminders(s);
    expect(r).toMatchObject({ type: "appointment.reminder", data: { url: `medpilot://appointments/${id}` } });
    expect(r!.body).toBe("Your appointment is tomorrow at 09:30. Tap for the details.");

    await sweep(staff);
    expect(await reminders(s)).toHaveLength(1);
  });

  it("skips bookings that aren't tomorrow or aren't confirmed", async () => {
    const s = await registerUser();
    const staff = await staffSession();
    await appointmentOn(s, staff, day(2));
    await appointmentOn(s, staff, day(1), false); // still pending
    const cancelled = await appointmentOn(s, staff, day(1));
    await (await http()).post(`/v1/appointments/${cancelled}/cancel`).set(...auth(s)).expect(200);

    await sweep(staff);
    expect(await reminders(s)).toHaveLength(0);
  });

  it("respects the member turning appointment reminders off", async () => {
    const s = await registerUser();
    const staff = await staffSession();
    await (await http()).patch("/v1/me/preferences").set(...auth(s)).send({ appointmentReminders: false }).expect(200);
    await appointmentOn(s, staff, day(1));
    await sweep(staff);
    expect(await reminders(s)).toHaveLength(0);
  });

  it("reminds again when a booking moves to a new date", async () => {
    const s = await registerUser();
    const staff = await staffSession();
    const id = await appointmentOn(s, staff, day(1));
    // A reminder already went out for an earlier date before the booking moved.
    await pool.query("insert into booking_reminders (request_type, request_id, for_date) values ('appointment', $1, $2)", [id, day(-3)]);
    await sweep(staff);
    expect(await reminders(s)).toHaveLength(1);
  });

  it("reminds for transport and pet-clinic bookings too", async () => {
    const s = await registerUser();
    const staff = await staffSession();

    const provider = (await (await http()).get("/v1/transport-providers").set(...auth(s)).expect(200)).body[0];
    const reference = (await (await http()).get("/v1/reference").set(...auth(s)).expect(200)).body;
    const t = await (await http()).post("/v1/transport-bookings").set(...auth(s)).send({
      providerId: provider.id, pickupDate: day(35), pickupTime: "07:15", pickupCountry: "Canada", pickupRegion: "Alberta",
      pickupSiteType: "helipad", dropoffCountry: "United Arab Emirates", dropoffSiteType: "airport",
      purposeIds: [reference.transportPurposes[0].id], needIds: [reference.specialNeeds[0].id], emergencyContact: contact,
    }).expect(201);
    await (await http()).post(`/v1/staff/transport/${t.body.id}/confirm`).set(...auth(staff)).send({}).expect(200);
    await pool.query("update transport_requests set pickup_date = $2 where id = $1", [t.body.id, day(1)]);

    const clinic = (await (await http()).get("/v1/pet-clinics").set(...auth(s)).query({ category: "vet" }).expect(200)).body[0];
    const svc = (await (await http()).get(`/v1/pet-clinics/${clinic.id}`).set(...auth(s)).expect(200)).body.services
      .find((x: { kind?: string }) => x.kind === "appointment");
    const r = await (await http()).post(`/v1/pet-clinics/${clinic.id}/requests`).set(...auth(s)).send({
      kind: "appointment", serviceId: svc.id, petName: "Biscuit", petType: "dog", preferredDate: day(10),
    }).expect(201);
    await (await http()).post(`/v1/staff/service-requests/${r.body.id}/confirm`).set(...auth(staff)).send({}).expect(200);
    await pool.query("update service_requests set preferred_date = $2 where id = $1", [r.body.id, day(1)]);

    await sweep(staff);
    const got = await reminders(s);
    expect(got.map((n) => n.type).sort()).toEqual(["service_request.reminder", "transport.reminder"]);
    expect(got.find((n) => n.type === "transport.reminder")!.body).toBe("Your transport pickup is tomorrow at 07:15. Tap for the details.");
  });

  it("is staff-only", async () => {
    const s = await registerUser();
    await (await http()).post("/v1/staff/reminder-sweep").set(...auth(s)).expect(403);
  });
});
