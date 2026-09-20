import { Pool } from "pg";
import { closeApp, firstHospitalId, http, registerUser, type Session } from "./helpers";

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
afterAll(async () => { await pool.end(); await closeApp(); });

const day = (n: number) => new Date(Date.now() + n * 86400_000).toISOString().slice(0, 10);
const contact = { firstName: "A", lastName: "B", phone: "4035550101", relationship: "friend", accompanies: false };
const me = async (s: Session) => (await (await http()).get("/v1/me").set("Authorization", s.auth).expect(200)).body;
const patch = async (s: Session, url: string, body: object) =>
  (await http()).patch(url).set("Authorization", s.auth).send(body);

describe("profile", () => {
  it("updates the name, phone and personal details, and they persist", async () => {
    const s = await registerUser();
    const res = await patch(s, "/v1/me/profile", { firstName: "Grace", lastName: "Hopper", phone: "4165550199", gender: "female", maritalStatus: "married" });
    expect(res.status).toBe(200);
    const got = await me(s);
    expect(got.profile).toMatchObject({ firstName: "Grace", lastName: "Hopper", fullName: "Grace Hopper", gender: "female", maritalStatus: "married" });
    expect(got.profile.phone).toContain("4165550199");
  });

  it("updates only what was sent", async () => {
    const s = await registerUser();
    const before = (await me(s)).profile;
    await patch(s, "/v1/me/profile", { firstName: "Renamed" }).then((r) => expect(r.status).toBe(200));
    const after = (await me(s)).profile;
    expect(after.firstName).toBe("Renamed");
    expect(after.lastName).toBe(before.lastName);
    expect(after.phone).toBe(before.phone);
  });

  it.each([
    ["an empty first name", { firstName: "" }, "firstName"],
    ["a whitespace last name", { lastName: "   " }, "lastName"],
    ["a name with digits", { firstName: "R2D2" }, "firstName"],
    ["a name that is too long", { firstName: "A".repeat(41) }, "firstName"],
    ["a phone with letters", { phone: "abc" }, "phone"],
    ["a too-short phone", { phone: "123" }, "phone"],
    ["an unknown gender", { gender: "robot" }, "gender"],
  ])("rejects %s and leaves the profile unchanged", async (_l, body, field) => {
    const s = await registerUser();
    const before = (await me(s)).profile;
    const res = await patch(s, "/v1/me/profile", body);
    expect(res.status).toBe(422);
    expect(res.body.error.fields[field]).toBeTruthy();
    expect((await me(s)).profile).toEqual(before);
  });

  it("rejects an empty update", async () => {
    const s = await registerUser();
    expect((await patch(s, "/v1/me/profile", {})).status).toBe(422);
  });

  it("does not let a member change another's profile, email or role through this route", async () => {
    const s = await registerUser();
    const before = await me(s);
    const res = await patch(s, "/v1/me/profile", { firstName: "X", email: "evil@example.com", role: "admin", userId: "someone-else" });
    expect(res.status).toBe(200); // unknown keys are ignored, not applied
    const after = await me(s);
    expect(after.email).toBe(before.email);
    expect(after.profile.firstName).toBe("X");
  });

  it("requires authentication", async () => {
    await (await http()).patch("/v1/me/profile").send({ firstName: "X" }).expect(401);
  });
});

