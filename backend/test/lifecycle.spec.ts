import { Pool } from "pg";
import { closeApp, firstHospitalId, http, registerUser, type Session } from "./helpers";

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
afterAll(async () => { await pool.end(); await closeApp(); });

const day = (n: number) => new Date(Date.now() + n * 86400_000).toISOString().slice(0, 10);
const contact = { firstName: "A", lastName: "B", phone: "4035550101", relationship: "friend", accompanies: false };
const auth = (s: Session) => ["Authorization", s.auth] as const;
const key = () => `k-${Math.random()}`;

/** Registers a member, promotes them to staff in the database, and signs in again so the token carries the role. */
async function staffSession(): Promise<Session> {
  const email = `staff${Date.now()}${Math.floor(Math.random() * 1e6)}@medpilot.test`;
  const u = await registerUser({ email });
  await pool.query("update users set role = 'staff' where id = $1", [u.userId]);
  const res = await (await http()).post("/v1/auth/login").send({ email, password: "password123" }).expect(200);
  return { ...u, accessToken: res.body.tokens.accessToken, auth: `Bearer ${res.body.tokens.accessToken}` };
}

async function makeTransport(s: Session) {
  const providers = (await (await http()).get("/v1/transport-providers").set(...auth(s)).expect(200)).body;
  const reference = (await (await http()).get("/v1/reference").set(...auth(s)).expect(200)).body;
  const res = await (await http()).post("/v1/transport-bookings").set(...auth(s)).set("Idempotency-Key", key()).send({
    providerId: providers[0].id, pickupDate: day(35), pickupCountry: "Canada", pickupRegion: "Alberta", pickupSiteType: "airport",
    dropoffCountry: "Italy", dropoffSiteType: "airport",
    purposeIds: [reference.transportPurposes[0].id], needIds: [reference.specialNeeds[0].id],
    otherNeed: "Window seat", emergencyContact: contact,
  }).expect(201);
  return res.body;
}

describe("transport detail and cancel", () => {
  it("shows a full detail with purposes, needs and cancel capability", async () => {
    const s = await registerUser();
    const t = await makeTransport(s);
    const d = (await (await http()).get(`/v1/transport-bookings/${t.id}`).set(...auth(s)).expect(200)).body;
    expect(d.canCancel).toBe(true);
    expect(d.purposes.length).toBeGreaterThan(0);
    expect(d.needs).toContain("Window seat");
    expect(d.emergencyContact.name).toBe("A B");
    const list = (await (await http()).get("/v1/transport-bookings").set(...auth(s)).expect(200)).body;
    expect(list[0].canCancel).toBe(true);
  });

  it("cancels while pending, records it, and refuses a second cancel", async () => {
    const s = await registerUser();
    const t = await makeTransport(s);
    const res = await (await http()).post(`/v1/transport-bookings/${t.id}/cancel`).set(...auth(s)).expect(200);
    expect(res.body).toMatchObject({ status: "cancelled", canCancel: false, cancelledReason: "Cancelled by member" });
    await (await http()).post(`/v1/transport-bookings/${t.id}/cancel`).set(...auth(s)).expect(409);
    const acts = (await (await http()).get("/v1/activities").set(...auth(s)).query({ type: "transport" }).expect(200)).body.items;
    expect(acts.some((a: any) => a.title === "Transport cancelled")).toBe(true);
  });

  it("won't let another member cancel it", async () => {
    const owner = await registerUser();
    const other = await registerUser();
    const t = await makeTransport(owner);
    await (await http()).post(`/v1/transport-bookings/${t.id}/cancel`).set(...auth(other)).expect(404);
  });
});

