import { randomUUID } from "node:crypto";
import { Pool } from "pg";
import { closeApp, firstHospitalId, http, registerUser, type Session } from "./helpers";

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
afterAll(async () => { await pool.end(); await closeApp(); });

const auth = (s: Session) => ["Authorization", s.auth] as const;
const contact = { firstName: "Aisha", lastName: "Uwaiz", phone: "4035550101", relationship: "partner", accompanies: true };
const day = (n: number) => new Date(Date.now() + n * 86400_000).toISOString().slice(0, 10);

async function staffSession(): Promise<Session> {
  const email = `opstaff${Date.now()}${Math.floor(Math.random() * 1e6)}@medpilot.test`;
  const u = await registerUser({ email });
  await pool.query("update users set role = 'staff' where id = $1", [u.userId]);
  const res = await (await http()).post("/v1/auth/login").send({ email, password: "password123" }).expect(200);
  return { ...u, accessToken: res.body.tokens.accessToken, auth: `Bearer ${res.body.tokens.accessToken}` };
}
const list = async (staff: Session, status: "pending" | "confirmed") =>
  (await (await http()).get("/v1/staff/bookings").set(...auth(staff)).query({ status }).expect(200)).body.items as Record<string, unknown>[];

describe("staff operations list", () => {
  it("lists a pending appointment with who it's for, and never the clinical note", async () => {
    const s = await registerUser({ firstName: "Nadia", lastName: "Rahman" });
    const staff = await staffSession();
    const created = await (await http()).post("/v1/appointments").set(...auth(s)).send({
      hospitalId: await firstHospitalId(s), appointmentType: "general_checkup", requestedDate: day(30), requestedTime: "10:15",
      underTreatment: true, conditionNote: "Managed hypertension", emergencyContact: contact,
    }).expect(201);

    const mine = (await list(staff, "pending")).find((x) => x.id === created.body.id)!;
    expect(mine).toMatchObject({
      kind: "appointment", kindLabel: "Hospital appointment", reference: created.body.reference, status: "pending",
      target: created.body.hospital.name, member: "Nadia R.", date: day(30), time: "10:15", canDecide: true, canComplete: false,
    });
    expect(JSON.stringify(mine)).not.toContain("hypertension");
  });

  it("moves a booking to the confirmed list, completable only from its date", async () => {
    const s = await registerUser();
    const staff = await staffSession();
    const created = await (await http()).post("/v1/appointments").set(...auth(s)).send({
      hospitalId: await firstHospitalId(s), appointmentType: "general_checkup", requestedDate: day(30),
      underTreatment: false, emergencyContact: contact,
    }).expect(201);
    const id = created.body.id as string;
    await (await http()).post(`/v1/staff/appointments/${id}/confirm`).set(...auth(staff)).send({}).expect(200);

    expect((await list(staff, "pending")).some((x) => x.id === id)).toBe(false);
    expect((await list(staff, "confirmed")).find((x) => x.id === id)).toMatchObject({ canDecide: false, canComplete: false });

    await pool.query("update appointment_requests set requested_date = $2 where id = $1", [id, day(0)]);
    expect((await list(staff, "confirmed")).find((x) => x.id === id)).toMatchObject({ canComplete: true });
  });

  it("includes transport and pet-clinic requests with their own labels", async () => {
    const s = await registerUser();
    const staff = await staffSession();
    const provider = (await (await http()).get("/v1/transport-providers").set(...auth(s)).expect(200)).body[0];
    const reference = (await (await http()).get("/v1/reference").set(...auth(s)).expect(200)).body;
    const t = await (await http()).post("/v1/transport-bookings").set(...auth(s)).send({
      providerId: provider.id, pickupDate: day(35), pickupCountry: "Canada", pickupRegion: "Alberta",
      pickupSiteType: "helipad", dropoffCountry: "United Arab Emirates", dropoffSiteType: "airport",
      purposeIds: [reference.transportPurposes[0].id], needIds: [reference.specialNeeds[0].id], emergencyContact: contact,
    }).expect(201);
    const clinic = (await (await http()).get("/v1/pet-clinics").set(...auth(s)).query({ category: "vet" }).expect(200)).body[0];
    const svc = (await (await http()).get(`/v1/pet-clinics/${clinic.id}`).set(...auth(s)).expect(200)).body.services
      .find((x: { kind?: string }) => x.kind === "appointment");
    const r = await (await http()).post(`/v1/pet-clinics/${clinic.id}/requests`).set(...auth(s)).send({
      kind: "appointment", serviceId: svc.id, petName: "Biscuit", petType: "dog", preferredDate: day(10),
    }).expect(201);

    const pending = await list(staff, "pending");
    expect(pending.find((x) => x.id === t.body.id)).toMatchObject({ kind: "transport", kindLabel: "Medical transport", target: provider.name });
    expect(pending.find((x) => x.id === r.body.id)).toMatchObject({ kind: "service_request", kindLabel: "Pet clinic", target: clinic.name });
  });

  it("leaves marketplace bookings to their provider: not listed, and staff can't decide them", async () => {
    const s = await registerUser();
    const staff = await staffSession();
    const id = randomUUID();
    await pool.query(
      `insert into service_requests (id, reference, user_id, kind, target_type, target_id, preferred_date, status)
       values ($1, $2, $3, 'listing_booking', 'listing', $4, $5, 'pending')`,
      [id, `SRT-${Date.now()}`.slice(0, 20), s.userId, randomUUID(), day(5)],
    );
    expect((await list(staff, "pending")).some((x) => x.id === id)).toBe(false);
    await (await http()).post(`/v1/staff/service-requests/${id}/confirm`).set(...auth(staff)).send({}).expect(404);
  });

  it("is staff-only", async () => {
    const s = await registerUser();
    await (await http()).get("/v1/staff/bookings").set(...auth(s)).expect(403);
  });
});
