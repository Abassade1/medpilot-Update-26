// Dev .env may enable auto-verification; these tests assert the real review path, so pin it off.
process.env.PROVIDER_AUTO_VERIFY = "false";
import { Pool } from "pg";
import { closeApp, http, registerUser, type Session } from "./helpers";

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
afterAll(async () => { await pool.end(); await closeApp(); });

const auth = (s: Session) => ["Authorization", s.auth] as const;
const key = () => `k-${Math.random()}`;
const day = (n: number) => new Date(Date.now() + n * 86400_000).toISOString().slice(0, 10);
const weekday = (iso: string) => new Date(`${iso}T00:00:00Z`).getUTCDay();

async function staffSession(): Promise<Session> {
  const email = `vstaff${Date.now()}${Math.floor(Math.random() * 1e6)}@medpilot.test`;
  const u = await registerUser({ email });
  await pool.query("update users set role = 'staff' where id = $1", [u.userId]);
  const res = await (await http()).post("/v1/auth/login").send({ email, password: "password123" }).expect(200);
  return { ...u, accessToken: res.body.tokens.accessToken, auth: `Bearer ${res.body.tokens.accessToken}` };
}

const profile = {
  description: "A friendly clinic caring for dogs, cats and small animals since 2011.",
  phone: "+14035550199", country: "Canada", region: "Alberta", city: "Calgary", languages: "English, French",
  operatingHours: "Mon–Fri 08:00–18:00",
};

async function makeProvider(type = "vet_clinic", overrides: Record<string, unknown> = {}) {
  const owner = await registerUser();
  await (await http()).post("/v1/provider").set(...auth(owner)).send({ type, name: "Paws & Claws Vet", ...profile, ...overrides }).expect(201);
  return owner;
}

const serviceBody = (extra: Record<string, unknown> = {}) => ({
  kind: "service", name: "Annual check-up", category: "consultation", subcategory: "general",
  description: "A full annual health check with vaccination review and dental inspection.",
  priceAmount: 8500, priceType: "fixed", durationMinutes: 30, capacity: 2, locationModes: ["onsite"], country: "Canada", region: "Alberta", city: "Calgary",
  cancellationPolicy: "Free cancellation up to 24 hours before.", attributes: { species: ["dog", "cat"], emergency_available: false }, ...extra,
});

async function liveListing(owner: Session, staff?: Session, body = serviceBody()) {
  const created = (await (await http()).post("/v1/provider/listings").set(...auth(owner)).send(body).expect(201)).body;
  // Mon–Fri 09:00–12:00
  await (await http()).put(`/v1/provider/listings/${created.id}/availability`).set(...auth(owner))
    .send({ windows: [1, 2, 3, 4, 5].map((w) => ({ weekday: w, start: "09:00", end: "12:00" })), blackouts: [] }).expect(200);
  let pub = (await (await http()).post(`/v1/provider/listings/${created.id}/publish`).set(...auth(owner)).expect(200)).body;
  if (pub.status === "review") {
    await (await http()).post(`/v1/staff/listings/${created.id}/approve`).set(...auth(staff!)).expect(200);
    pub = (await (await http()).get(`/v1/provider/listings/${created.id}`).set(...auth(owner)).expect(200)).body;
  }
  return pub;
}

/** The next weekday (Mon–Fri) that is at least `from` days out, as a date the API will accept. */
function nextWorkday(from = 3) {
  let d = from;
  while ([0, 6].includes(weekday(day(d)))) d += 1;
  return day(d);
}

