import { closeApp, http, registerUser } from "./helpers";
afterAll(closeApp);

type Loc = { id: string; name: string; level: string; coverage?: string };

/** Walks country -> region -> city by name against the live tree. */
async function idOf(auth: string, ...path: string[]): Promise<string> {
  let parent: string | undefined;
  let found: Loc | undefined;
  for (const name of path) {
    const res = await (await http()).get("/v1/locations").set("Authorization", auth)
      .query(parent ? { parentId: parent } : {}).expect(200);
    found = (res.body as Loc[]).find((l) => l.name === name);
    if (!found) throw new Error(`no location ${path.join("/")}`);
    parent = found.id;
  }
  return found!.id;
}

const availability = async (auth: string, id: string) =>
  (await (await http()).get("/v1/transport/availability").set("Authorization", auth).query({ locationId: id }).expect(200)).body as {
    path: string[]; anyAvailable: boolean;
    services: { category: string; available: boolean; coverage: string; providers: { name: string; coverage: string; servedVia: string }[] }[];
  };
const svc = (a: Awaited<ReturnType<typeof availability>>, c: string) => a.services.find((s) => s.category === c)!;

describe("location tree", () => {
  it("lists countries first, then narrows by parent", async () => {
    const s = await registerUser();
    const countries = (await (await http()).get("/v1/locations").set("Authorization", s.auth).expect(200)).body as Loc[];
    expect(countries.map((c) => c.name)).toEqual(expect.arrayContaining(["Canada", "United States", "United Arab Emirates"]));
    expect(countries.every((c) => c.level === "country")).toBe(true);

    const canada = countries.find((c) => c.name === "Canada")!;
    const regions = (await (await http()).get("/v1/locations").set("Authorization", s.auth).query({ parentId: canada.id }).expect(200)).body as Loc[];
    expect(regions.map((r) => r.name)).toEqual(expect.arrayContaining(["Ontario", "Alberta"]));
    // No Canadian list contains a UAE emirate: dependent dropdowns must not leak across parents.
    expect(regions.map((r) => r.name)).not.toContain("Dubai");
  });

  it("rejects an unknown parent with 404 and a malformed one with 422", async () => {
    const s = await registerUser();
    await (await http()).get("/v1/locations").set("Authorization", s.auth)
      .query({ parentId: "00000000-0000-4000-8000-000000000000" }).expect(404);
    await (await http()).get("/v1/locations").set("Authorization", s.auth).query({ parentId: "nope" }).expect(422);
  });

  it("requires authentication", async () => {
    await (await http()).get("/v1/locations").expect(401);
  });
});

describe("transport availability", () => {
  it("Toronto: ambulance and jet, but no speed boat (inland)", async () => {
    const s = await registerUser();
    const a = await availability(s.auth, await idOf(s.auth, "Canada", "Ontario", "Toronto"));
    expect(a.path).toEqual(["Canada", "Ontario", "Toronto"]);
    expect(svc(a, "ambulance").available).toBe(true);
    expect(svc(a, "jet").available).toBe(true);
    expect(svc(a, "boat").available).toBe(false);
    expect(svc(a, "boat").providers).toEqual([]);
  });

  it("Vancouver: boats are available because a marine provider serves the city itself", async () => {
    const s = await registerUser();
    const a = await availability(s.auth, await idOf(s.auth, "Canada", "British Columbia", "Vancouver"));
    expect(svc(a, "boat").available).toBe(true);
    expect(svc(a, "boat").providers[0]).toMatchObject({ name: "Harbour Medevac Marine", coverage: "full", servedVia: "Vancouver" });
  });

  it("falls back to the broader region: Calgary is reached via Alberta coverage", async () => {
    const s = await registerUser();
    const a = await availability(s.auth, await idOf(s.auth, "Canada", "Alberta", "Calgary"));
    const jet = svc(a, "jet").providers.find((p) => p.name.startsWith("Uber"));
    expect(jet).toMatchObject({ coverage: "full", servedVia: "Alberta" });
  });

  it("Montreal (Quebec): no jet operator serves it, and the response says so", async () => {
    const s = await registerUser();
    const a = await availability(s.auth, await idOf(s.auth, "Canada", "Quebec", "Montreal"));
    expect(svc(a, "jet").available).toBe(false);
    expect(svc(a, "jet").coverage).toBe("none");
    expect(svc(a, "ambulance").available).toBe(true); // country-wide ambulance cover
    expect(a.anyAvailable).toBe(true);
  });

  it("a whole country reports partial coverage where only some cities are served", async () => {
    const s = await registerUser();
    const a = await availability(s.auth, await idOf(s.auth, "Canada"));
    expect(svc(a, "ambulance").coverage).toBe("full");
    expect(svc(a, "boat").coverage).toBe("partial"); // only Vancouver and Victoria
    expect(svc(a, "boat").providers[0]!.coverage).toBe("partial");
  });

  it("Dubai: jet via UAE-wide cover, boat via the city, ambulance via country", async () => {
    const s = await registerUser();
    const a = await availability(s.auth, await idOf(s.auth, "United Arab Emirates", "Dubai", "Dubai"));
    expect(svc(a, "jet").providers.map((p) => p.name)).toContain("Gulf Air Rescue");
    expect(svc(a, "boat").available).toBe(true);
    expect(svc(a, "ambulance").available).toBe(true);
  });

  it("London (UK): ambulance only", async () => {
    const s = await registerUser();
    const a = await availability(s.auth, await idOf(s.auth, "United Kingdom", "England", "London"));
    expect(svc(a, "ambulance").available).toBe(true);
    expect(svc(a, "jet").available).toBe(false);
    expect(svc(a, "boat").available).toBe(false);
  });

  it("404s for an unknown location", async () => {
    const s = await registerUser();
    await (await http()).get("/v1/transport/availability").set("Authorization", s.auth)
      .query({ locationId: "00000000-0000-4000-8000-000000000000" }).expect(404);
  });
});

