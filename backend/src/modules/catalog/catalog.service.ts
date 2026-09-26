import { Inject, Injectable } from "@nestjs/common";
import { containsPattern } from "../../common/like";
import { and, asc, desc, eq, ilike, or, sql } from "drizzle-orm";
import type { Db } from "../../db/client";
import { schema as s } from "../../db/client";
import { AppError } from "../../common/errors";

const published = <T extends { status: any }>(t: T) => eq(t.status, "published" as never);

/** Read side of the public catalog. Everything here is member-visible data. */
@Injectable()
export class CatalogService {
  constructor(@Inject("DB") private readonly db: Db) {}

  // ---- hospitals ---------------------------------------------------------
  async listHospitals(q?: string) {
    const base = this.db.select().from(s.hospitals).where(
      q
        ? and(published(s.hospitals), or(
            ilike(s.hospitals.name, containsPattern(q)),
            ilike(s.hospitals.specialty, containsPattern(q)),
            ilike(s.hospitals.countryLabel, containsPattern(q)),
          ))
        : published(s.hospitals),
    ).orderBy(asc(s.hospitals.name)).limit(50);
    return (await base).map(this.hospitalCard);
  }

  private hospitalCard = (h: typeof s.hospitals.$inferSelect) => ({
    id: h.id, slug: h.slug, name: h.name, specialty: h.specialty,
    country: h.countryLabel, specialistCount: h.specialistCount,
    logoAsset: h.logoAsset, rating: Number(h.rating),
  });

  async hospitalDetail(id: string) {
    const [h] = await this.db.select().from(s.hospitals)
      .where(and(eq(s.hospitals.id, id), published(s.hospitals))).limit(1);
    if (!h) throw AppError.notFound("Hospital");
    const specs = await this.db.select({ sp: s.specialists })
      .from(s.hospitalSpecialists)
      .innerJoin(s.specialists, eq(s.specialists.id, s.hospitalSpecialists.specialistId))
      .where(eq(s.hospitalSpecialists.hospitalId, id))
      .orderBy(asc(s.hospitalSpecialists.sortOrder));
    return {
      ...this.hospitalCard(h),
      about: h.about, careSystem: h.careSystem,
      openHours: h.openHours, openHoursNote: h.openHoursNote,
      helipadCode: h.helipadCode, accredited: h.accredited, bookable: h.bookable,
      latitude: h.latitude ? Number(h.latitude) : null,
      longitude: h.longitude ? Number(h.longitude) : null,
      specialists: specs.map(({ sp }) => this.specialistCard(sp)),
    };
  }

  // No rating: members book the hospital, never these specialists directly, so nothing could ever rate them.
  private specialistCard = (sp: typeof s.specialists.$inferSelect) => ({
    id: sp.id, name: sp.fullName, cardName: sp.shortName, role: sp.role,
    photoAsset: sp.photoAsset, available: sp.available,
  });

  async specialistDetail(id: string) {
    const [sp] = await this.db.select().from(s.specialists)
      .where(and(eq(s.specialists.id, id), published(s.specialists))).limit(1);
    if (!sp) throw AppError.notFound("Specialist");
    return {
      ...this.specialistCard(sp),
      certified: sp.certified,
      specialization: sp.specialization,
      experience: sp.experienceLabel,
      operationCountry: sp.operationCountry,
      operationCountryNote: sp.otherCountries,
      languages: sp.languages,
      expertise: sp.expertise,
    };
  }

  // ---- packages ----------------------------------------------------------
  async listPackages(q?: string) {
    const rows = await this.db.select({ p: s.medicalPackages, h: s.hospitals })
      .from(s.medicalPackages)
      .innerJoin(s.hospitals, eq(s.hospitals.id, s.medicalPackages.hospitalId))
      .where(q
        ? and(published(s.medicalPackages), ilike(s.medicalPackages.title, containsPattern(q)))
        : published(s.medicalPackages))
      .orderBy(asc(s.medicalPackages.createdAt)).limit(50);
    const inclusions = await this.db.select().from(s.packageInclusions).orderBy(asc(s.packageInclusions.sortOrder));
    const byPkg = new Map<string, string[]>();
    for (const i of inclusions) (byPkg.get(i.packageId) ?? byPkg.set(i.packageId, []).get(i.packageId)!).push(i.label);
    return rows.map(({ p, h }) => this.packageCard(p, h, byPkg.get(p.id) ?? []));
  }