describe("provider account", () => {
  it("serves a taxonomy the forms are built from", async () => {
    const s = await registerUser();
    const t = (await (await http()).get("/v1/provider/taxonomy").set(...auth(s)).expect(200)).body;
    const vet = t.providerTypes.find((x: any) => x.code === "vet_clinic");
    expect(vet.categories.map((c: any) => c.code)).toEqual(expect.arrayContaining(["consultation", "surgery", "vaccination", "grooming"]));
    expect(vet.serviceFields.map((f: any) => f.key)).toContain("species");
    const transport = t.providerTypes.find((x: any) => x.code === "medical_transport");
    expect(transport.serviceFields.map((f: any) => f.key)).toEqual(expect.arrayContaining(["vehicle_type", "passenger_capacity"]));
    // Irrelevant fields stay out: a vet has no vehicle.
    expect(vet.serviceFields.map((f: any) => f.key)).not.toContain("vehicle_type");
    expect(t.providerTypes.map((x: any) => x.code)).toEqual(expect.arrayContaining(["hospital", "private_nurse", "medical_tourism", "pet_sitter"]));
  });

  it("creates, reads and updates a profile; one account per member", async () => {
    const s = await registerUser();
    expect((await (await http()).get("/v1/provider/me").set(...auth(s)).expect(200)).body.provider).toBeNull();
    const created = await (await http()).post("/v1/provider").set(...auth(s)).send({ type: "private_nurse", name: "Grace Nursing" }).expect(201);
    expect(created.body.provider).toMatchObject({ type: "private_nurse", verificationStatus: "unverified", profileComplete: false });
    expect(Object.keys(created.body.provider.profileGaps)).toEqual(expect.arrayContaining(["description", "phone", "country", "city"]));
    await (await http()).post("/v1/provider").set(...auth(s)).send({ type: "clinic", name: "Another" }).expect(409);
    const upd = await (await http()).patch("/v1/provider").set(...auth(s)).send(profile).expect(200);
    expect(upd.body.provider.profileComplete).toBe(true);
    expect(upd.body.provider.city).toBe("Calgary");
  });

  it("validates profile fields", async () => {
    const s = await registerUser();
    await (await http()).post("/v1/provider").set(...auth(s)).send({ type: "nonsense", name: "X Co" }).expect(422);
    await (await http()).post("/v1/provider").set(...auth(s)).send({ type: "clinic", name: "X" }).expect(422);
    await (await http()).post("/v1/provider").set(...auth(s)).send({ type: "clinic", name: "Good Clinic" }).expect(201);
    const bad = await (await http()).patch("/v1/provider").set(...auth(s)).send({ website: "not a url", email: "nope" }).expect(422);
    expect(bad.body.error.fields.website).toBeDefined();
    expect(bad.body.error.fields.email).toBeDefined();
  });

  it("keeps the whole portal closed to members without a provider account", async () => {
    const s = await registerUser();
    for (const url of ["/v1/provider/dashboard", "/v1/provider/listings", "/v1/provider/bookings"]) {
      await (await http()).get(url).set(...auth(s)).expect(403);
    }
    await (await http()).post("/v1/provider/listings").set(...auth(s)).send(serviceBody()).expect(403);
  });
});

