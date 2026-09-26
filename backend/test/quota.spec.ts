import { Pool } from "pg";
import { closeApp, http, registerUser, type Session } from "./helpers";

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
afterAll(async () => { await pool.end(); await closeApp(); });

const auth = (s: Session) => ["Authorization", s.auth] as const;
const contact = { firstName: "Aisha", lastName: "Uwaiz", phone: "4035550101", relationship: "partner", accompanies: true };
const day = (n: number) => new Date(Date.now() + n * 86400_000).toISOString().slice(0, 10);

async function staffSession(): Promise<Session> {
  const email = `qstaff${Date.now()}${Math.floor(Math.random() * 1e6)}@medpilot.test`;
  const u = await registerUser({ email });
  await pool.query("update users set role = 'staff' where id = $1", [u.userId]);
  const res = await (await http()).post("/v1/auth/login").send({ email, password: "password123" }).expect(200);
  return { ...u, accessToken: res.body.tokens.accessToken, auth: `Bearer ${res.body.tokens.accessToken}` };
}

/** Free plan allows QUOTA_EVACUATION (default 2) transport requests a month. */
async function requestTransport(s: Session) {
  const provider = (await (await http()).get("/v1/transport-providers").set(...auth(s)).expect(200)).body[0];
  const reference = (await (await http()).get("/v1/reference").set(...auth(s)).expect(200)).body;
  return (await http()).post("/v1/transport-bookings").set(...auth(s)).send({
    providerId: provider.id, pickupDate: day(35), pickupCountry: "Canada", pickupRegion: "Alberta",
    pickupSiteType: "helipad", dropoffCountry: "United Arab Emirates", dropoffSiteType: "airport",
    purposeIds: [reference.transportPurposes[0].id], needIds: [reference.specialNeeds[0].id], emergencyContact: contact,
  });
}
const usedEvacuations = async (s: Session) =>
  (await (await http()).get("/v1/me/subscription").set(...auth(s)).expect(200)).body.usage.evacuation.used as number;

describe("free-plan booking limits", () => {
  it("counts transport requests and refuses the one over the monthly limit with 402", async () => {
    const s = await registerUser();
    expect((await requestTransport(s)).status).toBe(201);
    expect((await requestTransport(s)).status).toBe(201);
    expect(await usedEvacuations(s)).toBe(2);

    const over = await requestTransport(s);
    expect(over.status).toBe(402);
    expect(over.body.error.code).toBe("quota_exceeded");
    expect(await usedEvacuations(s)).toBe(2);
  });

  it("cancelling a booking gives the use back", async () => {
    const s = await registerUser();
    const first = await requestTransport(s);
    await requestTransport(s);
    await (await http()).post(`/v1/transport-bookings/${first.body.id}/cancel`).set(...auth(s)).expect(200);
    expect(await usedEvacuations(s)).toBe(1);
    expect((await requestTransport(s)).status).toBe(201);
  });

  it("a staff decline gives the use back", async () => {
    const s = await registerUser();
    const staff = await staffSession();
    const t = await requestTransport(s);
    await (await http()).post(`/v1/staff/transport/${t.body.id}/cancel`).set(...auth(staff)).send({}).expect(200);
    expect(await usedEvacuations(s)).toBe(0);
  });

  it("cancelling last month's booking doesn't free up a use this month", async () => {
    const s = await registerUser();
    const old = await requestTransport(s);
    await requestTransport(s);
    // Pretend the first request was made (and counted) last month.
    await pool.query("update transport_requests set created_at = created_at - interval '40 days' where id = $1", [old.body.id]);

    await (await http()).post(`/v1/transport-bookings/${old.body.id}/cancel`).set(...auth(s)).expect(200);
    expect(await usedEvacuations(s)).toBe(2);
    expect((await requestTransport(s)).status).toBe(402);
  });

  it("Pro members aren't metered", async () => {
    const s = await registerUser();
    await (await http()).post("/v1/me/subscription/verify").set(...auth(s))
      .send({ platform: "apple", receipt: `sandbox-receipt-quota-${Date.now()}`, productId: "pro.monthly" }).expect(200);
    for (let i = 0; i < 3; i++) expect((await requestTransport(s)).status).toBe(201);
  });
});
