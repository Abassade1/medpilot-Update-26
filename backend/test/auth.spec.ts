import { closeApp, http, registerUser, uniqueEmail } from "./helpers";
afterAll(closeApp);

describe("registration", () => {
  it("creates a user and returns a token pair plus server-derived setup state", async () => {
    const email = uniqueEmail();
    const res = await (await http()).post("/v1/auth/register")
      .send({ email, password: "password123", firstName: "Mohammed", lastName: "Uwaiz", phone: "4038903333", dateOfBirth: "1993-08-26" })
      .expect(201);
    expect(res.body.user.email).toBe(email);
    expect(res.body.user.emailVerified).toBe(false);
    expect(res.body.tokens.accessToken).toBeTruthy();
    expect(res.body.setup).toEqual({ passwordSet: true, historyComplete: false, emailVerified: false });
    expect(JSON.stringify(res.body)).not.toContain("passwordHash");
  });

  it("rejects a duplicate email with 409 and a field error", async () => {
    const email = uniqueEmail();
    const body = { email, password: "password123", firstName: "A", lastName: "B", phone: "4038903333", dateOfBirth: "1993-08-26" };
    await (await http()).post("/v1/auth/register").send(body).expect(201);
    const res = await (await http()).post("/v1/auth/register").send(body).expect(409);
    expect(res.body.error.code).toBe("conflict");
    expect(res.body.error.fields.email).toBeTruthy();
  });

  it.each([
    ["invalid email", { email: "nope" }, "email"],
    ["short password", { password: "abc" }, "password"],
    ["future birth date", { dateOfBirth: "2999-01-01" }, "dateOfBirth"],
    ["impossible date", { dateOfBirth: "1993-02-31" }, "dateOfBirth"],
    ["short phone", { phone: "123" }, "phone"],
    ["numeric name", { firstName: "1234" }, "firstName"],
  ])("rejects %s with 422 naming the field", async (_label, override, field) => {
    const res = await (await http()).post("/v1/auth/register")
      .send({ email: uniqueEmail(), password: "password123", firstName: "A", lastName: "B", phone: "4038903333", dateOfBirth: "1993-08-26", ...override })
      .expect(422);
    expect(res.body.error.code).toBe("validation_failed");
    expect(res.body.error.fields[field]).toBeTruthy();
  });
});

describe("login", () => {
  it("accepts correct credentials", async () => {
    const email = uniqueEmail();
    await (await http()).post("/v1/auth/register")
      .send({ email, password: "password123", firstName: "A", lastName: "B", phone: "4038903333", dateOfBirth: "1993-08-26" }).expect(201);
    const res = await (await http()).post("/v1/auth/login").send({ email, password: "password123" }).expect(200);
    expect(res.body.tokens.refreshToken).toBeTruthy();
  });

  it("returns the same generic error for a wrong password and an unknown account", async () => {
    const email = uniqueEmail();
    await (await http()).post("/v1/auth/register")
      .send({ email, password: "password123", firstName: "A", lastName: "B", phone: "4038903333", dateOfBirth: "1993-08-26" }).expect(201);
    const wrong = await (await http()).post("/v1/auth/login").send({ email, password: "wrongpassword" }).expect(401);
    const unknown = await (await http()).post("/v1/auth/login").send({ email: uniqueEmail(), password: "password123" }).expect(401);
    // identical wording prevents account enumeration
    expect(wrong.body.error.message).toBe(unknown.body.error.message);
  });
});

describe("sessions", () => {
  it("rotates the refresh token and revokes the chain when an old token is reused", async () => {
    const s = await registerUser();
    const first = await (await http()).post("/v1/auth/refresh").send({ refreshToken: s.refreshToken }).expect(200);
    const rotated = first.body.tokens.refreshToken;
    expect(rotated).not.toBe(s.refreshToken);

    await (await http()).post("/v1/auth/refresh").send({ refreshToken: s.refreshToken }).expect(401);
    // reuse detection revoked the whole chain, so the rotated token dies too
    await (await http()).post("/v1/auth/refresh").send({ refreshToken: rotated }).expect(401);
  });

  it("rejects protected routes without a token and with a malformed token", async () => {
    await (await http()).get("/v1/me").expect(401);
    await (await http()).get("/v1/me").set("Authorization", "Bearer not-a-jwt").expect(401);
  });

  it("invalidates the session after logout", async () => {
    const s = await registerUser();
    await (await http()).post("/v1/auth/logout").set("Authorization", s.auth).send({ refreshToken: s.refreshToken }).expect(204);
    await (await http()).post("/v1/auth/refresh").send({ refreshToken: s.refreshToken }).expect(401);
  });
});

describe("password reset", () => {
  it("always answers 202 so accounts cannot be enumerated", async () => {
    await (await http()).post("/v1/auth/password/forgot").send({ email: uniqueEmail() }).expect(202);
  });
  it("rejects an invalid reset token", async () => {
    const res = await (await http()).post("/v1/auth/password/reset")
      .send({ token: "pr_definitely-not-a-real-token-value", password: "newpassword123" }).expect(400);
    expect(res.body.error.code).toBe("bad_request");
  });
});