describe("services: draft → publish", () => {
  it("saves a partial draft and refuses to publish it, listing every gap", async () => {
    const owner = await makeProvider();
    const draft = (await (await http()).post("/v1/provider/listings").set(...auth(owner)).send({ kind: "service", name: "Grooming" }).expect(201)).body;
    expect(draft.status).toBe("draft");
    const res = await (await http()).post(`/v1/provider/listings/${draft.id}/publish`).set(...auth(owner)).expect(422);
    expect(Object.keys(res.body.error.fields)).toEqual(expect.arrayContaining(["description", "category", "priceAmount", "durationMinutes", "cancellationPolicy", "availability", "attributes.species"]));
    // Still a draft, and invisible to members.
    const member = await registerUser();
    await (await http()).get(`/v1/listings/${draft.id}`).set(...auth(member)).expect(404);
  });

  it("rejects a category or attribute from another provider type", async () => {
    const owner = await makeProvider("vet_clinic");
    await (await http()).post("/v1/provider/listings").set(...auth(owner)).send({ kind: "service", name: "Jet", category: "air" }).expect(422);
    const bad = await (await http()).post("/v1/provider/listings").set(...auth(owner)).send({ kind: "service", name: "Bad", attributes: { species: ["dragon"] } }).expect(422);
    expect(bad.body.error.fields["attributes.species"]).toBeDefined();
    // Unknown attributes (a vehicle on a vet listing) are dropped, not stored.
    const ok = (await (await http()).post("/v1/provider/listings").set(...auth(owner)).send({ kind: "service", name: "Fine", attributes: { species: ["dog"], vehicle_type: "jet" } }).expect(201)).body;
    expect(ok.attributes).toEqual({ species: ["dog"] });
  });

  it("goes live at once for a verified provider, and to review for an unverified one", async () => {
    const staff = await staffSession();
    const unverified = await makeProvider();
    const l1 = await liveListing(unverified, staff);
    expect(l1.status).toBe("published"); // after staff approval

    const verifiedOwner = await makeProvider();
    const me = (await (await http()).get("/v1/provider/me").set(...auth(verifiedOwner)).expect(200)).body.provider;
    await (await http()).post("/v1/provider/verification").set(...auth(verifiedOwner)).send({ licenseInfo: "AB-VET-1234" }).expect(200);
    await (await http()).post(`/v1/staff/providers/${me.id}/verify`).set(...auth(staff)).expect(200);
    const created = (await (await http()).post("/v1/provider/listings").set(...auth(verifiedOwner)).send(serviceBody()).expect(201)).body;
    await (await http()).put(`/v1/provider/listings/${created.id}/availability`).set(...auth(verifiedOwner)).send({ windows: [{ weekday: 1, start: "09:00", end: "10:00" }], blackouts: [] }).expect(200);
    const pub = (await (await http()).post(`/v1/provider/listings/${created.id}/publish`).set(...auth(verifiedOwner)).expect(200)).body;
    expect(pub.status).toBe("published");
    const notes = (await (await http()).get("/v1/notifications").set(...auth(verifiedOwner)).expect(200)).body.items;
    expect(notes.some((n: any) => n.type === "provider.verified")).toBe(true);
  });

  it("refuses to publish until the provider profile is complete", async () => {
    const owner = await registerUser();
    await (await http()).post("/v1/provider").set(...auth(owner)).send({ type: "vet_clinic", name: "Bare Vet" }).expect(201);
    const l = (await (await http()).post("/v1/provider/listings").set(...auth(owner)).send(serviceBody()).expect(201)).body;
    await (await http()).put(`/v1/provider/listings/${l.id}/availability`).set(...auth(owner)).send({ windows: [{ weekday: 1, start: "09:00", end: "10:00" }], blackouts: [] }).expect(200);
    const res = await (await http()).post(`/v1/provider/listings/${l.id}/publish`).set(...auth(owner)).expect(422);
    expect(res.body.error.fields.provider).toMatch(/profile/i);
  });

  it("surfaces a pending provider in the staff queue with a readable type label", async () => {
    const staff = await staffSession();
    const owner = await makeProvider();
    await (await http()).post("/v1/provider/verification").set(...auth(owner)).send({ licenseInfo: "AB vet licence #12345" }).expect(200);
    const q = (await (await http()).get("/v1/staff/vendor-queue").set(...auth(staff)).expect(200)).body;
    const queued = q.providers.find((x: any) => x.name === "Paws & Claws Vet");
    expect(queued).toMatchObject({ typeLabel: "Veterinary clinic", info: "AB vet licence #12345" });
  });

  it("lets staff reject a listing, with the reason back to the provider", async () => {
    const staff = await staffSession();
    const owner = await makeProvider();
    const l = (await (await http()).post("/v1/provider/listings").set(...auth(owner)).send(serviceBody()).expect(201)).body;
    await (await http()).put(`/v1/provider/listings/${l.id}/availability`).set(...auth(owner)).send({ windows: [{ weekday: 1, start: "09:00", end: "10:00" }], blackouts: [] }).expect(200);
    expect((await (await http()).post(`/v1/provider/listings/${l.id}/publish`).set(...auth(owner)).expect(200)).body.status).toBe("review");
    const q = (await (await http()).get("/v1/staff/vendor-queue").set(...auth(staff)).expect(200)).body;
    const queued = q.listings.find((x: any) => x.id === l.id);
    // the queue carries provider context so staff never has to look the listing up separately
    expect(queued).toMatchObject({ providerName: "Paws & Claws Vet", providerTypeLabel: "Veterinary clinic" });
    await (await http()).post(`/v1/staff/listings/${l.id}/reject`).set(...auth(staff)).send({ reason: "Please add clearer pricing" }).expect(200);
    const after = (await (await http()).get(`/v1/provider/listings/${l.id}`).set(...auth(owner)).expect(200)).body;
    expect(after).toMatchObject({ status: "draft", rejectionNote: "Please add clearer pricing" });
  });

  it("supports unpublish, archive, duplicate and delete with the right guards", async () => {
    const staff = await staffSession();
    const owner = await makeProvider();
    const live = await liveListing(owner, staff);
    await (await http()).delete(`/v1/provider/listings/${live.id}`).set(...auth(owner)).expect(409); // unpublish first
    const copy = (await (await http()).post(`/v1/provider/listings/${live.id}/duplicate`).set(...auth(owner)).expect(201)).body;
    expect(copy).toMatchObject({ status: "draft", name: "Annual check-up (copy)", bookable: true });
    await (await http()).delete(`/v1/provider/listings/${copy.id}`).set(...auth(owner)).expect(204);
    await (await http()).get(`/v1/provider/listings/${copy.id}`).set(...auth(owner)).expect(404);

    const off = (await (await http()).post(`/v1/provider/listings/${live.id}/unpublish`).set(...auth(owner)).expect(200)).body;
    expect(off.status).toBe("unpublished");
    const member = await registerUser();
    await (await http()).get(`/v1/listings/${live.id}`).set(...auth(member)).expect(404);
    const arch = (await (await http()).post(`/v1/provider/listings/${live.id}/archive`).set(...auth(owner)).expect(200)).body;
    expect(arch.status).toBe("archived");
    await (await http()).patch(`/v1/provider/listings/${live.id}`).set(...auth(owner)).send({ name: "Renamed" }).expect(409);
  });

  it("won't let an edit leave a live listing incomplete", async () => {
    const staff = await staffSession();
    const owner = await makeProvider();
    const live = await liveListing(owner, staff);
    const res = await (await http()).patch(`/v1/provider/listings/${live.id}`).set(...auth(owner)).send({ description: "Too short" }).expect(422);
    expect(res.body.error.fields.description).toBeDefined();
    const ok = (await (await http()).patch(`/v1/provider/listings/${live.id}`).set(...auth(owner)).send({ priceAmount: 9900 }).expect(200)).body;
    expect(ok.priceLabel).toBe("$99.00");
  });

  it("validates availability windows", async () => {
    const owner = await makeProvider();
    const l = (await (await http()).post("/v1/provider/listings").set(...auth(owner)).send({ kind: "service", name: "Slots" }).expect(201)).body;
    const put = (windows: object[], blackouts: string[] = []) => http().then((h) => h.put(`/v1/provider/listings/${l.id}/availability`).set(...auth(owner)).send({ windows, blackouts }));
    expect((await put([{ weekday: 1, start: "10:00", end: "09:00" }])).status).toBe(422);
    expect((await put([{ weekday: 1, start: "09:00", end: "12:00" }, { weekday: 1, start: "11:00", end: "13:00" }])).status).toBe(422);
    expect((await put([{ weekday: 1, start: "9am", end: "12:00" }])).status).toBe(422);
    const ok = await put([{ weekday: 1, start: "09:00", end: "12:00" }, { weekday: 1, start: "13:00", end: "17:00" }], [day(10)]);
    expect(ok.status).toBe(200);
    expect(ok.body.blackouts).toEqual([day(10)]);
    expect(ok.body.windows).toHaveLength(2);
  });
});