describe("preferences", () => {
  it("defaults everything on for a new member", async () => {
    const s = await registerUser();
    const p = (await (await http()).get("/v1/me/preferences").set("Authorization", s.auth).expect(200)).body;
    expect(p).toEqual({ pushEnabled: true, emailUpdates: true, appointmentReminders: true, language: "en" });
  });

  it("saves changes, keeps the rest, and persists across reads", async () => {
    const s = await registerUser();
    const res = await patch(s, "/v1/me/preferences", { pushEnabled: false, language: "fr" });
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ pushEnabled: false, emailUpdates: true, appointmentReminders: true, language: "fr" });
    await patch(s, "/v1/me/preferences", { emailUpdates: false });
    const p = (await (await http()).get("/v1/me/preferences").set("Authorization", s.auth).expect(200)).body;
    expect(p).toEqual({ pushEnabled: false, emailUpdates: false, appointmentReminders: true, language: "fr" });
  });

  it("rejects an unsupported language, a non-boolean, and an empty update", async () => {
    const s = await registerUser();
    expect((await patch(s, "/v1/me/preferences", { language: "xx" })).status).toBe(422);
    expect((await patch(s, "/v1/me/preferences", { pushEnabled: "yes" })).status).toBe(422);
    expect((await patch(s, "/v1/me/preferences", {})).status).toBe(422);
  });

  it("keeps each member's preferences separate", async () => {
    const a = await registerUser();
    const b = await registerUser();
    await patch(a, "/v1/me/preferences", { pushEnabled: false });
    expect((await (await http()).get("/v1/me/preferences").set("Authorization", b.auth).expect(200)).body.pushEnabled).toBe(true);
  });
});

describe("notifications", () => {
  async function trigger(s: Session) {
    // Booking an appointment raises a notification that deep-links to it.
    const res = await (await http()).post("/v1/appointments").set("Authorization", s.auth)
      .set("Idempotency-Key", `k-${Math.random()}`)
      .send({ hospitalId: await firstHospitalId(s), appointmentType: "general_checkup", requestedDate: day(30), underTreatment: false, emergencyContact: contact })
      .expect(201);
    return res.body as { id: string };
  }
  const list = async (s: Session) => (await (await http()).get("/v1/notifications").set("Authorization", s.auth).expect(200)).body as
    { unreadCount: number; items: { id: string; read: boolean; title: string; data: { url?: string } | null }[] };

  it("starts empty for a new member", async () => {
    const s = await registerUser();
    expect(await list(s)).toEqual({ unreadCount: 0, items: [] });
  });

  it("delivers an unread notification with a link to what it is about", async () => {
    const s = await registerUser();
    const appt = await trigger(s);
    const n = await list(s);
    expect(n.unreadCount).toBe(1);
    expect(n.items[0]).toMatchObject({ read: false, title: "Request received" });
    expect(n.items[0]!.data?.url).toBe(`medpilot://appointments/${appt.id}`);
  });

  it("marks one read and lowers the unread count", async () => {
    const s = await registerUser();
    await trigger(s);
    await trigger(s);
    const before = await list(s);
    expect(before.unreadCount).toBe(2);
    const after = (await (await http()).post("/v1/notifications/read").set("Authorization", s.auth).send({ ids: [before.items[0]!.id] }).expect(200)).body;
    expect(after.unreadCount).toBe(1);
    expect(after.items.filter((i: { read: boolean }) => i.read)).toHaveLength(1);
  });

  it("marks everything read", async () => {
    const s = await registerUser();
    await trigger(s); await trigger(s); await trigger(s);
    const after = (await (await http()).post("/v1/notifications/read").set("Authorization", s.auth).send({ ids: "all" }).expect(200)).body;
    expect(after.unreadCount).toBe(0);
    expect(after.items.every((i: { read: boolean }) => i.read)).toBe(true);
  });

  it("reports the true unread total even when more than a page exists", async () => {
    const s = await registerUser();
    for (let i = 0; i < 55; i += 1) {
      await pool.query(
        "insert into notifications (id, user_id, type, title, body) values (gen_random_uuid(), $1, 'test', 'n', 'b')", [s.userId]);
    }
    const n = await list(s);
    expect(n.items).toHaveLength(50); // a page
    expect(n.unreadCount).toBe(55); // the truth, not the page
  });

  it("cannot mark another member's notifications read", async () => {
    const owner = await registerUser();
    const other = await registerUser();
    await trigger(owner);
    const ownerList = await list(owner);
    await (await http()).post("/v1/notifications/read").set("Authorization", other.auth).send({ ids: [ownerList.items[0]!.id] }).expect(200);
    expect((await list(owner)).unreadCount).toBe(1); // untouched
  });

  it("requires authentication", async () => {
    await (await http()).get("/v1/notifications").expect(401);
  });
});
