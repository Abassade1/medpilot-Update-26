import { closeApp, firstHospitalId, http, registerUser } from "./helpers";

const nearFuture = (days: number) =>
  new Date(Date.now() + days * 86400_000).toISOString().slice(0, 10);
afterAll(closeApp);

/** IDOR and privilege-escalation coverage (spec §10). */
describe("resource ownership", () => {
  it("hides another member's appointment behind 404", async () => {
    const owner = await registerUser();
    const other = await registerUser();
    const hospitalId = await firstHospitalId(owner);
    const created = await (await http()).post("/v1/appointments").set("Authorization", owner.auth).send({
      hospitalId, appointmentType: "general_checkup", requestedDate: nearFuture(60),
      underTreatment: false,
      emergencyContact: { firstName: "Kin", lastName: "Next", phone: "4035550101", relationship: "partner", accompanies: false },
    }).expect(201);

    await (await http()).get(`/v1/appointments/${created.body.id}`).set("Authorization", owner.auth).expect(200);
    // 404 rather than 403: never confirm that someone else's resource exists
    await (await http()).get(`/v1/appointments/${created.body.id}`).set("Authorization", other.auth).expect(404);
  });

  it("prevents cancelling another member's appointment", async () => {
    const owner = await registerUser();
    const other = await registerUser();
    const hospitalId = await firstHospitalId(owner);
    const created = await (await http()).post("/v1/appointments").set("Authorization", owner.auth).send({
      hospitalId, appointmentType: "surgery", requestedDate: nearFuture(75), underTreatment: false,
      emergencyContact: { firstName: "Kin", lastName: "Next", phone: "4035550101", relationship: "friend", accompanies: false },
    }).expect(201);
    await (await http()).post(`/v1/appointments/${created.body.id}/cancel`).set("Authorization", other.auth).expect(404);
  });

  it("scopes lists to the calling member", async () => {
    const a = await registerUser();
    const b = await registerUser();
    const hospitalId = await firstHospitalId(a);
    await (await http()).post("/v1/appointments").set("Authorization", a.auth).send({
      hospitalId, appointmentType: "general_checkup", requestedDate: nearFuture(90), underTreatment: false,
      emergencyContact: { firstName: "K", lastName: "N", phone: "4035550101", relationship: "parent", accompanies: false },
    }).expect(201);
    const mine = await (await http()).get("/v1/appointments").set("Authorization", b.auth).expect(200);
    expect(mine.body).toHaveLength(0);
  });

  it("keeps another member's medical record undeletable", async () => {
    const owner = await registerUser();
    const other = await registerUser();
    const ticket = await (await http()).post("/v1/me/records/upload-url").set("Authorization", owner.auth)
      .send({ fileName: "r.pdf", mimeType: "application/pdf", sizeBytes: 100 }).expect(201);
    const token = ticket.body.uploadUrl.split("/v1/uploads/")[1];
    const pdf = Buffer.concat([Buffer.from("%PDF-1.4\n"), Buffer.alloc(91)]);
    await (await http()).put(`/v1/uploads/${token}`).set("Content-Type", "application/pdf").send(pdf).expect(200);
    const rec = await (await http()).post("/v1/me/records").set("Authorization", owner.auth)
      .send({ fileId: ticket.body.fileId, displayName: "record.pdf" }).expect(201);

    await (await http()).delete(`/v1/me/records/${rec.body.id}`).set("Authorization", other.auth).expect(404);
    await (await http()).delete(`/v1/me/records/${rec.body.id}`).set("Authorization", owner.auth).expect(204);
  });
});

describe("role restrictions", () => {
  it("blocks a member from the staff decision endpoint", async () => {
    const member = await registerUser();
    const hospitalId = await firstHospitalId(member);
    const created = await (await http()).post("/v1/appointments").set("Authorization", member.auth).send({
      hospitalId, appointmentType: "general_checkup", requestedDate: nearFuture(105), underTreatment: false,
      emergencyContact: { firstName: "K", lastName: "N", phone: "4035550101", relationship: "other", accompanies: false },
    }).expect(201);
    const res = await (await http()).post(`/v1/staff/appointments/${created.body.id}/confirm`)
      .set("Authorization", member.auth).send({}).expect(403);
    expect(res.body.error.code).toBe("forbidden");
  });
});