describe("packages", () => {
  it("needs included services, and only accepts the provider's own", async () => {
    const staff = await staffSession();
    const owner = await makeProvider("medical_tourism");
    const svc = (await (await http()).post("/v1/provider/listings").set(...auth(owner)).send({ kind: "service", name: "Airport pickup" }).expect(201)).body;
    const stranger = await makeProvider("medical_tourism");
    const theirs = (await (await http()).post("/v1/provider/listings").set(...auth(stranger)).send({ kind: "service", name: "Their pickup" }).expect(201)).body;

    const pkgBody = {
      kind: "package", name: "Knee replacement, all inclusive", category: "complete", subcategory: "complete",
      description: "Consultation, surgery, seven nights' recovery stay and all transfers included.", priceAmount: 1_250_000, priceType: "fixed",
      durationMinutes: 60 * 24 * 9, locationModes: ["onsite"], country: "Turkey", city: "Istanbul",
      cancellationPolicy: "Refundable up to 14 days before arrival.",
      attributes: { destination_country: "Turkey", treatment_type: "Knee replacement", package_days: 9, includes_accommodation: true },
    };
    const bad = await (await http()).post("/v1/provider/listings").set(...auth(owner)).send({ ...pkgBody, includes: [{ label: "Theirs", listingId: theirs.id }] }).expect(422);
    expect(bad.body.error.fields.includes).toBeDefined();
    const pkg = (await (await http()).post("/v1/provider/listings").set(...auth(owner)).send({ ...pkgBody, includes: [{ label: "Airport pickup", listingId: svc.id }, { label: "Seven nights in a partner hotel" }] }).expect(201)).body;
    expect(pkg.includes).toHaveLength(2);
    await (await http()).put(`/v1/provider/listings/${pkg.id}/availability`).set(...auth(owner)).send({ windows: [{ weekday: 1, start: "09:00", end: "17:00" }], blackouts: [] }).expect(200);
    const empty = (await (await http()).post("/v1/provider/listings").set(...auth(owner)).send({ ...pkgBody, name: "Empty package" }).expect(201)).body;
    await (await http()).put(`/v1/provider/listings/${empty.id}/availability`).set(...auth(owner)).send({ windows: [{ weekday: 1, start: "09:00", end: "17:00" }], blackouts: [] }).expect(200);
    expect((await (await http()).post(`/v1/provider/listings/${empty.id}/publish`).set(...auth(owner)).expect(422)).body.error.fields.includes).toBeDefined();
    const pub = (await (await http()).post(`/v1/provider/listings/${pkg.id}/publish`).set(...auth(owner)).expect(200)).body;
    expect(pub.status).toBe("review");
    await (await http()).post(`/v1/staff/listings/${pkg.id}/approve`).set(...auth(staff)).expect(200);

    const member = await registerUser();
    const detail = (await (await http()).get(`/v1/listings/${pkg.id}`).set(...auth(member)).expect(200)).body;
    expect(detail).toMatchObject({ kind: "package", priceLabel: "$12,500.00" });
    expect(detail.includes.map((i: any) => i.label)).toContain("Seven nights in a partner hotel");
    expect(detail.details.map((d: any) => d.label)).toEqual(expect.arrayContaining(["Destination country", "Treatment", "Total days"]));
  });
});