describe("provider-restricted pickup lists", () => {
  it("only offers places the provider actually serves", async () => {
    const s = await registerUser();
    const providers = (await (await http()).get("/v1/transport-providers").set("Authorization", s.auth).expect(200)).body as { id: string; name: string }[];
    const uber = providers.find((p) => p.name.startsWith("Uber"))!;
    const canada = await idOf(s.auth, "Canada");

    const regions = (await (await http()).get("/v1/locations").set("Authorization", s.auth)
      .query({ parentId: canada, coveredBy: uber.id }).expect(200)).body as Loc[];
    expect(regions.map((r) => r.name).sort()).toEqual(["Alberta", "British Columbia", "Ontario"]);
    expect(regions.map((r) => r.name)).not.toContain("Quebec");

    const countries = (await (await http()).get("/v1/locations").set("Authorization", s.auth)
      .query({ coveredBy: uber.id }).expect(200)).body as Loc[];
    expect(countries.map((c) => c.name).sort()).toEqual(["Canada", "United States"]);
  });
});

describe("address resolution", () => {
  const resolve = async (q: Record<string, string>) => {
    const s = await registerUser();
    return (await (await http()).get("/v1/locations/resolve").set("Authorization", s.auth).query(q).expect(200)).body;
  };

  it("matches a full geocoded address", async () => {
    const r = await resolve({ country: "Canada", region: "Ontario", city: "Toronto" });
    expect(r).toMatchObject({ matched: true, matchedLevel: "city" });
    expect(r.city.name).toBe("Toronto");
  });

  it("understands codes and aliases: 'USA', 'ON', 'NYC'", async () => {
    expect((await resolve({ country: "USA" })).country.name).toBe("United States");
    expect((await resolve({ country: "Canada", region: "ON" })).region.name).toBe("Ontario");
    expect((await resolve({ city: "NYC" })).city.name).toBe("New York City");
  });

  it("ignores accents and case: 'Montréal', 'TORONTO'", async () => {
    expect((await resolve({ city: "Montréal" })).city.name).toBe("Montreal");
    expect((await resolve({ city: "TORONTO" })).city.name).toBe("Toronto");
  });

  it("falls back to the region when the city isn't listed", async () => {
    const r = await resolve({ country: "Canada", region: "Ontario", city: "Hamilton" });
    expect(r).toMatchObject({ matched: true, matchedLevel: "region" });
    expect(r.city).toBeNull();
    expect(r.region.name).toBe("Ontario");
  });

  it("falls back to the country when only the country is known", async () => {
    const r = await resolve({ country: "Canada", region: "Nunavut", city: "Iqaluit" });
    expect(r).toMatchObject({ matched: true, matchedLevel: "country" });
  });

  it("reports an unknown place as unmatched rather than guessing", async () => {
    const r = await resolve({ country: "Atlantis" });
    expect(r).toMatchObject({ matched: false, matchedLevel: null, country: null });
  });
});
