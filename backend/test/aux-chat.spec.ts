import { Pool } from "pg";
import { closeApp, http, registerUser, type Session } from "./helpers";
import { respond } from "../src/modules/aux/aux-chat";

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
afterAll(async () => { await pool.end(); await closeApp(); });

describe("assistant safety rules", () => {
  it.each([
    "I have chest pain", "i can't breathe", "he is unconscious", "possible stroke", "having a seizure",
    "she took an overdose", "severe bleeding from my leg", "I think it's a heart attack", "my child is choking",
    "CHEST PAIN!!!", "I've got terrible chest pain and a headache",
  ])("treats %j as an emergency, with safety advice ahead of any feature", (msg) => {
    const r = respond(msg);
    expect(r.intent).toBe("emergency");
    expect(r.urgent).toBe(true);
    expect(r.text).toMatch(/911/);
    expect(r.text).toMatch(/can't assess an emergency/);
    // It must not offer a symptom checker for something that needs a phone call.
    expect(r.suggestions.map((s) => s.action)).not.toContain("triage");
  });

  it.each([
    "I want to die", "i'm thinking about suicide", "I want to kill myself", "thinking of self-harm", "i might hurt myself",
  ])("treats %j as a crisis and offers people, not features", (msg) => {
    const r = respond(msg);
    expect(r.intent).toBe("crisis");
    expect(r.urgent).toBe(true);
    expect(r.text).toMatch(/988/);
    expect(r.text).toMatch(/can't give you the support a person can/);
    expect(r.suggestions).toEqual([]);
  });

  it("puts a crisis above an emergency when both appear", () => {
    expect(respond("I have chest pain and I want to die").intent).toBe("crisis");
  });

  it("never claims to diagnose", () => {
    for (const msg of ["I have a headache", "what is wrong with me", "fever and cough"]) {
      expect(respond(msg).text.toLowerCase()).not.toMatch(/you have|you are suffering|it is a |diagnos(is|ed) (is|as)/);
    }
    expect(respond("I have a headache").text).toMatch(/isn't a diagnosis/);
  });
});

describe("assistant intents", () => {
  const actions = (m: string) => respond(m).suggestions.map((s) => s.action);
  it.each([
    ["I have a headache and a fever", "triage"],
    ["what did I eat, count my calories", "meal"],
    ["how do I reschedule my appointment", "appointments"],
    ["find a cardiology hospital", "hospitals"],
    ["I need an ambulance to the airport", "transport"],
    ["my dog needs a vet", "pet"],
    ["I need to book a pet sitter", "pet"],
    ["I need a private nurse at home", "specialists"],
    ["how much is the pro plan", "upgrade"],
  ])("routes %j to %s", (msg, action) => {
    expect(actions(msg)).toContain(action);
    expect(respond(msg).urgent).toBe(false);
  });

  it("puts the pet suggestion first when booking a pet sitter", () => {
    expect(actions("I need to book a pet sitter")[0]).toBe("pet");
  });

  it("offers up to three suggestions when a message spans topics", () => {
    const r = respond("I have a fever, need an ambulance and want to book a hospital appointment");
    expect(r.suggestions.length).toBeGreaterThan(1);
    expect(r.suggestions.length).toBeLessThanOrEqual(3);
    expect(new Set(r.suggestions.map((s) => s.action)).size).toBe(r.suggestions.length); // no duplicates
  });

  it("greets, thanks, and admits when it doesn't understand", () => {
    expect(respond("hello").intent).toBe("greeting");
    expect(respond("Hi there").intent).toBe("greeting");
    expect(respond("thanks a lot").intent).toBe("thanks");
    const unknown = respond("what is the meaning of life");
    expect(unknown.intent).toBe("unknown");
    expect(unknown.text).toMatch(/simple assistant/);
    expect(unknown.suggestions.length).toBeGreaterThan(0);
  });

  it("handles awkward input without throwing", () => {
    for (const msg of ["", " ", "a", "😀😀😀", "ñandú пингвин 你好", "x".repeat(1000), "%_\\'\";--", "<script>alert(1)</script>"]) {
      const r = respond(msg);
      expect(typeof r.text).toBe("string");
      expect(r.text.length).toBeGreaterThan(0);
    }
  });

  it("does not react to an emergency word inside another word", () => {
    expect(respond("I enjoy strokes of the paintbrush").intent).not.toBe("emergency"); // 'strokes' != 'stroke' boundary
  });
});

describe("chat endpoint", () => {
  const send = async (s: Session, body: object) => (await http()).post("/v1/aux/chat").set("Authorization", s.auth).send(body);

  it("starts a conversation, replies, and labels itself rule-based", async () => {
    const s = await registerUser();
    const res = await send(s, { message: "I have a headache" });
    expect(res.status).toBe(200);
    expect(res.body.sessionId).toBeTruthy();
    expect(res.body.mode).toBe("rule_based");
    expect(res.body.reply.text).toBeTruthy();
    expect(res.body.reply.suggestions[0]).toMatchObject({ action: "triage" });
    expect(res.body.disclaimer).toMatch(/not a medical diag/i);
  });

  it("continues the same conversation and returns it in order", async () => {
    const s = await registerUser();
    const a = await send(s, { message: "hello" });
    const b = await send(s, { sessionId: a.body.sessionId, message: "I need an ambulance" });
    expect(b.body.sessionId).toBe(a.body.sessionId);
    const h = (await (await http()).get(`/v1/aux/chat/${a.body.sessionId}`).set("Authorization", s.auth).expect(200)).body;
    expect(h.messages.map((m: { role: string }) => m.role)).toEqual(["user", "assistant", "user", "assistant"]);
    expect(h.messages[0].text).toBe("hello");
    expect(h.messages[2].text).toBe("I need an ambulance");
  });

  it("restores the latest conversation when the member returns", async () => {
    const s = await registerUser();
    expect((await (await http()).get("/v1/aux/chat").set("Authorization", s.auth).expect(200)).body).toEqual({ sessionId: null, messages: [] });
    const a = await send(s, { message: "hello" });
    const back = (await (await http()).get("/v1/aux/chat").set("Authorization", s.auth).expect(200)).body;
    expect(back.sessionId).toBe(a.body.sessionId);
    expect(back.messages).toHaveLength(2);
  });

  it("does not resume a conversation older than a day", async () => {
    const s = await registerUser();
    const a = await send(s, { message: "hello" });
    await pool.query("update ai_sessions set created_at = now() - interval '2 days' where id = $1", [a.body.sessionId]);
    expect((await (await http()).get("/v1/aux/chat").set("Authorization", s.auth).expect(200)).body.sessionId).toBeNull();
  });

  it("keeps stored assistant messages faithful, including the urgent flag", async () => {
    const s = await registerUser();
    const a = await send(s, { message: "I have chest pain" });
    const h = (await (await http()).get(`/v1/aux/chat/${a.body.sessionId}`).set("Authorization", s.auth).expect(200)).body;
    expect(h.messages[1]).toMatchObject({ role: "assistant", urgent: true });
  });

  it.each([
    ["an empty message", { message: "" }],
    ["a whitespace message", { message: "    " }],
    ["a missing message", {}],
    ["an over-long message", { message: "x".repeat(1001) }],
    ["a non-string message", { message: 42 }],
    ["a malformed session id", { message: "hi", sessionId: "nope" }],
  ])("rejects %s with a 422 and creates nothing", async (_l, body) => {
    const s = await registerUser();
    const res = await send(s, body);
    expect(res.status).toBe(422);
    expect((await (await http()).get("/v1/aux/chat").set("Authorization", s.auth).expect(200)).body.sessionId).toBeNull();
  });

  it("accepts unicode and emoji and returns them intact", async () => {
    const s = await registerUser();
    const msg = "Je me sens mal 😷 — 头痛";
    const a = await send(s, { message: msg });
    const h = (await (await http()).get(`/v1/aux/chat/${a.body.sessionId}`).set("Authorization", s.auth).expect(200)).body;
    expect(h.messages[0].text).toBe(msg);
  });

  it("stores markup as inert text rather than interpreting it", async () => {
    const s = await registerUser();
    const a = await send(s, { message: "<img src=x onerror=alert(1)>" });
    const h = (await (await http()).get(`/v1/aux/chat/${a.body.sessionId}`).set("Authorization", s.auth).expect(200)).body;
    expect(h.messages[0].text).toBe("<img src=x onerror=alert(1)>");
  });

  it("gives another member's conversation a 404, for reading and writing", async () => {
    const owner = await registerUser();
    const other = await registerUser();
    const a = await send(owner, { message: "hello" });
    await (await http()).get(`/v1/aux/chat/${a.body.sessionId}`).set("Authorization", other.auth).expect(404);
    expect((await send(other, { sessionId: a.body.sessionId, message: "hi" })).status).toBe(404);
    expect((await (await http()).get(`/v1/aux/chat/${a.body.sessionId}`).set("Authorization", owner.auth).expect(200)).body.messages).toHaveLength(2);
  });

  it("won't treat a triage session as a chat", async () => {
    const s = await registerUser();
    const t = (await (await http()).post("/v1/aux/triage").set("Authorization", s.auth).send({ symptomCode: "headache" })).body;
    if (t.sessionId) expect((await send(s, { sessionId: t.sessionId, message: "hi" })).status).toBe(404);
  });

  it("stops a conversation from growing without limit", async () => {
    const s = await registerUser();
    const a = await send(s, { message: "hello" });
    await pool.query(
      `insert into ai_messages (id, session_id, role, content)
       select gen_random_uuid(), $1, 'user', 'x' from generate_series(1, 210)`, [a.body.sessionId]);
    const res = await send(s, { sessionId: a.body.sessionId, message: "one more" });
    expect(res.status).toBe(409);
    expect(res.body.error.message).toMatch(/Start a new one/);
  });

  it("requires authentication", async () => {
    await (await http()).post("/v1/aux/chat").send({ message: "hi" }).expect(401);
    await (await http()).get("/v1/aux/chat").expect(401);
  });
});
