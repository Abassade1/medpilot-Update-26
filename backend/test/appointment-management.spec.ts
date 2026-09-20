import { Pool } from "pg";
import { closeApp, firstHospitalId, http, registerUser, type Session } from "./helpers";

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
afterAll(async () => { await pool.end(); await closeApp(); });

const contact = { firstName: "Aisha", lastName: "Uwaiz", phone: "4035550101", relationship: "partner", accompanies: true };
const day = (n: number) => new Date(Date.now() + n * 86400_000).toISOString().slice(0, 10);

async function book(s: Session, over: Record<string, unknown> = {}) {
  return (await (await http()).post("/v1/appointments").set("Authorization", s.auth)
    .set("Idempotency-Key", `k-${Math.random()}`)
    .send({
      hospitalId: await firstHospitalId(s), appointmentType: "general_checkup", requestedDate: day(30),
      requestedTime: "09:30", underTreatment: true, conditionNote: "Hypertension", emergencyContact: contact, ...over,
    }).expect(201)).body;
}
const patch = async (s: Session, id: string, body: object) =>
  (await http()).patch(`/v1/appointments/${id}`).set("Authorization", s.auth).send(body);
/** Test-only: moves a row to a status the member API can't reach on its own. */
const setStatus = async (id: string, status: "confirmed" | "completed" | "cancelled") => {
  if (status === "confirmed") {
    await pool.query(
      "update appointment_requests set status = 'confirmed', scheduled_at = now() + interval '10 days' where id = $1", [id]);
  } else {
    await pool.query(
      `update appointment_requests set status = '${status}', scheduled_at = null where id = $1`, [id]);
  }
};

describe("appointment detail", () => {
  it("returns everything the detail screen shows, and what the member may do", async () => {
    const s = await registerUser();
    const a = await book(s);
    const got = (await (await http()).get(`/v1/appointments/${a.id}`).set("Authorization", s.auth).expect(200)).body;
    expect(got).toMatchObject({
      status: "pending", requestedTime: "09:30", underTreatment: true, conditionNote: "Hypertension",
      canReschedule: true, canCancel: true,
      emergencyContact: { name: "Aisha Uwaiz", relationship: "partner", accompanies: true },
    });
    expect(got.hospital.name).toBeTruthy();
  });

  it("stores the requested time as given and accepts none", async () => {
    const s = await registerUser();
    expect((await book(s, { requestedTime: null })).requestedTime).toBeNull();
    expect((await book(s, { requestedTime: "00:00" })).requestedTime).toBe("00:00");
    expect((await book(s, { requestedTime: "23:59" })).requestedTime).toBe("23:59");
  });

  it.each(["9:30", "24:00", "09:60", "9.30", "noon", "09:30:00"])("rejects the invalid time %s", async (t) => {
    const s = await registerUser();
    const res = await (await http()).post("/v1/appointments").set("Authorization", s.auth)
      .set("Idempotency-Key", `k-${Math.random()}`)
      .send({ hospitalId: await firstHospitalId(s), appointmentType: "general_checkup", requestedDate: day(30),
        requestedTime: t, underTreatment: false, emergencyContact: contact });
    expect(res.status).toBe(422);
    expect(res.body.error.fields.requestedTime).toBeTruthy();
  });
});

