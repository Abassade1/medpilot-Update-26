// Must be set before the app (and its cached env) is created.
process.env.PUSH_DRIVER = "expo";
process.env.EXPO_ACCESS_TOKEN = "expo-test-access-token";

import { Pool } from "pg";
import { closeApp, firstHospitalId, http, registerUser, type Session } from "./helpers";

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
afterAll(async () => { await pool.end(); await closeApp(); });

const auth = (s: Session) => ["Authorization", s.auth] as const;
const contact = { firstName: "Aisha", lastName: "Uwaiz", phone: "4035550101", relationship: "partner", accompanies: true };
const day = (n: number) => new Date(Date.now() + n * 86400_000).toISOString().slice(0, 10);
const EXPO = "https://exp.host/--/api/v2/push/send";

/**
 * Push delivery through Expo, with Expo itself stood in for. Any member action that notifies
 * works as a trigger; requesting an appointment is the simplest.
 */
describe("push delivery", () => {
  let sent: { tokens: string[]; messages: { to: string; title: string; body: string; data: { url?: string } }[]; headers: Record<string, string> }[];
  let reply: () => Promise<Response>;

  beforeEach(() => {
    sent = [];
    reply = async () => new Response(JSON.stringify({ data: sent.at(-1)!.messages.map(() => ({ status: "ok" })) }), { status: 200 });
    const realFetch = global.fetch;
    jest.spyOn(global, "fetch").mockImplementation(async (input, init) => {
      if (String(input) !== EXPO) return realFetch(input, init);
      const messages = JSON.parse(String(init!.body));
      sent.push({ tokens: messages.map((m: { to: string }) => m.to), messages, headers: init!.headers as Record<string, string> });
      return reply();
    });
  });
  afterEach(() => jest.restoreAllMocks());

  async function withDevices(tokens: (string | null)[]) {
    const s = await registerUser();
    for (const [i, pushToken] of tokens.entries()) {
      await (await http()).post("/v1/me/devices").set(...auth(s))
        .send({ platform: "ios", installId: `install-${s.userId}-${i}`, pushToken }).expect(201);
    }
    return s;
  }
  const requestAppointment = async (s: Session) =>
    (await http()).post("/v1/appointments").set(...auth(s)).send({
      hospitalId: await firstHospitalId(s), appointmentType: "general_checkup", requestedDate: day(30),
      underTreatment: false, emergencyContact: contact,
    });

  it("sends to every device with a push token, with the deep link and the access token", async () => {
    const s = await withDevices(["ExponentPushToken[aaa]", "ExponentPushToken[bbb]", null]);
    const res = await requestAppointment(s);
    expect(res.status).toBe(201);

    expect(sent).toHaveLength(1);
    expect(sent[0]!.tokens.sort()).toEqual(["ExponentPushToken[aaa]", "ExponentPushToken[bbb]"]);
    expect(sent[0]!.messages[0]).toMatchObject({ title: "Request received", data: { url: `medpilot://appointments/${res.body.id}` } });
    expect(sent[0]!.headers.authorization).toBe("Bearer expo-test-access-token");
  });

  it("respects the member turning push off, while still recording the notification", async () => {
    const s = await withDevices(["ExponentPushToken[off]"]);
    await (await http()).patch("/v1/me/preferences").set(...auth(s)).send({ pushEnabled: false }).expect(200);
    expect((await requestAppointment(s)).status).toBe(201);

    expect(sent).toHaveLength(0);
    const inbox = await (await http()).get("/v1/notifications").set(...auth(s)).expect(200);
    expect(inbox.body.items[0]).toMatchObject({ type: "appointment.requested" });
  });

  it("forgets a token Expo reports as no longer registered", async () => {
    const s = await withDevices(["ExponentPushToken[gone]", "ExponentPushToken[live]"]);
    reply = async () => new Response(JSON.stringify({
      data: sent.at(-1)!.messages.map((m) => m.to === "ExponentPushToken[gone]"
        ? { status: "error", details: { error: "DeviceNotRegistered" } }
        : { status: "ok" }),
    }), { status: 200 });
    await requestAppointment(s);

    const { rows } = await pool.query("select push_token from devices where user_id = $1 order by push_token nulls first", [s.userId]);
    expect(rows.map((r) => r.push_token)).toEqual([null, "ExponentPushToken[live]"]);
  });

  it("a push failure never fails the action that caused it", async () => {
    const s = await withDevices(["ExponentPushToken[down]"]);
    reply = async () => { throw new Error("network down"); };
    expect((await requestAppointment(s)).status).toBe(201);
    const inbox = await (await http()).get("/v1/notifications").set(...auth(s)).expect(200);
    expect(inbox.body.items[0]).toMatchObject({ type: "appointment.requested" });
  });

  it("doesn't call Expo for a member with no push tokens", async () => {
    const s = await withDevices([]);
    await requestAppointment(s);
    expect(sent).toHaveLength(0);
  });
});