describe("discovery and booking: the full workflow", () => {
  it("provider publishes → member finds it → books → provider confirms → both sides agree", async () => {
    const staff = await staffSession();
    const owner = await makeProvider();
    const live = await liveListing(owner, staff);

    // Member discovers it, filtered.
    const member = await registerUser();
    const all = (await (await http()).get("/v1/listings").set(...auth(member)).expect(200)).body;
    expect(all.some((c: any) => c.id === live.id)).toBe(true);
    const filtered = (await (await http()).get("/v1/listings").set(...auth(member)).query({ type: "vet_clinic", category: "consultation", city: "Calgary", priceMax: 100, q: "check-up" }).expect(200)).body;
    expect(filtered.map((c: any) => c.id)).toContain(live.id);
    expect(filtered.find((c: any) => c.id === live.id)).toMatchObject({ name: "Annual check-up", priceLabel: "$85.00", bookable: true });
    const wrongCity = (await (await http()).get("/v1/listings").set(...auth(member)).query({ city: "Toronto", q: "check-up" }).expect(200)).body;
    expect(wrongCity.map((c: any) => c.id)).not.toContain(live.id);
    const tooCheap = (await (await http()).get("/v1/listings").set(...auth(member)).query({ priceMax: 10, q: "check-up" }).expect(200)).body;
    expect(tooCheap.map((c: any) => c.id)).not.toContain(live.id);

    // Detail shows everything the provider entered.
    const detail = (await (await http()).get(`/v1/listings/${live.id}`).set(...auth(member)).expect(200)).body;
    expect(detail).toMatchObject({ name: "Annual check-up", providerProfile: { name: "Paws & Claws Vet", city: "Calgary" }, cancellationPolicy: "Free cancellation up to 24 hours before." });
    expect(detail.details.find((d: any) => d.label === "Animals treated").value).toBe("Dogs, Cats");

    // Slots come from the provider's weekly windows.
    const date = nextWorkday();
    const slots = (await (await http()).get(`/v1/listings/${live.id}/slots`).set(...auth(member)).query({ date }).expect(200)).body;
    expect(slots.slots.map((x: any) => x.time)).toEqual(["09:00", "09:30", "10:00", "10:30", "11:00", "11:30"]);
    const weekend = [0, 6].map((w) => day(3 + ((w - weekday(day(3)) + 7) % 7)))[0]!;
    expect((await (await http()).get(`/v1/listings/${live.id}/slots`).set(...auth(member)).query({ date: weekend }).expect(200)).body.slots).toEqual([]);

    // Book.
    const booked = (await (await http()).post(`/v1/listings/${live.id}/bookings`).set(...auth(member)).set("Idempotency-Key", key()).send({ date, time: "10:00", notes: "Rex is nervous" }).expect(201)).body;
    const mine = (await (await http()).get(`/v1/service-requests/${booked.id}`).set(...auth(member)).expect(200)).body;
    expect(mine).toMatchObject({ status: "pending", kindLabel: "Booking", preferredDate: date, preferredTime: "10:00", canCancel: true });
    expect(mine.target.name).toBe("Paws & Claws Vet");
    expect(mine.service).toMatchObject({ name: "Annual check-up", priceLabel: "$85.00" });

    // Provider sees it.
    const pb = (await (await http()).get("/v1/provider/bookings").set(...auth(owner)).query({ status: "pending" }).expect(200)).body;
    expect(pb).toHaveLength(1);
    expect(pb[0]).toMatchObject({ id: booked.id, status: "pending", date, time: "10:00", notes: "Rex is nervous", canConfirm: true });
    expect(pb[0].customer.phone).toBeNull(); // contact details wait for confirmation
    const providerNotes = (await (await http()).get("/v1/notifications").set(...auth(owner)).expect(200)).body.items;
    expect(providerNotes.some((n: any) => n.type === "provider.booking_new" && n.data.url === `medpilot://provider/bookings/${booked.id}`)).toBe(true);

    // Provider confirms; the member sees it.
    const confirmed = (await (await http()).post(`/v1/provider/bookings/${booked.id}/confirm`).set(...auth(owner)).expect(200)).body;
    expect(confirmed).toMatchObject({ status: "confirmed", canCancel: true });
    expect(confirmed.customer.phone).not.toBeNull();
    const seen = (await (await http()).get(`/v1/service-requests/${booked.id}`).set(...auth(member)).expect(200)).body;
    expect(seen.status).toBe("confirmed");
    const memberNotes = (await (await http()).get("/v1/notifications").set(...auth(member)).expect(200)).body.items;
    expect(memberNotes.some((n: any) => n.type === "service.confirmed" && n.data.url === `medpilot://requests/${booked.id}`)).toBe(true);

    // Complete only once the date has come.
    await (await http()).post(`/v1/provider/bookings/${booked.id}/complete`).set(...auth(owner)).expect(409);
    await pool.query("update service_requests set preferred_date = $2 where id = $1", [booked.id, day(-1)]);
    const done = (await (await http()).post(`/v1/provider/bookings/${booked.id}/complete`).set(...auth(owner)).expect(200)).body;
    expect(done.status).toBe("completed");
    expect((await (await http()).get(`/v1/service-requests/${booked.id}`).set(...auth(member)).expect(200)).body.status).toBe("completed");

    // Dashboard figures are backed by the records.
    const dash = (await (await http()).get("/v1/provider/dashboard").set(...auth(owner)).expect(200)).body;
    expect(dash.services).toMatchObject({ published: 1, draft: 0 });
    expect(dash.bookings).toMatchObject({ pending: 0, confirmed: 0, completed: 1 });
    expect(dash.completedValueLabel).toBe("$85.00");
    expect(dash.topListings[0]).toMatchObject({ id: live.id, bookings: 1 });
    expect(dash.topListings[0].views).toBeGreaterThanOrEqual(1);
  });

  it("lets the provider decline, and the member sees why", async () => {
    const staff = await staffSession();
    const owner = await makeProvider();
    const live = await liveListing(owner, staff);
    const member = await registerUser();
    const date = nextWorkday();
    const b = (await (await http()).post(`/v1/listings/${live.id}/bookings`).set(...auth(member)).send({ date, time: "09:00" }).expect(201)).body;
    const res = (await (await http()).post(`/v1/provider/bookings/${b.id}/decline`).set(...auth(owner)).send({ reason: "Closed that day" }).expect(200)).body;
    expect(res).toMatchObject({ status: "cancelled", cancelledReason: "Closed that day" });
    const seen = (await (await http()).get(`/v1/service-requests/${b.id}`).set(...auth(member)).expect(200)).body;
    expect(seen).toMatchObject({ status: "cancelled", cancelledReason: "Closed that day", canCancel: false });
    await (await http()).post(`/v1/provider/bookings/${b.id}/confirm`).set(...auth(owner)).expect(409);
  });

  it("frees the slot when a member cancels, and tells the provider", async () => {
    const staff = await staffSession();
    const owner = await makeProvider();
    const live = await liveListing(owner, staff, serviceBody({ capacity: 1 }));
    const a = await registerUser();
    const b = await registerUser();
    const date = nextWorkday();
    const first = (await (await http()).post(`/v1/listings/${live.id}/bookings`).set(...auth(a)).send({ date, time: "09:00" }).expect(201)).body;
    const clash = await (await http()).post(`/v1/listings/${live.id}/bookings`).set(...auth(b)).send({ date, time: "09:00" }).expect(422);
    expect(clash.body.error.fields.time).toMatch(/no longer available/i);
    await (await http()).post(`/v1/service-requests/${first.id}/cancel`).set(...auth(a)).expect(200);
    await (await http()).post(`/v1/listings/${live.id}/bookings`).set(...auth(b)).send({ date, time: "09:00" }).expect(201);
    const notes = (await (await http()).get("/v1/notifications").set(...auth(owner)).expect(200)).body.items;
    expect(notes.some((n: any) => n.type === "provider.booking_cancelled")).toBe(true);
  });

  it("enforces capacity, blackout dates, the booking window, duplicates and self-booking", async () => {
    const staff = await staffSession();
    const owner = await makeProvider();
    const live = await liveListing(owner, staff, serviceBody({ capacity: 2 }));
    const [a, b, c] = [await registerUser(), await registerUser(), await registerUser()];
    const date = nextWorkday();
    const book = (s: Session, d = date, t = "10:00") => http().then((h) => h.post(`/v1/listings/${live.id}/bookings`).set(...auth(s)).send({ date: d, time: t }));
    expect((await book(a)).status).toBe(201);
    expect((await book(a)).status).toBe(409); // same member, same time
    expect((await book(b)).status).toBe(201);
    expect((await book(c)).status).toBe(422); // capacity of two is used up
    const slots = (await (await http()).get(`/v1/listings/${live.id}/slots`).set(...auth(c)).query({ date }).expect(200)).body.slots.map((x: any) => x.time);
    expect(slots).not.toContain("10:00");
    expect(slots).toContain("10:30");
    expect((await book(c, date, "13:00")).status).toBe(422); // outside the window
    expect((await book(c, day(-1))).status).toBe(422); // past
    expect((await book(c, day(400))).status).toBe(422); // beyond a year
    expect((await book(owner)).status).toBe(409); // can't book yourself

    const blackout = nextWorkday(10);
    await (await http()).put(`/v1/provider/listings/${live.id}/availability`).set(...auth(owner))
      .send({ windows: [1, 2, 3, 4, 5].map((w) => ({ weekday: w, start: "09:00", end: "12:00" })), blackouts: [blackout] }).expect(200);
    expect((await book(c, blackout)).status).toBe(422);
  });

  it("stops offering a listing once its availability is removed", async () => {
    const staff = await staffSession();
    const owner = await makeProvider();
    const live = await liveListing(owner, staff);
    const res = (await (await http()).put(`/v1/provider/listings/${live.id}/availability`).set(...auth(owner)).send({ windows: [], blackouts: [] }).expect(200)).body;
    expect(res.listingStatus).toBe("unpublished");
    const member = await registerUser();
    await (await http()).get(`/v1/listings/${live.id}`).set(...auth(member)).expect(404);
    await (await http()).post(`/v1/listings/${live.id}/bookings`).set(...auth(member)).send({ date: nextWorkday(), time: "09:00" }).expect(404);
  });

  it("previews an unpublished listing for its owner only", async () => {
    const owner = await makeProvider();
    const l = (await (await http()).post("/v1/provider/listings").set(...auth(owner)).send(serviceBody()).expect(201)).body;
    const preview = (await (await http()).get(`/v1/listings/${l.id}`).set(...auth(owner)).query({ preview: "true" }).expect(200)).body;
    expect(preview).toMatchObject({ preview: true, isOwner: true, status: "draft" });
    await (await http()).get(`/v1/listings/${l.id}`).set(...auth(owner)).expect(404); // not previewing: it isn't public
    const other = await registerUser();
    await (await http()).get(`/v1/listings/${l.id}`).set(...auth(other)).query({ preview: "true" }).expect(404);
  });
});