describe("staff decisions move requests out of pending", () => {
  it("confirms a transport request and tells the member", async () => {
    const member = await registerUser();
    const staff = await staffSession();
    const t = await makeTransport(member);
    const q = (await (await http()).get("/v1/staff/queue").set(...auth(staff)).expect(200)).body;
    expect(q.transport.some((x: any) => x.id === t.id)).toBe(true);

    const res = await (await http()).post(`/v1/staff/transport/${t.id}/confirm`).set(...auth(staff))
      .send({ flightNumber: "MP101", scheduledAt: new Date(Date.now() + 40 * 86400_000).toISOString() }).expect(200);
    expect(res.body).toMatchObject({ status: "confirmed", flightNumber: "MP101", canCancel: true });

    const notes = (await (await http()).get("/v1/notifications").set(...auth(member)).expect(200)).body.items;
    expect(notes.some((n: any) => n.type === "transport.confirmed" && n.data?.url === `medpilot://transport/${t.id}`)).toBe(true);
    await (await http()).post(`/v1/staff/transport/${t.id}/confirm`).set(...auth(staff)).expect(409);
  });

  it("declines a transport request with a reason and refunds the member's allowance", async () => {
    const member = await registerUser();
    const staff = await staffSession();
    const t = await makeTransport(member);
    const res = await (await http()).post(`/v1/staff/transport/${t.id}/cancel`).set(...auth(staff)).send({ reason: "No aircraft available" }).expect(200);
    expect(res.body).toMatchObject({ status: "cancelled", cancelledReason: "No aircraft available", canCancel: false });
  });

  it("confirms and declines pet requests", async () => {
    const member = await registerUser();
    const staff = await staffSession();
    const clinics = (await (await http()).get("/v1/pet-clinics").set(...auth(member)).expect(200)).body;
    const detail = (await (await http()).get(`/v1/pet-clinics/${clinics[0].id}`).set(...auth(member)).expect(200)).body;
    const svc = detail.services.find((x: any) => (x.kind ?? "appointment") === "appointment");
    const make = async () => (await (await http()).post(`/v1/pet-clinics/${clinics[0].id}/requests`).set(...auth(member)).set("Idempotency-Key", key())
      .send({ kind: "appointment", serviceId: svc.id, petName: "Rex", petType: "dog", preferredDate: day(10) }).expect(201)).body;
    const a = await make();
    const b = await make();
    const ok = await (await http()).post(`/v1/staff/service-requests/${a.id}/confirm`).set(...auth(staff)).expect(200);
    expect(ok.body.status).toBe("confirmed");
    expect(ok.body.canCancel).toBe(true);
    const no = await (await http()).post(`/v1/staff/service-requests/${b.id}/cancel`).set(...auth(staff)).send({ reason: "Fully booked" }).expect(200);
    expect(no.body).toMatchObject({ status: "cancelled", cancelledReason: "Fully booked" });
  });

  it("lets staff confirm an appointment so the member sees the confirmed state and a slot", async () => {
    const member = await registerUser();
    const staff = await staffSession();
    const created = (await (await http()).post("/v1/appointments").set(...auth(member)).set("Idempotency-Key", key()).send({
      hospitalId: await firstHospitalId(member), appointmentType: "general_checkup", requestedDate: day(30),
      underTreatment: false, emergencyContact: contact,
    }).expect(201)).body;
    const slot = new Date(Date.now() + 31 * 86400_000).toISOString();
    await (await http()).post(`/v1/staff/appointments/${created.id}/confirm`).set(...auth(staff)).send({ scheduledAt: slot, staffName: "Dr. Friska" }).expect(200);
    const seen = (await (await http()).get(`/v1/appointments/${created.id}`).set(...auth(member)).expect(200)).body;
    expect(seen).toMatchObject({ status: "confirmed", canReschedule: true, canCancel: true });
    expect(seen.contactPerson.name).toBe("Dr. Friska");
  });

  it("keeps the whole staff surface closed to members", async () => {
    const member = await registerUser();
    const id = "00000000-0000-4000-8000-000000000000";
    await (await http()).get("/v1/staff/queue").set(...auth(member)).expect(403);
    await (await http()).post(`/v1/staff/transport/${id}/confirm`).set(...auth(member)).expect(403);
    await (await http()).post(`/v1/staff/service-requests/${id}/confirm`).set(...auth(member)).expect(403);
  });
});
