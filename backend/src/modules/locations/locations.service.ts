import { Inject, Injectable } from "@nestjs/common";
import { and, eq } from "drizzle-orm";
import type { Db } from "../../db/client";
import { schema as s } from "../../db/client";
import { AppError } from "../../common/errors";

type Loc = typeof s.locations.$inferSelect;
type Coverage = "full" | "partial";

const CATEGORY_LABEL = { jet: "Private Jet", ambulance: "Medical Ambulance", boat: "Speed Boat" } as const;
const CATEGORIES = ["jet", "ambulance", "boat"] as const;

/** Case-, accent- and punctuation-insensitive form used for name matching. */
const norm = (v: string) =>
  v.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^a-z0-9 ]/g, "").trim();

/**
 * The location tree is small (countries, regions, cities), so it is read whole
 * and reasoned about in memory. That keeps the ancestor/descendant coverage
 * rules in one readable place instead of recursive SQL.
 */
@Injectable()
export class LocationsService {
  constructor(@Inject("DB") private readonly db: Db) {}

  private async tree() {
    const all = await this.db.select().from(s.locations);
    const byId = new Map(all.map((l) => [l.id, l]));
    const ancestors = (l: Loc): Loc[] => {
      const out: Loc[] = [];
      for (let p = l.parentId ? byId.get(l.parentId) : undefined; p; p = p.parentId ? byId.get(p.parentId) : undefined) out.push(p);
      return out;
    };
    const descendants = (id: string): Loc[] => {
      const out: Loc[] = [];
      const walk = (pid: string) => {
        for (const l of all) if (l.parentId === pid) { out.push(l); walk(l.id); }
      };
      walk(id);
      return out;
    };
    return { all, byId, ancestors, descendants };
  }

  private view = (l: Loc, coverage?: Coverage) => ({
    id: l.id, parentId: l.parentId, level: l.level as "country" | "region" | "city",
    name: l.name, code: l.code, hasAirport: l.hasAirport, hasHelipad: l.hasHelipad,
    latitude: l.latitude != null ? Number(l.latitude) : null,
    longitude: l.longitude != null ? Number(l.longitude) : null,
    ...(coverage ? { coverage } : {}),
  });

  /**
   * Children of a node (or the countries when no parent is given).
   * With `coveredBy`, only places the provider actually serves are returned, so
   * a form never offers a pickup the chosen provider can't reach.
   */
  async children(parentId: string | undefined, coveredBy?: string) {
    const { all, byId, ancestors, descendants } = await this.tree();
    if (parentId && !byId.has(parentId)) throw AppError.notFound("Location");
    let nodes = all.filter((l) => (parentId ? l.parentId === parentId : l.parentId === null));
    nodes.sort((a, b) => a.sortOrder - b.sortOrder || a.name.localeCompare(b.name));

    if (!coveredBy) return nodes.map((l) => this.view(l));

    const covered = new Set(
      (await this.db.select().from(s.transportProviderCoverage)
        .where(eq(s.transportProviderCoverage.providerId, coveredBy))).map((r) => r.locationId),
    );
    const out: ReturnType<LocationsService["view"]>[] = [];
    nodes = nodes.filter((l) => {
      const full = covered.has(l.id) || ancestors(l).some((a) => covered.has(a.id));
      const partial = !full && descendants(l.id).some((d) => covered.has(d.id));
      if (full || partial) out.push(this.view(l, full ? "full" : "partial"));
      return full || partial;
    });
    return out;
  }

  /**
   * Maps geocoder output (country/region/city names, which vary in spelling and
   * language) onto tree nodes. Falls back level by level, so a city we don't
   * list still resolves to its region or country instead of failing outright.
   */
  async resolve(input: { country?: string; region?: string; city?: string }) {
    const { all } = await this.tree();
    const matches = (l: Loc, wanted: string) => {
      const w = norm(wanted);
      if (!w) return false;
      const names = [l.name, l.code ?? "", ...l.aliases.split(",")].map(norm).filter(Boolean);
      return names.includes(w);
    };
    const find = (level: string, parent: Loc | null, wanted?: string) =>
      wanted
        ? all.find((l) => l.level === level && (parent ? l.parentId === parent.id : true) && matches(l, wanted)) ?? null
        : null;

    const country = find("country", null, input.country);
    // Regions and cities are looked up under the country when we found one, and
    // anywhere otherwise (a geocoder may omit the country).
    const region = find("region", country, input.region);
    const city =
      find("city", region, input.city) ??
      (input.city ? find("city", country && !region ? null : region, input.city) : null);

    const resolvedCountry = country ?? (region ? all.find((l) => l.id === region.parentId) ?? null : null);
    const resolvedRegion = region ?? (city ? all.find((l) => l.id === city.parentId) ?? null : null);
    const deepest = city ?? resolvedRegion ?? resolvedCountry;
    return {
      matched: !!deepest,
      matchedLevel: (deepest?.level ?? null) as "country" | "region" | "city" | null,
      country: resolvedCountry ? this.view(resolvedCountry) : null,
      region: resolvedRegion ? this.view(resolvedRegion) : null,
      city: city ? this.view(city) : null,
    };
  }