describe("provider permissions", () => {
  it("keeps one provider away from another's listings, bookings and availability", async () => {
    const staff = await staffSession();
    const a = await makeProvider();
    const b = await makeProvider();
    const live = await liveListing(a, staff);
    for (const [method, url] of [
      ["get", `/v1/provider/listings/${live.id}`], ["patch", `/v1/provider/listings/${live.id}`], ["post", `/v1/provider/listings/${live.id}/publish`],
      ["post", `/v1/provider/listings/${live.id}/unpublish`], ["post", `/v1/provider/listings/${live.id}/archive`], ["post", `/v1/provider/listings/${live.id}/duplicate`],
      ["delete", `/v1/provider/listings/${live.id}`], ["get", `/v1/provider/listings/${live.id}/availability`], ["put", `/v1/provider/listings/${live.id}/availability`],
    ] as const) {
      const res = await (await http())[method](url).set(...auth(b)).send({ name: "Hijack", windows: [], blackouts: [] });
      expect([404, 422]).toContain(res.status);
      expect(res.status).not.toBe(200);
    }
    const member = await registerUser();
    const bk = (await (await http()).post(`/v1/listings/${live.id}/bookings`).set(...auth(member)).send({ date: nextWorkday(), time: "09:00" }).expect(201)).body;
    await (await http()).get(`/v1/provider/bookings/${bk.id}`).set(...auth(b)).expect(404);
    await (await http()).post(`/v1/provider/bookings/${bk.id}/confirm`).set(...auth(b)).expect(404);
    expect((await (await http()).get("/v1/provider/bookings").set(...auth(b)).expect(200)).body).toEqual([]);
    expect((await (await http()).get("/v1/provider/listings").set(...auth(b)).expect(200)).body).toEqual([]);
    // Unchanged for the real owner.
    expect((await (await http()).get(`/v1/provider/listings/${live.id}`).set(...auth(a)).expect(200)).body.name).toBe("Annual check-up");
  });

  it("keeps the staff surface closed to providers and members", async () => {
    const owner = await makeProvider();
    const id = "00000000-0000-4000-8000-000000000000";
    await (await http()).post(`/v1/staff/providers/${id}/verify`).set(...auth(owner)).expect(403);
    await (await http()).post(`/v1/staff/listings/${id}/approve`).set(...auth(owner)).expect(403);
    await (await http()).get("/v1/staff/vendor-queue").set(...auth(owner)).expect(403);
  });
});