  private packageCard = (
    p: typeof s.medicalPackages.$inferSelect,
    h: typeof s.hospitals.$inferSelect,
    inclusions: string[],
  ) => ({
    id: p.id, slug: p.slug, title: p.title,
    // A package is booked as an appointment at its hospital, so it carries the hospital's rating.
    priceLabel: p.priceLabel, location: p.locationLabel, rating: Number(h.rating),
    description: p.description, heroAsset: p.heroAsset,
    packageInclude: inclusions,
    hospital: this.hospitalCard(h),
  });

  async packageDetail(id: string) {
    const [row] = await this.db.select({ p: s.medicalPackages, h: s.hospitals })
      .from(s.medicalPackages)
      .innerJoin(s.hospitals, eq(s.hospitals.id, s.medicalPackages.hospitalId))
      .where(and(eq(s.medicalPackages.id, id), published(s.medicalPackages))).limit(1);
    if (!row) throw AppError.notFound("Package");
    const incl = await this.db.select().from(s.packageInclusions)
      .where(eq(s.packageInclusions.packageId, id)).orderBy(asc(s.packageInclusions.sortOrder));
    const hospital = await this.hospitalDetail(row.h.id);
    const provider = row.p.transportProviderId
      ? await this.providerDetail(row.p.transportProviderId).catch(() => null)
      : null;
    return {
      ...this.packageCard(row.p, row.h, incl.map((i) => i.label)),
      hospital,
      transportProvider: provider,
      costSummary: {
        treatmentLabel: row.p.priceLabel,
        transportationLabel: "$2,450.00",
        accommodation: "Included",
        feeding: "Included",
        totalLabel: row.p.priceLabel,
      },
    };
  }

  // ---- transport providers ----------------------------------------------
  async listProviders(category?: "jet" | "ambulance" | "boat") {
    const rows = await this.db.select().from(s.transportProviders)
      .where(category
        ? and(published(s.transportProviders), eq(s.transportProviders.category, category))
        : published(s.transportProviders))
      .orderBy(asc(s.transportProviders.createdAt)).limit(50);
    return rows.map(this.providerCard);
  }

  private providerCard = (p: typeof s.transportProviders.$inferSelect) => ({
    id: p.id, name: p.name, category: p.category, location: p.location,
    rating: Number(p.rating), verified: p.verified,
    priceFromLabel: p.priceFromAmount != null
      ? `$${(p.priceFromAmount / 100).toLocaleString("en-US", { minimumFractionDigits: 2 })}`
      : null,
    description: p.description, routes: p.routes, tags: p.tags,
    heroAsset: p.heroAsset, logoAsset: p.logoAsset,
  });

  async providerDetail(id: string) {
    const [p] = await this.db.select().from(s.transportProviders)
      .where(and(eq(s.transportProviders.id, id), published(s.transportProviders))).limit(1);
    if (!p) throw AppError.notFound("Provider");
    const fleet = await this.db.select().from(s.aircraft)
      .where(and(eq(s.aircraft.providerId, id), eq(s.aircraft.active, true)));
    const facs = await this.db.select().from(s.aircraftFacilities).orderBy(asc(s.aircraftFacilities.sortOrder));
    const byAc = new Map<string, { label: string; imageAsset: string | null }[]>();
    for (const f of facs) (byAc.get(f.aircraftId) ?? byAc.set(f.aircraftId, []).get(f.aircraftId)!)
      .push({ label: f.label, imageAsset: f.imageAsset });
    return {
      ...this.providerCard(p),
      aircraft: fleet.map((a) => ({
        id: a.id, name: a.name, capacity: a.capacityLabel, capacityNote: a.capacityNote,
        medicalCrew: a.medicalCrew, medicalCrewNote: a.medicalCrewNote,
        paramedic: a.paramedicLabel, maxAltitude: a.maxAltitudeM, maxAltitudeFt: a.maxAltitudeFt,
        priceLabel: a.priceAmount != null
          ? `$${(a.priceAmount / 100).toLocaleString("en-US", { minimumFractionDigits: 2 })}`
          : null,
        heroAsset: a.heroAsset,
        facilities: byAc.get(a.id) ?? [],
      })),
    };
  }