  /** Breadcrumb from the country down to the node, for display. */
  async path(id: string) {
    const { byId, ancestors } = await this.tree();
    const l = byId.get(id);
    if (!l) throw AppError.notFound("Location");
    return [...ancestors(l).reverse(), l].map((x) => this.view(x));
  }

  /**
   * Which transport services can reach a place.
   *
   * A provider serving a region covers every city inside it, so a city with no
   * listing of its own is still reached through its region or country. When the
   * chosen place is broad (a country or region), providers serving only some of
   * the cities inside it are reported as partial rather than hidden or oversold.
   */
  async availability(locationId: string) {
    const { byId, ancestors, descendants } = await this.tree();
    const target = byId.get(locationId);
    if (!target) throw AppError.notFound("Location");

    const chain = [target, ...ancestors(target)]; // target, then broader places
    const chainIds = new Set(chain.map((l) => l.id));
    const inside = new Set(descendants(target.id).map((l) => l.id));

    const coverage = await this.db.select().from(s.transportProviderCoverage);
    const providers = await this.db.select().from(s.transportProviders)
      .where(eq(s.transportProviders.status, "published"));

    const best = new Map<string, { how: Coverage; via: Loc }>();
    for (const row of coverage) {
      const via = byId.get(row.locationId);
      if (!via) continue;
      let how: Coverage | null = null;
      if (chainIds.has(via.id)) how = "full";
      else if (inside.has(via.id)) how = "partial";
      if (!how) continue;
      const prev = best.get(row.providerId);
      if (!prev || (prev.how === "partial" && how === "full")) best.set(row.providerId, { how, via });
    }

    const priceLabel = (a: number | null) =>
      a != null ? `$${(a / 100).toLocaleString("en-US", { minimumFractionDigits: 2 })}` : null;

    const services = CATEGORIES.map((category) => {
      const list = providers
        .filter((p) => p.category === category && best.has(p.id))
        .map((p) => {
          const b = best.get(p.id)!;
          return {
            id: p.id, name: p.name, rating: Number(p.rating), verified: p.verified,
            priceFromLabel: priceLabel(p.priceFromAmount), logoAsset: p.logoAsset, heroAsset: p.heroAsset,
            tags: p.tags, coverage: b.how, servedVia: b.via.name,
          };
        })
        .sort((a, b) => (a.coverage === b.coverage ? b.rating - a.rating : a.coverage === "full" ? -1 : 1));
      const anyFull = list.some((p) => p.coverage === "full");
      return {
        category, label: CATEGORY_LABEL[category], available: list.length > 0,
        coverage: (list.length === 0 ? "none" : anyFull ? "full" : "partial") as "none" | "full" | "partial",
        providers: list,
      };
    });

    return {
      location: this.view(target),
      path: [...ancestors(target).reverse(), target].map((l) => l.name),
      services,
      anyAvailable: services.some((x) => x.available),
    };
  }

  /** A provider's covered places, for display ("Serves: Alberta, Ontario, …"). */
  async coverageOf(providerId: string) {
    const rows = await this.db.select({ l: s.locations }).from(s.transportProviderCoverage)
      .innerJoin(s.locations, eq(s.locations.id, s.transportProviderCoverage.locationId))
      .where(eq(s.transportProviderCoverage.providerId, providerId));
    return rows.map((r) => r.l.name);
  }

  /** True when the provider serves this place (used to validate a booking's pickup). */
  async providerServes(providerId: string, locationId: string): Promise<boolean> {
    const { byId, ancestors } = await this.tree();
    const target = byId.get(locationId);
    if (!target) return false;
    const ids = new Set([target.id, ...ancestors(target).map((a) => a.id)]);
    const rows = await this.db.select().from(s.transportProviderCoverage)
      .where(and(eq(s.transportProviderCoverage.providerId, providerId)));
    return rows.some((r) => ids.has(r.locationId));
  }
}