describe("rescheduling", () => {
  it("changes the date and time of a pending appointment", async () => {
    const s = await registerUser();
    const a = await book(s);
    const res = await patch(s, a.id, { requestedDate: day(45), requestedTime: "14:00" });
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ requestedDate: day(45), requestedTime: "14:00", status: "pending" });
  });

  it("persists: the change is what a fresh read returns", async () => {
    const s = await registerUser();
    const a = await book(s);
    await patch(s, a.id, { requestedDate: day(60), appointmentType: "surgery" });
    const got = (await (await http()).get(`/v1/appointments/${a.id}`).set("Authorization", s.auth).expect(200)).body;
    expect(got).toMatchObject({ requestedDate: day(60), appointmentType: "surgery", appointmentTypeLabel: "Surgery" });
    const list = (await (await http()).get("/v1/appointments").set("Authorization", s.auth).expect(200)).body;
    expect(list.find((x: { id: string }) => x.id === a.id).requestedDate).toBe(day(60));
  });

  it("can clear the preferred time with null, and leaves it alone when omitted", async () => {
    const s = await registerUser();
    const a = await book(s);
    expect((await patch(s, a.id, { requestedDate: day(50) })).body.requestedTime).toBe("09:30"); // untouched
    expect((await patch(s, a.id, { requestedTime: null })).body.requestedTime).toBeNull();
  });

  it("sends a confirmed appointment back for re-confirmation and releases the old slot", async () => {
    const s = await registerUser();
    const a = await book(s);
    await setStatus(a.id, "confirmed");
    const confirmed = (await (await http()).get(`/v1/appointments/${a.id}`).set("Authorization", s.auth).expect(200)).body;
    expect(confirmed.status).toBe("confirmed");
    expect(confirmed.scheduledAt).toBeTruthy();

    const moved = await patch(s, a.id, { requestedDate: day(70) });
    expect(moved.status).toBe(200);
    expect(moved.body.status).toBe("pending");
    expect(moved.body.scheduledAt).toBeNull();
  });

  it("is idempotent: repeating the same change adds no activity", async () => {
    const s = await registerUser();
    const a = await book(s);
    await patch(s, a.id, { requestedDate: day(40) }).then((r) => expect(r.status).toBe(200));
    const before = (await (await http()).get("/v1/activities").set("Authorization", s.auth).expect(200)).body.items.length;
    await patch(s, a.id, { requestedDate: day(40) }).then((r) => expect(r.status).toBe(200));
    const after = (await (await http()).get("/v1/activities").set("Authorization", s.auth).expect(200)).body.items.length;
    expect(after).toBe(before);
  });

  it("validates the new date with the same rules as booking", async () => {
    const s = await registerUser();
    const a = await book(s);
    for (const [date, why] of [[day(0), "today"], [day(-3), "past"], [day(400), "beyond a year"], ["2027-02-31", "impossible"]] as const) {
      const res = await patch(s, a.id, { requestedDate: date });
      expect([422]).toContain(res.status);
      expect(res.body.error.fields.requestedDate).toBeTruthy();
      void why;
    }
    // …and nothing changed
    expect((await (await http()).get(`/v1/appointments/${a.id}`).set("Authorization", s.auth).expect(200)).body.requestedDate).toBe(day(30));
  });

  it("rejects an empty update", async () => {
    const s = await registerUser();
    const a = await book(s);
    expect((await patch(s, a.id, {})).status).toBe(422);
  });

  it.each(["cancelled", "completed"] as const)("refuses to change a %s appointment", async (status) => {
    const s = await registerUser();
    const a = await book(s);
    await setStatus(a.id, status);
    const res = await patch(s, a.id, { requestedDate: day(50) });
    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe("conflict");
    const got = (await (await http()).get(`/v1/appointments/${a.id}`).set("Authorization", s.auth).expect(200)).body;
    expect(got.canReschedule).toBe(false);
    expect(got.canCancel).toBe(false);
  });

  it("does not let one member change another's appointment", async () => {
    const owner = await registerUser();
    const other = await registerUser();
    const a = await book(owner);
    expect((await patch(other, a.id, { requestedDate: day(50) })).status).toBe(404); // not 403: don't confirm it exists
    expect((await (await http()).get(`/v1/appointments/${a.id}`).set("Authorization", owner.auth).expect(200)).body.requestedDate).toBe(day(30));
  });

  it("requires authentication", async () => {
    await (await http()).patch("/v1/appointments/00000000-0000-4000-8000-000000000000").send({ requestedDate: day(50) }).expect(401);
  });
});

describe("cancelling", () => {
  it("lets a member cancel a confirmed appointment, not just a pending one", async () => {
    const s = await registerUser();
    const a = await book(s);
    await setStatus(a.id, "confirmed");
    const res = await (await http()).post(`/v1/appointments/${a.id}/cancel`).set("Authorization", s.auth);
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ status: "cancelled", canCancel: false, canReschedule: false });
  });

  it("refuses to cancel twice, and says why", async () => {
    const s = await registerUser();
    const a = await book(s);
    await (await http()).post(`/v1/appointments/${a.id}/cancel`).set("Authorization", s.auth).expect(200);
    const again = await (await http()).post(`/v1/appointments/${a.id}/cancel`).set("Authorization", s.auth);
    expect(again.status).toBe(409);
    expect(again.body.error.message).toMatch(/already been cancelled/i);
  });

  it("refuses to cancel a completed appointment", async () => {
    const s = await registerUser();
    const a = await book(s);
    await setStatus(a.id, "completed");
    const res = await (await http()).post(`/v1/appointments/${a.id}/cancel`).set("Authorization", s.auth);
    expect(res.status).toBe(409);
    expect(res.body.error.message).toMatch(/completed/i);
  });

  it("keeps a cancelled appointment in history without letting it act as active", async () => {
    const s = await registerUser();
    const a = await book(s);
    await (await http()).post(`/v1/appointments/${a.id}/cancel`).set("Authorization", s.auth).expect(200);
    const list = (await (await http()).get("/v1/appointments").set("Authorization", s.auth).expect(200)).body;
    const row = list.find((x: { id: string }) => x.id === a.id);
    expect(row).toMatchObject({ status: "cancelled", canCancel: false });
  });
});