  async aircraftDetail(id: string) {
    const [a] = await this.db.select().from(s.aircraft).where(eq(s.aircraft.id, id)).limit(1);
    if (!a || !a.active) throw AppError.notFound("Aircraft");
    const detail = await this.providerDetail(a.providerId);
    return detail.aircraft.find((x) => x.id === id)!;
  }

  // ---- pet clinics / services / reference --------------------------------
  async listPetClinics(category?: "vet" | "pedicure" | "sitters") {
    const rows = await this.db.select().from(s.petClinics)
      .where(category
        ? and(published(s.petClinics), eq(s.petClinics.category, category))
        : published(s.petClinics))
      .orderBy(asc(s.petClinics.createdAt)).limit(50);
    return rows.map((c) => ({
      id: c.id, name: c.name, category: c.category, location: c.location,
      rating: Number(c.rating), verified: c.verified,
      priceFromLabel: c.priceFromAmount != null
        ? `$${(c.priceFromAmount / 100).toLocaleString("en-US", { minimumFractionDigits: 2 })}`
        : null,
      description: c.description, openTo: c.openTo,
      logoEmoji: c.logoEmoji, heroAsset: c.heroAsset,
    }));
  }

  async listServices() {
    const rows = await this.db.select().from(s.serviceCategories)
      .where(eq(s.serviceCategories.active, true)).orderBy(asc(s.serviceCategories.sortOrder));
    return rows.map((c) => ({
      id: c.id, code: c.code, title: c.title, description: c.description,
      color: c.colorHex, imageAsset: c.imageAsset,
    }));
  }

  async reference() {
    const [purposes, needs, symptoms, triage, conds] = await Promise.all([
      this.db.select().from(s.transportPurposes).where(eq(s.transportPurposes.active, true)).orderBy(asc(s.transportPurposes.sortOrder)),
      this.db.select().from(s.specialNeeds).where(eq(s.specialNeeds.active, true)).orderBy(asc(s.specialNeeds.sortOrder)),
      this.db.select().from(s.triageSymptoms).where(eq(s.triageSymptoms.active, true)).orderBy(asc(s.triageSymptoms.sortOrder)),
      this.db.select().from(s.triageConditions).where(eq(s.triageConditions.active, true)).orderBy(asc(s.triageConditions.sortOrder)),
      this.db.select().from(s.conditions).where(eq(s.conditions.active, true)).orderBy(asc(s.conditions.sortOrder)),
    ]);
    return {
      appointmentTypes: [
        { code: "general_checkup", label: "General Check-up" },
        { code: "specialist_consultation", label: "Specialist Consultation" },
        { code: "surgery", label: "Surgery" },
      ],
      transportPurposes: purposes.map((p) => ({ id: p.id, code: p.code, label: p.label })),
      specialNeeds: needs.map((n) => ({ id: n.id, code: n.code, label: n.label })),
      triageSymptoms: symptoms.map((x) => ({ id: x.id, code: x.code, label: x.label, emoji: x.emoji })),
      triageConditions: triage.map((x) => ({ id: x.id, code: x.code, label: x.label, emoji: x.emoji })),
      // medical-history checklist options
      conditions: conds.map((c) => ({ id: c.id, code: c.code, label: c.label })),
      relationships: ["partner", "parent", "sibling", "friend", "other"],
    };
  }

  /** The one screen-shaped aggregate (spec §03): Home's five collections in one call. */
  async home() {
    const now = new Date();
    const [slides, services, packages, indies, hospitalRows] = await Promise.all([
      this.db.select().from(s.promoSlides).orderBy(asc(s.promoSlides.sortOrder)),
      this.listServices(),
      this.listPackages(),
      this.db.select().from(s.independentSpecialistCategories)
        .where(eq(s.independentSpecialistCategories.active, true))
        .orderBy(asc(s.independentSpecialistCategories.sortOrder)),
      this.listHospitals(),
    ]);
    return {
      heroSlides: slides
        .filter((x) => (!x.activeFrom || x.activeFrom <= now) && (!x.activeTo || x.activeTo >= now))
        .map((x) => ({
          id: x.id, title: x.title, subtitle: x.subtitle,
          priceLabel: x.priceLabel, packageId: x.packageId, imageAsset: x.imageAsset,
        })),
      services,
      packages: packages.slice(0, 3),
      independentSpecialists: indies.map((x) => ({
        id: x.id, title: x.title, count: x.countLabel, imageAsset: x.imageAsset,
      })),
      hospitals: hospitalRows,
    };
  }
}
