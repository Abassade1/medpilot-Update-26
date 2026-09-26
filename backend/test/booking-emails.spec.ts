import { Pool } from "pg";
import { SMTPServer } from "smtp-server";
import type { AddressInfo } from "node:net";
import { closeApp, firstHospitalId, getApp, http, registerUser, uniqueEmail, type Session } from "./helpers";

/**
 * Booking confirmations and cancellations by email, delivered over a real SMTP socket. Only
 * verified addresses whose owner hasn't turned "Email updates" off receive them.
 */
describe("booking emails", () => {
  let server: SMTPServer;
  const inbox: { to: string; body: string }[] = [];
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });

  beforeAll(async () => {
    server = new SMTPServer({
      authOptional: true,
      disabledCommands: ["STARTTLS", "AUTH"],
      onData(stream, session, cb) {
        let raw = "";
        stream.on("data", (c) => { raw += c.toString(); });
        stream.on("end", () => { inbox.push({ to: session.envelope.rcptTo[0]!.address, body: raw }); cb(); });
      },
    });
    await new Promise<void>((res) => server.listen(0, "127.0.0.1", res));
    Object.assign(process.env, {
      EMAIL_DRIVER: "smtp", SMTP_HOST: "127.0.0.1", SMTP_PORT: String((server.server.address() as AddressInfo).port),
      SMTP_SECURE: "false", SMTP_REQUIRE_TLS: "false", SMTP_ALLOW_INSECURE: "true", SMTP_USER: "", SMTP_PASSWORD: "",
    });
    await getApp();
  }, 60_000);

  afterAll(async () => {
    await pool.end();
    await closeApp();
    await new Promise<void>((res) => server.close(() => res()));
  });

  const auth = (s: Session) => ["Authorization", s.auth] as const;
  const contact = { firstName: "Aisha", lastName: "Uwaiz", phone: "4035550101", relationship: "partner", accompanies: true };
  const day = (n: number) => new Date(Date.now() + n * 86400_000).toISOString().slice(0, 10);
  const subjectOf = (body: string) => /^Subject: (.*)$/m.exec(body)?.[1];

  async function member({ verified = true } = {}) {
    const email = uniqueEmail("mail");
    const s = await registerUser({ email });
    if (verified) await pool.query("update users set email_verified_at = now() where id = $1", [s.userId]);
    return { ...s, email };
  }
  async function staff(): Promise<Session> {
    const email = uniqueEmail("mailstaff");
    const u = await registerUser({ email });
    await pool.query("update users set role = 'staff' where id = $1", [u.userId]);
    const res = await (await http()).post("/v1/auth/login").send({ email, password: "password123" }).expect(200);
    return { ...u, auth: `Bearer ${res.body.tokens.accessToken}` };
  }
  async function appointment(s: Session) {
    return (await (await http()).post("/v1/appointments").set(...auth(s)).send({
      hospitalId: await firstHospitalId(s), appointmentType: "general_checkup", requestedDate: day(30),
      underTreatment: false, emergencyContact: contact,
    }).expect(201)).body.id as string;
  }
  const mailTo = (email: string) => inbox.filter((m) => m.to === email);

  it("emails a verified member when their appointment is confirmed, without naming the hospital", async () => {
    const m = await member();
    const ops = await staff();
    const id = await appointment(m);
    inbox.length = 0;
    await (await http()).post(`/v1/staff/appointments/${id}/confirm`).set(...auth(ops)).send({}).expect(200);

    const mails = mailTo(m.email);
    expect(mails).toHaveLength(1);
    expect(subjectOf(mails[0]!.body)).toBe("Appointment confirmed");
    const hospital = (await (await http()).get(`/v1/appointments/${id}`).set(...auth(m)).expect(200)).body.hospital.name as string;
    expect(mails[0]!.body).not.toContain(hospital);
  });

  it("emails when a request is declined", async () => {
    const m = await member();
    const ops = await staff();
    const id = await appointment(m);
    inbox.length = 0;
    await (await http()).post(`/v1/staff/appointments/${id}/cancel`).set(...auth(ops)).send({}).expect(200);
    expect(mailTo(m.email).map((x) => subjectOf(x.body))).toEqual(["Appointment update"]);
  });

  it("doesn't email an unverified address", async () => {
    const m = await member({ verified: false });
    const ops = await staff();
    const id = await appointment(m);
    inbox.length = 0;
    await (await http()).post(`/v1/staff/appointments/${id}/confirm`).set(...auth(ops)).send({}).expect(200);
    expect(mailTo(m.email)).toHaveLength(0);
  });

  it("respects the member turning email updates off, but still notifies in the app", async () => {
    const m = await member();
    const ops = await staff();
    await (await http()).patch("/v1/me/preferences").set(...auth(m)).send({ emailUpdates: false }).expect(200);
    const id = await appointment(m);
    inbox.length = 0;
    await (await http()).post(`/v1/staff/appointments/${id}/confirm`).set(...auth(ops)).send({}).expect(200);
    expect(mailTo(m.email)).toHaveLength(0);
    const notes = (await (await http()).get("/v1/notifications").set(...auth(m)).expect(200)).body.items;
    expect(notes[0]).toMatchObject({ type: "appointment.confirmed" });
  });

  it("emails transport and pet-clinic confirmations too", async () => {
    const m = await member();
    const ops = await staff();

    const provider = (await (await http()).get("/v1/transport-providers").set(...auth(m)).expect(200)).body[0];
    const reference = (await (await http()).get("/v1/reference").set(...auth(m)).expect(200)).body;
    const t = await (await http()).post("/v1/transport-bookings").set(...auth(m)).send({
      providerId: provider.id, pickupDate: day(35), pickupCountry: "Canada", pickupRegion: "Alberta",
      pickupSiteType: "helipad", dropoffCountry: "United Arab Emirates", dropoffSiteType: "airport",
      purposeIds: [reference.transportPurposes[0].id], needIds: [reference.specialNeeds[0].id], emergencyContact: contact,
    }).expect(201);
    const clinic = (await (await http()).get("/v1/pet-clinics").set(...auth(m)).query({ category: "vet" }).expect(200)).body[0];
    const svc = (await (await http()).get(`/v1/pet-clinics/${clinic.id}`).set(...auth(m)).expect(200)).body.services
      .find((x: { kind?: string }) => x.kind === "appointment");
    const r = await (await http()).post(`/v1/pet-clinics/${clinic.id}/requests`).set(...auth(m)).send({
      kind: "appointment", serviceId: svc.id, petName: "Biscuit", petType: "dog", preferredDate: day(10),
    }).expect(201);

    inbox.length = 0;
    await (await http()).post(`/v1/staff/transport/${t.body.id}/confirm`).set(...auth(ops)).send({}).expect(200);
    await (await http()).post(`/v1/staff/service-requests/${r.body.id}/confirm`).set(...auth(ops)).send({}).expect(200);
    expect(mailTo(m.email).map((x) => subjectOf(x.body)).sort()).toEqual(["Request confirmed", "Transport confirmed"]);
  });
});
