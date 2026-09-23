import { Inject, Injectable } from "@nestjs/common";
import { and, asc, desc, eq, ilike, inArray, isNull, lte, or, sql } from "drizzle-orm";
import { randomInt } from "node:crypto";
import { uuidv7 } from "uuidv7";
import { z } from "zod";
import type { Db } from "../../db/client";
import { schema as s } from "../../db/client";
import { AppError } from "../../common/errors";
import { containsPattern } from "../../common/like";
import { AuditService } from "../auth/audit.service";
import { NotificationsService } from "../notifications/notifications.service";
import {
  AvailabilityBody, BookListingBody, CreateListingBody, CreateProviderBody, DiscoverQuery, ListingsQuery,
  PatchListingBody, PatchProviderBody,
} from "./vendors.schemas";
import { categoryLabel, fieldsFor, LOCATION_MODES, PRICE_TYPES, PROVIDER_TYPES, typeOf } from "./taxonomy";

type Provider = typeof s.providers.$inferSelect;
type Listing = typeof s.listings.$inferSelect;

const BOOKING_WINDOW_DAYS = 365;
const BOOKING_ACTIVE = ["pending", "confirmed"];
const money = (amount: number | null, currency = "USD") =>
  amount == null ? null : `${currency === "USD" ? "$" : `${currency} `}${(amount / 100).toLocaleString("en-US", { minimumFractionDigits: 2 })}`;
const utcToday = () => new Date().toISOString().slice(0, 10);
const addDays = (iso: string, n: number) => new Date(Date.parse(`${iso}T00:00:00Z`) + n * 86_400_000).toISOString().slice(0, 10);
const csv = (v: string) => (v ? v.split(",").map((x) => x.trim()).filter(Boolean) : []);
const json = <T,>(v: string, fallback: T): T => { try { return JSON.parse(v) as T; } catch { return fallback; } };
const toMin = (hhmm: string) => Number(hhmm.slice(0, 2)) * 60 + Number(hhmm.slice(3, 5));
const fromMin = (m: number) => `${String(Math.floor(m / 60)).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`;
const blankToNull = (v: string | null | undefined) => (v === undefined ? undefined : v === "" ? null : v);

@Injectable()
export class VendorsService {
  constructor(
    @Inject("DB") private readonly db: Db,
    private readonly audit: AuditService,
    private readonly notifications: NotificationsService,
  ) {}

  // ---- provider profile -------------------------------------------------------------------------------
  private async mine(userId: string): Promise<Provider | null> {
    const [p] = await this.db.select().from(s.providers)
      .where(and(eq(s.providers.ownerUserId, userId), isNull(s.providers.deletedAt))).limit(1);
    return p ?? null;
  }
  /** Every provider route starts here: the caller must own a provider account. */
  private async requireProvider(userId: string): Promise<Provider> {
    const p = await this.mine(userId);
    if (!p) throw new AppError("forbidden", "You don't have a provider account yet");
    return p;
  }

  /** What the profile still needs before its listings can go live. */
  private profileGaps(p: Provider): Record<string, string> {
    const gaps: Record<string, string> = {};
    if (p.description.trim().length < 20) gaps.description = "Describe your business in at least 20 characters";
    if (!p.phone && !p.email) gaps.phone = "Add a phone number or email customers can use";
    if (!p.country) gaps.country = "Choose your country";
    if (!p.city) gaps.city = "Enter your city";
    return gaps;
  }

  private providerView(p: Provider) {
    const gaps = this.profileGaps(p);
    return {
      id: p.id, type: p.type, typeLabel: typeOf(p.type)?.label ?? p.type, name: p.name, description: p.description,
      phone: p.phone, email: p.email, website: p.website, address: p.address, country: p.country, region: p.region, city: p.city,
      serviceAreas: p.serviceAreas, operatingHours: p.operatingHours, languages: p.languages, certifications: p.certifications,
      logoUrl: p.logoUrl, coverUrl: p.coverUrl,
      verificationStatus: p.verificationStatus, verificationInfo: p.verificationInfo, verificationNote: p.verificationNote,
      profileComplete: Object.keys(gaps).length === 0, profileGaps: gaps, createdAt: p.createdAt,
    };
  }
  private publicProvider(p: Provider) {
    return {
      id: p.id, name: p.name, type: p.type, typeLabel: typeOf(p.type)?.label ?? p.type,
      verified: p.verificationStatus === "verified", description: p.description, city: p.city, region: p.region, country: p.country,
      languages: csv(p.languages), operatingHours: p.operatingHours, phone: p.phone, email: p.email, website: p.website,
      logoUrl: p.logoUrl, coverUrl: p.coverUrl, certifications: p.certifications, address: p.address, serviceAreas: p.serviceAreas,
    };
  }

  async getMine(userId: string) {
    const p = await this.mine(userId);
    return { provider: p ? this.providerView(p) : null };
  }

  async createProvider(userId: string, input: z.infer<typeof CreateProviderBody>) {
    if (await this.mine(userId)) throw new AppError("conflict", "You already have a provider account");
    const id = uuidv7();
    // Local development can skip staff review so the whole flow is testable; production never does.
    const autoVerify = process.env.NODE_ENV !== "production" && process.env.PROVIDER_AUTO_VERIFY === "true";
    await this.db.insert(s.providers).values({
      id, ownerUserId: userId, type: input.type, name: input.name,
      description: input.description ?? "", phone: blankToNull(input.phone) ?? null, email: blankToNull(input.email) ?? null,
      website: blankToNull(input.website) ?? null, address: input.address ?? null, country: input.country ?? null,
      region: input.region ?? null, city: input.city ?? null, serviceAreas: input.serviceAreas ?? "",
      operatingHours: input.operatingHours ?? "", languages: input.languages ?? "", certifications: input.certifications ?? "",
      logoUrl: blankToNull(input.logoUrl) ?? null, coverUrl: blankToNull(input.coverUrl) ?? null,
      verificationStatus: autoVerify ? "verified" : "unverified",
    });
    await this.audit.write({ actorUserId: userId, action: "provider.created", resourceType: "provider", resourceId: id });
    return this.getMine(userId);
  }

  async patchProvider(userId: string, input: z.infer<typeof PatchProviderBody>) {
    const p = await this.requireProvider(userId);
    const set: Partial<typeof s.providers.$inferInsert> = { updatedAt: new Date() };
    const { phone, email, website, logoUrl, coverUrl, ...rest } = input;
    Object.assign(set, rest);
    if (phone !== undefined) set.phone = blankToNull(phone);
    if (email !== undefined) set.email = blankToNull(email);
    if (website !== undefined) set.website = blankToNull(website);
    if (logoUrl !== undefined) set.logoUrl = blankToNull(logoUrl);
    if (coverUrl !== undefined) set.coverUrl = blankToNull(coverUrl);
    await this.db.update(s.providers).set(set).where(eq(s.providers.id, p.id));
    await this.audit.write({ actorUserId: userId, action: "provider.updated", resourceType: "provider", resourceId: p.id });
    return this.getMine(userId);
  }

  async submitVerification(userId: string, licenseInfo: string) {
    const p = await this.requireProvider(userId);
    if (p.verificationStatus === "verified") throw new AppError("conflict", "Your account is already verified");
    await this.db.update(s.providers).set({ verificationStatus: "pending", verificationInfo: licenseInfo, verificationNote: null, updatedAt: new Date() })
      .where(eq(s.providers.id, p.id));
    await this.audit.write({ actorUserId: userId, action: "provider.verification_submitted", resourceType: "provider", resourceId: p.id });
    return this.getMine(userId);
  }

  async staffDecideProvider(staffId: string, id: string, decision: "verify" | "reject", note?: string) {
    const [p] = await this.db.select().from(s.providers).where(and(eq(s.providers.id, id), isNull(s.providers.deletedAt))).limit(1);
    if (!p) throw AppError.notFound("Provider");
    await this.db.update(s.providers).set({
      verificationStatus: decision === "verify" ? "verified" : "rejected",
      verificationNote: decision === "reject" ? (note ?? "Verification was not approved") : null, updatedAt: new Date(),
    }).where(eq(s.providers.id, id));
    await this.notifications.notify(p.ownerUserId, {
      type: decision === "verify" ? "provider.verified" : "provider.rejected",
      title: decision === "verify" ? "Your provider account is verified" : "Verification update",
      body: decision === "verify" ? "You can now publish services straight to customers." : (note ?? "We couldn't verify your account. Open the app for details."),
      deepLink: "medpilot://provider",
    });
    await this.audit.write({ actorUserId: staffId, actorType: "staff", action: `provider.${decision}`, resourceType: "provider", resourceId: id });
    return { id, verificationStatus: decision === "verify" ? "verified" : "rejected" };
  }

  // ---- listings (provider side) -------------------------------------------------------------------------
  private listingView(l: Listing, providerType: string, windowsCount = 0, bookings = 0) {
    return {
      id: l.id, providerId: l.providerId, kind: l.kind as "service" | "package", category: l.category, subcategory: l.subcategory,
      name: l.name, description: l.description,
      priceAmount: l.priceAmount, priceCurrency: l.priceCurrency, priceType: l.priceType, priceLabel: this.priceLabel(l),
      durationMinutes: l.durationMinutes, capacity: l.capacity, locationModes: csv(l.locationModes),
      country: l.country, region: l.region, city: l.city, serviceRadiusKm: l.serviceRadiusKm,
      requirements: l.requirements, preparation: l.preparation, cancellationPolicy: l.cancellationPolicy, terms: l.terms,
      attributes: json<Record<string, unknown>>(l.attributes, {}), includes: json<{ label: string; listingId?: string }[]>(l.includes, []),
      images: json<string[]>(l.images, []),
      status: l.status, rejectionNote: l.rejectionNote, publishedAt: l.publishedAt, viewCount: l.viewCount,
      bookable: windowsCount > 0, bookingCount: bookings, createdAt: l.createdAt, updatedAt: l.updatedAt,
      categoryLabel: categoryLabel(providerType, l.category, l.subcategory).category,
      subcategoryLabel: categoryLabel(providerType, l.category, l.subcategory).subcategory,
    };
  }
  private priceLabel(l: Pick<Listing, "priceAmount" | "priceCurrency" | "priceType">) {
    if (l.priceType === "quote" || l.priceAmount == null) return "Price on request";
    const base = money(l.priceAmount, l.priceCurrency)!;
    return ({ fixed: base, from: `From ${base}`, per_hour: `${base} / hour`, per_day: `${base} / day` } as Record<string, string>)[l.priceType] ?? base;
  }

  private async owned(userId: string, id: string): Promise<{ provider: Provider; listing: Listing }> {
    const provider = await this.requireProvider(userId);
    const [listing] = await this.db.select().from(s.listings)
      .where(and(eq(s.listings.id, id), eq(s.listings.providerId, provider.id), isNull(s.listings.deletedAt))).limit(1);
    if (!listing) throw AppError.notFound("Listing"); // not yours and not found look the same
    return { provider, listing };
  }

  private async windowCounts(ids: string[]) {
    if (!ids.length) return new Map<string, number>();
    const rows = await this.db.select({ id: s.listingWindows.listingId, n: sql<number>`count(*)::int` })
      .from(s.listingWindows).where(inArray(s.listingWindows.listingId, ids)).groupBy(s.listingWindows.listingId);
    return new Map(rows.map((r) => [r.id, r.n]));
  }
  private async bookingCounts(ids: string[]) {
    if (!ids.length) return new Map<string, number>();
    const rows = await this.db.select({ id: s.serviceRequests.listingId, n: sql<number>`count(*)::int` })
      .from(s.serviceRequests).where(and(inArray(s.serviceRequests.listingId, ids), isNull(s.serviceRequests.deletedAt)))
      .groupBy(s.serviceRequests.listingId);
    return new Map(rows.map((r) => [r.id!, r.n]));
  }

  async listMine(userId: string, q: z.infer<typeof ListingsQuery>) {
    const provider = await this.requireProvider(userId);
    const rows = await this.db.select().from(s.listings)
      .where(and(eq(s.listings.providerId, provider.id), isNull(s.listings.deletedAt),
        q.kind ? eq(s.listings.kind, q.kind) : undefined, q.status ? eq(s.listings.status, q.status) : undefined))
      .orderBy(desc(s.listings.updatedAt)).limit(200);
    const ids = rows.map((r) => r.id);
    const [w, b] = await Promise.all([this.windowCounts(ids), this.bookingCounts(ids)]);
    return rows.map((r) => this.listingView(r, provider.type, w.get(r.id) ?? 0, b.get(r.id) ?? 0));
  }

  async getMineListing(userId: string, id: string) {
    const { provider, listing } = await this.owned(userId, id);
    const [w, b] = await Promise.all([this.windowCounts([id]), this.bookingCounts([id])]);
    return this.listingView(listing, provider.type, w.get(id) ?? 0, b.get(id) ?? 0);
  }

  /** Attributes are checked against the fields the provider's type defines; anything else is dropped. */
  private cleanAttributes(providerType: string, kind: "service" | "package", raw: Record<string, unknown> | undefined) {
    const defs = fieldsFor(providerType, kind);
    const out: Record<string, unknown> = {};
    const errors: Record<string, string> = {};
    for (const d of defs) {
      const v = raw?.[d.key];
      const empty = v === undefined || v === null || v === "" || (Array.isArray(v) && v.length === 0);
      if (empty) continue;
      if (d.input === "number") {
        const n = typeof v === "number" ? v : Number(v);
        if (!Number.isFinite(n) || n < 0) { errors[`attributes.${d.key}`] = `${d.label} must be a number`; continue; }
        out[d.key] = n;
      } else if (d.input === "toggle") out[d.key] = v === true || v === "true";
      else if (d.input === "select") {
        if (typeof v !== "string" || !d.options!.some((o) => o.value === v)) { errors[`attributes.${d.key}`] = `Choose a valid option for ${d.label}`; continue; }
        out[d.key] = v;
      } else if (d.input === "multiselect") {
        const arr = Array.isArray(v) ? v : [];
        if (!arr.every((x) => d.options!.some((o) => o.value === x))) { errors[`attributes.${d.key}`] = `Choose valid options for ${d.label}`; continue; }
        out[d.key] = arr;
      } else out[d.key] = String(v).slice(0, 500);
    }
    return { attributes: out, errors };
  }

  async createListing(userId: string, input: z.infer<typeof CreateListingBody>) {
    const provider = await this.requireProvider(userId);
    const { kind, name, attributes, includes, images, locationModes, priceCurrency, ...rest } = input;
    const { attributes: clean, errors } = this.cleanAttributes(provider.type, kind, attributes);
    if (Object.keys(errors).length) throw new AppError("validation_failed", Object.values(errors)[0]!, { fields: errors });
    await this.checkCategory(provider, rest.category, rest.subcategory);
    const id = uuidv7();
    await this.db.insert(s.listings).values({
      id, providerId: provider.id, kind, name, ...this.columns(rest),
      attributes: JSON.stringify(clean), includes: JSON.stringify(await this.cleanIncludes(provider, id, includes ?? [])),
      images: JSON.stringify(images ?? []), locationModes: (locationModes ?? ["onsite"]).join(","),
      priceCurrency: priceCurrency ?? "USD",
    });
    await this.audit.write({ actorUserId: userId, action: "listing.created", resourceType: "listing", resourceId: id });
    return this.getMineListing(userId, id);
  }

  /** Drops keys that are undefined so a partial edit never blanks a column. */
  private columns(rest: Record<string, unknown>) {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(rest)) if (v !== undefined) out[k] = v;
    return out as Partial<typeof s.listings.$inferInsert>;
  }

  private async checkCategory(provider: Provider, category?: string, subcategory?: string) {
    if (!category) return;
    const c = typeOf(provider.type)?.categories.find((x) => x.code === category);
    if (!c) throw new AppError("validation_failed", "That category isn't available for your provider type", { fields: { category: "That category isn't available for your provider type" } });
    if (subcategory && !c.subcategories.some((x) => x.code === subcategory)) {
      throw new AppError("validation_failed", "Choose a valid subcategory", { fields: { subcategory: "Choose a valid subcategory" } });
    }
  }

  /** A package can only include this provider's own services. */
  private async cleanIncludes(provider: Provider, selfId: string, items: { label: string; listingId?: string }[]) {
    const ids = items.map((i) => i.listingId).filter((x): x is string => !!x);
    if (ids.length) {
      const own = await this.db.select({ id: s.listings.id }).from(s.listings)
        .where(and(inArray(s.listings.id, ids), eq(s.listings.providerId, provider.id), eq(s.listings.kind, "service"), isNull(s.listings.deletedAt)));
      const ok = new Set(own.map((o) => o.id));
      if (ids.some((i) => !ok.has(i) || i === selfId)) {
        throw new AppError("validation_failed", "A package can only include your own services", { fields: { includes: "A package can only include your own services" } });
      }
    }
    return items.map((i) => ({ label: i.label, ...(i.listingId ? { listingId: i.listingId } : {}) }));
  }

  async patchListing(userId: string, id: string, input: z.infer<typeof PatchListingBody>) {
    const { provider, listing } = await this.owned(userId, id);
    if (listing.status === "archived") throw new AppError("conflict", "Restore an archived listing (unpublish it) before editing");
    const { attributes, includes, images, locationModes, ...rest } = input;
    const set: Record<string, unknown> = { ...this.columns(rest), updatedAt: new Date() };
    if (attributes !== undefined) {
      const { attributes: clean, errors } = this.cleanAttributes(provider.type, listing.kind as "service" | "package", attributes);
      if (Object.keys(errors).length) throw new AppError("validation_failed", Object.values(errors)[0]!, { fields: errors });
      set.attributes = JSON.stringify(clean);
    }
    if (includes !== undefined) set.includes = JSON.stringify(await this.cleanIncludes(provider, id, includes));
    if (images !== undefined) set.images = JSON.stringify(images);
    if (locationModes !== undefined) set.locationModes = locationModes.join(",");
    await this.checkCategory(provider, input.category ?? listing.category, input.subcategory ?? (input.category ? undefined : listing.subcategory));
    // Editing a live listing must leave it publishable; otherwise customers would see a half-edited service.
    if (listing.status === "published") {
      const merged = { ...listing, ...set } as Listing;
      const errors = await this.publishErrors(provider, merged);
      if (Object.keys(errors).length) throw new AppError("validation_failed", "This edit would leave the live listing incomplete", { fields: errors });
    }
    if (listing.status === "review") set.status = "draft"; // changed after submission: needs re-submitting
    await this.db.update(s.listings).set(set).where(eq(s.listings.id, id));
    await this.audit.write({ actorUserId: userId, action: "listing.updated", resourceType: "listing", resourceId: id });
    return this.getMineListing(userId, id);
  }

  private async publishErrors(provider: Provider, l: Listing): Promise<Record<string, string>> {
    const e: Record<string, string> = {};
    const gaps = this.profileGaps(provider);
    if (Object.keys(gaps).length) e.provider = `Complete your provider profile first: ${Object.values(gaps)[0]}`;
    if (provider.verificationStatus === "rejected") e.provider = "Your provider verification was not approved";
    if (l.name.trim().length < 2) e.name = "Give it a name";
    if (l.description.trim().length < 20) e.description = "Describe it in at least 20 characters";
    const cat = typeOf(provider.type)?.categories.find((c) => c.code === l.category);
    if (!cat) e.category = "Choose a category";
    else if (!cat.subcategories.some((x) => x.code === l.subcategory)) e.subcategory = "Choose a subcategory";
    if (l.priceType !== "quote" && (l.priceAmount == null || l.priceAmount <= 0)) e.priceAmount = "Set a price, or choose 'Price on request'";
    if (l.kind === "service" && !l.durationMinutes) e.durationMinutes = "Set how long it takes";
    const modes = csv(l.locationModes);
    if (!modes.length) e.locationModes = "Choose where it's offered";
    if (modes.includes("onsite") || modes.includes("home")) {
      if (!l.country) e.country = "Choose the country";
      if (modes.includes("onsite") && !l.city) e.city = "Enter the city";
      if (modes.includes("home") && !l.serviceRadiusKm && !l.city) e.serviceRadiusKm = "Set how far you travel, or enter a city";
    }
    if (l.cancellationPolicy.trim().length < 10) e.cancellationPolicy = "State your cancellation policy";
    if (l.kind === "package") {
      const inc = json<unknown[]>(l.includes, []);
      if (!inc.length) e.includes = "Add at least one included service";
    }
    const attrs = json<Record<string, unknown>>(l.attributes, {});
    for (const d of fieldsFor(provider.type, l.kind as "service" | "package")) {
      const v = attrs[d.key];
      if (d.required && (v === undefined || v === "" || (Array.isArray(v) && !v.length))) e[`attributes.${d.key}`] = `${d.label} is required`;
    }
    const [wc] = await this.db.select({ n: sql<number>`count(*)::int` }).from(s.listingWindows).where(eq(s.listingWindows.listingId, l.id));
    if (!wc?.n) e.availability = "Add at least one weekly time window";
    return e;
  }

  /** Validates the whole listing; a valid one goes live at once for verified providers, else to staff review. */
  async publish(userId: string, id: string) {
    const { provider, listing } = await this.owned(userId, id);
    if (listing.status === "published") return this.getMineListing(userId, id);
    if (listing.status === "review") throw new AppError("conflict", "This listing is already waiting for review");
    const errors = await this.publishErrors(provider, listing);
    if (Object.keys(errors).length) throw new AppError("validation_failed", "Complete the highlighted fields before publishing", { fields: errors });
    const verified = provider.verificationStatus === "verified";
    await this.db.update(s.listings).set({
      status: verified ? "published" : "review", publishedAt: verified ? new Date() : null, rejectionNote: null, updatedAt: new Date(),
    }).where(eq(s.listings.id, id));
    await this.audit.write({ actorUserId: userId, action: verified ? "listing.published" : "listing.submitted", resourceType: "listing", resourceId: id });
    return this.getMineListing(userId, id);
  }

  async unpublish(userId: string, id: string) {
    const { listing } = await this.owned(userId, id);
    if (!["published", "review"].includes(listing.status)) throw new AppError("conflict", "Only a live or submitted listing can be unpublished");
    await this.db.update(s.listings).set({ status: "unpublished", updatedAt: new Date() }).where(eq(s.listings.id, id));
    await this.audit.write({ actorUserId: userId, action: "listing.unpublished", resourceType: "listing", resourceId: id });
    return this.getMineListing(userId, id);
  }

  async archive(userId: string, id: string) {
    const { listing } = await this.owned(userId, id);
    if (listing.status === "archived") return this.getMineListing(userId, id);
    await this.db.update(s.listings).set({ status: "archived", updatedAt: new Date() }).where(eq(s.listings.id, id));
    await this.audit.write({ actorUserId: userId, action: "listing.archived", resourceType: "listing", resourceId: id });
    return this.getMineListing(userId, id);
  }

  async duplicate(userId: string, id: string) {
    const { listing } = await this.owned(userId, id);
    const copyId = uuidv7();
    const { id: _id, status: _s, publishedAt: _p, viewCount: _v, createdAt: _c, updatedAt: _u, deletedAt: _d, rejectionNote: _r, name, ...keep } = listing;
    await this.db.insert(s.listings).values({ ...keep, id: copyId, name: `${name} (copy)`.slice(0, 140), status: "draft" });
    const windows = await this.db.select().from(s.listingWindows).where(eq(s.listingWindows.listingId, id));
    if (windows.length) await this.db.insert(s.listingWindows).values(windows.map((w) => ({ id: uuidv7(), listingId: copyId, weekday: w.weekday, startTime: w.startTime, endTime: w.endTime })));
    await this.audit.write({ actorUserId: userId, action: "listing.duplicated", resourceType: "listing", resourceId: copyId });
    return this.getMineListing(userId, copyId);
  }

  async deleteListing(userId: string, id: string) {
    const { listing } = await this.owned(userId, id);
    if (["published", "review"].includes(listing.status)) throw new AppError("conflict", "Unpublish it before deleting");
    const [bc] = await this.db.select({ n: sql<number>`count(*)::int` }).from(s.serviceRequests).where(eq(s.serviceRequests.listingId, id));
    if ((bc?.n ?? 0) > 0) throw new AppError("conflict", "It has bookings, so it can be archived but not deleted");
    await this.db.update(s.listings).set({ deletedAt: new Date() }).where(eq(s.listings.id, id));
    await this.audit.write({ actorUserId: userId, action: "listing.deleted", resourceType: "listing", resourceId: id });
  }

  async staffDecideListing(staffId: string, id: string, decision: "approve" | "reject", note?: string) {
    const [l] = await this.db.select().from(s.listings).where(and(eq(s.listings.id, id), isNull(s.listings.deletedAt))).limit(1);
    if (!l) throw AppError.notFound("Listing");
    if (l.status !== "review") throw new AppError("conflict", "This listing isn't waiting for review");
    await this.db.update(s.listings).set(decision === "approve"
      ? { status: "published", publishedAt: new Date(), rejectionNote: null, updatedAt: new Date() }
      : { status: "draft", rejectionNote: note ?? "Not approved for publishing", updatedAt: new Date() }).where(eq(s.listings.id, id));
    const [p] = await this.db.select().from(s.providers).where(eq(s.providers.id, l.providerId)).limit(1);
    if (p) {
      await this.notifications.notify(p.ownerUserId, {
        type: decision === "approve" ? "listing.approved" : "listing.rejected",
        title: decision === "approve" ? "Your listing is live" : "Listing needs changes",
        body: decision === "approve" ? `“${l.name}” is now visible to customers.` : (note ?? `“${l.name}” wasn't approved. Open the app for details.`),
        deepLink: `medpilot://provider/listings/${id}`,
      });
    }
    await this.audit.write({ actorUserId: staffId, actorType: "staff", action: `listing.${decision}`, resourceType: "listing", resourceId: id });
    return { id, status: decision === "approve" ? "published" : "draft" };
  }

  // ---- availability -----------------------------------------------------------------------------------
  async getAvailability(userId: string, id: string) {
    await this.owned(userId, id);
    const [windows, blackouts] = await Promise.all([
      this.db.select().from(s.listingWindows).where(eq(s.listingWindows.listingId, id)).orderBy(asc(s.listingWindows.weekday), asc(s.listingWindows.startTime)),
      this.db.select().from(s.listingBlackouts).where(eq(s.listingBlackouts.listingId, id)).orderBy(asc(s.listingBlackouts.day)),
    ]);
    return { windows: windows.map((w) => ({ weekday: w.weekday, start: w.startTime, end: w.endTime })), blackouts: blackouts.map((b) => b.day) };
  }

  async putAvailability(userId: string, id: string, input: z.infer<typeof AvailabilityBody>) {
    const { listing } = await this.owned(userId, id);
    await this.db.transaction(async (tx) => {
      await tx.delete(s.listingWindows).where(eq(s.listingWindows.listingId, id));
      await tx.delete(s.listingBlackouts).where(eq(s.listingBlackouts.listingId, id));
      if (input.windows.length) await tx.insert(s.listingWindows).values(input.windows.map((w) => ({ id: uuidv7(), listingId: id, weekday: w.weekday, startTime: w.start, endTime: w.end })));
      const days = [...new Set(input.blackouts)];
      if (days.length) await tx.insert(s.listingBlackouts).values(days.map((day) => ({ listingId: id, day })));
    });
    // A live listing can't be left with no bookable time.
    if (listing.status === "published" && input.windows.length === 0) {
      await this.db.update(s.listings).set({ status: "unpublished", updatedAt: new Date() }).where(eq(s.listings.id, id));
    }
    await this.audit.write({ actorUserId: userId, action: "listing.availability_updated", resourceType: "listing", resourceId: id });
    return { ...(await this.getAvailability(userId, id)), listingStatus: (await this.getMineListing(userId, id)).status };
  }

  // ---- public discovery ---------------------------------------------------------------------------------
  private async publicRows(ids: string[]) {
    if (!ids.length) return new Map<string, { windows: number }>();
    return new Map(Array.from(await this.windowCounts(ids)).map(([k, v]) => [k, { windows: v }]));
  }

  private cardView(l: Listing, p: Provider, windows: number) {
    const lab = categoryLabel(p.type, l.category, l.subcategory);
    return {
      id: l.id, kind: l.kind as "service" | "package", name: l.name, category: l.category, categoryLabel: lab.category, subcategoryLabel: lab.subcategory,
      priceLabel: this.priceLabel(l), priceAmount: l.priceAmount, priceType: l.priceType, durationMinutes: l.durationMinutes,
      locationModes: csv(l.locationModes), country: l.country, region: l.region, city: l.city, image: json<string[]>(l.images, [])[0] ?? null,
      bookable: windows > 0, provider: { id: p.id, name: p.name, type: p.type, typeLabel: typeOf(p.type)?.label ?? p.type, verified: p.verificationStatus === "verified", logoUrl: p.logoUrl, city: p.city, country: p.country },
    };
  }

  async discover(q: z.infer<typeof DiscoverQuery>) {
    const like = q.q ? containsPattern(q.q) : null;
    const rows = await this.db.select({ l: s.listings, p: s.providers }).from(s.listings)
      .innerJoin(s.providers, eq(s.providers.id, s.listings.providerId))
      .where(and(
        eq(s.listings.status, "published"), isNull(s.listings.deletedAt), isNull(s.providers.deletedAt),
        q.kind ? eq(s.listings.kind, q.kind) : undefined,
        q.type ? eq(s.providers.type, q.type) : undefined,
        q.category ? eq(s.listings.category, q.category) : undefined,
        // A remote service serves anyone, wherever they are; everything else must match the place asked for.
        q.country ? or(ilike(s.listings.country, q.country), sql`${s.listings.locationModes} like '%remote%'`) : undefined,
        q.region ? or(ilike(s.listings.region, q.region), sql`${s.listings.locationModes} like '%remote%'`) : undefined,
        q.city ? or(ilike(s.listings.city, q.city), sql`${s.listings.locationModes} like '%remote%'`) : undefined,
        q.priceMax != null ? and(sql`${s.listings.priceAmount} is not null`, lte(s.listings.priceAmount, q.priceMax * 100)) : undefined,
        like ? or(ilike(s.listings.name, like), ilike(s.listings.description, like), ilike(s.providers.name, like)) : undefined,
      ))
      .orderBy(q.sort === "price_asc" ? asc(s.listings.priceAmount) : q.sort === "price_desc" ? desc(s.listings.priceAmount) : desc(s.listings.publishedAt))
      .limit(60);
    const counts = await this.windowCounts(rows.map((r) => r.l.id));
    let cards = rows.map(({ l, p }) => this.cardView(l, p, counts.get(l.id) ?? 0));
    if (q.bookable) cards = cards.filter((c) => c.bookable === (q.bookable === "true"));
    return cards;
  }

  async facets() {
    const rows = await this.db.select({ type: s.providers.type, category: s.listings.category, n: sql<number>`count(*)::int` })
      .from(s.listings).innerJoin(s.providers, eq(s.providers.id, s.listings.providerId))
      .where(and(eq(s.listings.status, "published"), isNull(s.listings.deletedAt))).groupBy(s.providers.type, s.listings.category);
    const types = new Map<string, number>();
    for (const r of rows) types.set(r.type, (types.get(r.type) ?? 0) + r.n);
    return {
      types: [...types].map(([code, count]) => ({ code, label: PROVIDER_TYPES[code]?.label ?? code, count })),
      categories: rows.map((r) => ({ type: r.type, code: r.category, label: categoryLabel(r.type, r.category).category, count: r.n })),
    };
  }

  /** `preview` lets the owner see their own unpublished listing exactly as customers will. */
  async detail(id: string, viewerId: string, preview: boolean) {
    const [row] = await this.db.select({ l: s.listings, p: s.providers }).from(s.listings)
      .innerJoin(s.providers, eq(s.providers.id, s.listings.providerId))
      .where(and(eq(s.listings.id, id), isNull(s.listings.deletedAt))).limit(1);
    if (!row) throw AppError.notFound("Service");
    const isOwner = row.p.ownerUserId === viewerId;
    if (row.l.status !== "published" && !(preview && isOwner)) throw AppError.notFound("Service");
    if (row.l.status === "published" && !isOwner) {
      await this.db.update(s.listings).set({ viewCount: sql`${s.listings.viewCount} + 1` }).where(eq(s.listings.id, id));
    }
    const { l, p } = row;
    const windows = await this.db.select().from(s.listingWindows).where(eq(s.listingWindows.listingId, id)).orderBy(asc(s.listingWindows.weekday), asc(s.listingWindows.startTime));
    const lab = categoryLabel(p.type, l.category, l.subcategory);
    const attrs = json<Record<string, unknown>>(l.attributes, {});
    const fields = fieldsFor(p.type, l.kind as "service" | "package");
    return {
      ...this.cardView(l, p, windows.length),
      status: l.status, description: l.description, capacity: l.capacity,
      category: { code: l.category, label: lab.category }, subcategory: { code: l.subcategory, label: lab.subcategory },
      locationLabels: csv(l.locationModes).map((m) => LOCATION_MODES.find((x) => x.value === m)?.label ?? m),
      serviceRadiusKm: l.serviceRadiusKm,
      requirements: l.requirements, preparation: l.preparation, cancellationPolicy: l.cancellationPolicy, terms: l.terms,
      details: fields.filter((f) => attrs[f.key] !== undefined).map((f) => ({
        label: f.label,
        value: f.input === "toggle" ? (attrs[f.key] ? "Yes" : "No")
          : Array.isArray(attrs[f.key]) ? (attrs[f.key] as string[]).map((v) => f.options?.find((o) => o.value === v)?.label ?? v).join(", ")
          : f.input === "select" ? (f.options?.find((o) => o.value === attrs[f.key])?.label ?? String(attrs[f.key])) : String(attrs[f.key]),
      })),
      includes: json<{ label: string; listingId?: string }[]>(l.includes, []),
      images: json<string[]>(l.images, []),
      availability: windows.map((w) => ({ weekday: w.weekday, start: w.startTime, end: w.endTime })),
      priceTypeLabel: PRICE_TYPES.find((x) => x.value === l.priceType)?.label ?? l.priceType,
      providerProfile: this.publicProvider(p),
      isOwner, preview: preview && isOwner && l.status !== "published",
    };
  }

  /** Free times on one date: the weekly windows, minus blackouts, minus what is already booked. */
  async slots(id: string, date: string) {
    const [row] = await this.db.select({ l: s.listings, p: s.providers }).from(s.listings)
      .innerJoin(s.providers, eq(s.providers.id, s.listings.providerId))
      .where(and(eq(s.listings.id, id), eq(s.listings.status, "published"), isNull(s.listings.deletedAt))).limit(1);
    if (!row) throw AppError.notFound("Service");
    const { l } = row;
    const today = utcToday();
    if (date <= today || date > addDays(today, BOOKING_WINDOW_DAYS)) return { date, slots: [], reason: date <= today ? "Choose a date after today" : "Choose a date within the next year" };
    const [blackout] = await this.db.select().from(s.listingBlackouts).where(and(eq(s.listingBlackouts.listingId, id), eq(s.listingBlackouts.day, date))).limit(1);
    if (blackout) return { date, slots: [], reason: "Not available on this date" };
    const weekday = new Date(`${date}T00:00:00Z`).getUTCDay();
    const windows = await this.db.select().from(s.listingWindows).where(and(eq(s.listingWindows.listingId, id), eq(s.listingWindows.weekday, weekday))).orderBy(asc(s.listingWindows.startTime));
    if (!windows.length) return { date, slots: [], reason: "Not available on this day of the week" };
    const step = l.durationMinutes ?? 60;
    const booked = await this.db.select({ t: s.serviceRequests.preferredTime, n: sql<number>`count(*)::int` }).from(s.serviceRequests)
      .where(and(eq(s.serviceRequests.listingId, id), eq(s.serviceRequests.preferredDate, date), inArray(s.serviceRequests.status, BOOKING_ACTIVE), isNull(s.serviceRequests.deletedAt)))
      .groupBy(s.serviceRequests.preferredTime);
    const taken = new Map(booked.map((b) => [b.t, b.n]));
    const slots: { time: string; remaining: number }[] = [];
    for (const w of windows) {
      for (let m = toMin(w.startTime); m + step <= toMin(w.endTime); m += step) {
        const time = fromMin(m);
        const remaining = l.capacity - (taken.get(time) ?? 0);
        if (remaining > 0) slots.push({ time, remaining });
      }
    }
    return { date, slots, reason: slots.length ? null : "Fully booked on this date" };
  }

  private reference(): string {
    return `SR${String(new Date().getUTCFullYear()).slice(-2)}-${randomInt(1000, 9999)}-${randomInt(100, 999)}`;
  }

  async book(userId: string, listingId: string, input: z.infer<typeof BookListingBody>) {
    const [row] = await this.db.select({ l: s.listings, p: s.providers }).from(s.listings)
      .innerJoin(s.providers, eq(s.providers.id, s.listings.providerId))
      .where(and(eq(s.listings.id, listingId), eq(s.listings.status, "published"), isNull(s.listings.deletedAt))).limit(1);
    if (!row) throw AppError.notFound("Service");
    const { l, p } = row;
    if (p.ownerUserId === userId) throw new AppError("conflict", "You can't book your own service");

    const fail = (field: string, message: string): never => { throw new AppError("validation_failed", message, { fields: { [field]: message } }); };
    let id = "";
    await this.db.transaction(async (tx) => {
      // Two people booking the last place in a slot at the same moment must not both succeed.
      await tx.execute(sql`select pg_advisory_xact_lock(hashtext(${`${listingId}|${input.date}|${input.time}`}))`);
      const available = await this.slots(listingId, input.date);
      if (!available.slots.some((x) => x.time === input.time)) {
        fail(available.slots.length ? "time" : "date", available.slots.length ? "That time is no longer available" : (available.reason ?? "That date isn't available"));
      }
      const [dupe] = await tx.select({ id: s.serviceRequests.id }).from(s.serviceRequests).where(and(
        eq(s.serviceRequests.userId, userId), eq(s.serviceRequests.listingId, listingId), eq(s.serviceRequests.preferredDate, input.date),
        eq(s.serviceRequests.preferredTime, input.time), inArray(s.serviceRequests.status, BOOKING_ACTIVE), isNull(s.serviceRequests.deletedAt))).limit(1);
      if (dupe) throw new AppError("conflict", "You already have a booking for this time");
      id = uuidv7();
      for (let attempt = 0; ; attempt += 1) {
        try {
          await tx.insert(s.serviceRequests).values({
            id, reference: this.reference(), userId, kind: "listing_booking", targetType: "listing", targetId: listingId,
            listingId, providerId: p.id, serviceId: null, preferredDate: input.date, preferredTime: input.time,
            message: input.notes?.trim() || null,
            details: JSON.stringify({ listingName: l.name, priceAmount: l.priceAmount, priceCurrency: l.priceCurrency, contactPhone: input.contactPhone ?? null }),
          });
          break;
        } catch (e) {
          if (attempt >= 3 || !/service_requests_reference_uq/.test((e as Error).message)) throw e;
        }
      }
    });
    await this.db.insert(s.activities).values({ id: uuidv7(), userId, type: "service", title: p.name, subtitle: `${l.name} · ${input.date}`, status: "pending", targetType: "service_request", targetId: id });
    await this.notifications.notify(userId, { type: "service.requested", title: "Booking request sent", body: `${p.name} will confirm your booking shortly.`, deepLink: `medpilot://requests/${id}` });
    await this.notifications.notify(p.ownerUserId, { type: "provider.booking_new", title: "New booking request", body: `${l.name} on ${input.date} at ${input.time}`, deepLink: `medpilot://provider/bookings/${id}` });
    await this.audit.write({ actorUserId: userId, action: "listing.booked", resourceType: "service_request", resourceId: id });
    return { id };
  }

  // ---- provider bookings ---------------------------------------------------------------------------------
  private async bookingViews(rows: (typeof s.serviceRequests.$inferSelect)[]) {
    const userIds = [...new Set(rows.map((r) => r.userId))];
    const listingIds = [...new Set(rows.map((r) => r.listingId).filter((x): x is string => !!x))];
    const [profiles, lst] = await Promise.all([
      userIds.length ? this.db.select().from(s.userProfiles).where(inArray(s.userProfiles.userId, userIds)) : [],
      listingIds.length ? this.db.select().from(s.listings).where(inArray(s.listings.id, listingIds)) : [],
    ]);
    return rows.map((r) => {
      const pr = profiles.find((x) => x.userId === r.userId);
      const l = lst.find((x) => x.id === r.listingId);
      const d = r.details ? (JSON.parse(r.details) as { priceAmount?: number | null; priceCurrency?: string; contactPhone?: string | null }) : {};
      const confirmed = r.status === "confirmed" || r.status === "completed";
      return {
        id: r.id, reference: `#${r.reference}`, status: r.status as "pending" | "confirmed" | "completed" | "cancelled",
        date: r.preferredDate, time: r.preferredTime, notes: r.message,
        listing: l ? { id: l.id, name: l.name, kind: l.kind } : null,
        priceLabel: money(d.priceAmount ?? null, d.priceCurrency),
        // The customer's first name and last initial are enough to run a booking; contact details are released once it's confirmed.
        customer: {
          name: pr ? `${pr.firstName} ${pr.lastName.slice(0, 1)}.` : "Customer",
          phone: confirmed ? (d.contactPhone ?? pr?.phoneE164 ?? null) : null,
        },
        cancelledReason: r.cancelledReason, createdAt: r.createdAt,
        canConfirm: r.status === "pending", canDecline: r.status === "pending",
        canComplete: r.status === "confirmed" && (r.preferredDate ?? "9999") <= utcToday(),
        canCancel: r.status === "confirmed",
      };
    });
  }

  async listBookings(userId: string, status?: string) {
    const provider = await this.requireProvider(userId);
    const rows = await this.db.select().from(s.serviceRequests)
      .where(and(eq(s.serviceRequests.providerId, provider.id), isNull(s.serviceRequests.deletedAt), status ? eq(s.serviceRequests.status, status) : undefined))
      .orderBy(desc(s.serviceRequests.createdAt)).limit(200);
    return this.bookingViews(rows);
  }

  private async ownedBooking(userId: string, id: string) {
    const provider = await this.requireProvider(userId);
    const [r] = await this.db.select().from(s.serviceRequests)
      .where(and(eq(s.serviceRequests.id, id), eq(s.serviceRequests.providerId, provider.id), isNull(s.serviceRequests.deletedAt))).limit(1);
    if (!r) throw AppError.notFound("Booking");
    return { provider, booking: r };
  }

  async getBooking(userId: string, id: string) {
    const { booking } = await this.ownedBooking(userId, id);
    return (await this.bookingViews([booking]))[0]!;
  }

  async actOnBooking(userId: string, id: string, action: "confirm" | "decline" | "complete" | "cancel", reason?: string) {
    const { provider, booking } = await this.ownedBooking(userId, id);
    const from = booking.status;
    const next = { confirm: "confirmed", decline: "cancelled", complete: "completed", cancel: "cancelled" }[action];
    const allowed = { confirm: ["pending"], decline: ["pending"], complete: ["confirmed"], cancel: ["confirmed"] }[action];
    if (!allowed.includes(from)) throw new AppError("conflict", `A ${from} booking can't be ${action === "confirm" ? "confirmed" : action === "decline" ? "declined" : action === "complete" ? "completed" : "cancelled"}`);
    if (action === "complete" && (booking.preferredDate ?? "9999") > utcToday()) throw new AppError("conflict", "You can mark it completed on or after the appointment date");
    await this.db.update(s.serviceRequests).set({
      status: next, updatedAt: new Date(),
      cancelledReason: next === "cancelled" ? (reason ?? (action === "decline" ? "Declined by the provider" : "Cancelled by the provider")) : null,
    }).where(eq(s.serviceRequests.id, id));
    const copy = {
      confirm: ["service.confirmed", "Booking confirmed", `${provider.name} confirmed your booking for ${booking.preferredDate}.`],
      decline: ["service.cancelled", "Booking update", `${provider.name} couldn't take your booking. Open the app for details.`],
      complete: ["service.completed", "Booking completed", `Your booking with ${provider.name} is complete.`],
      cancel: ["service.cancelled", "Booking cancelled", `${provider.name} cancelled your booking. Open the app for details.`],
    }[action];
    await this.notifications.notify(booking.userId, { type: copy[0]!, title: copy[1]!, body: copy[2]!, deepLink: `medpilot://requests/${id}` });
    await this.db.insert(s.activities).values({
      id: uuidv7(), userId: booking.userId, type: "service", title: copy[1]!, subtitle: `Reference #${booking.reference}`,
      status: next === "confirmed" ? "booked" : next === "completed" ? "completed" : "cancelled", targetType: "service_request", targetId: id,
    });
    await this.audit.write({ actorUserId: userId, action: `booking.provider_${action}`, resourceType: "service_request", resourceId: id });
    return this.getBooking(userId, id);
  }

  // ---- dashboard ---------------------------------------------------------------------------------------
  async dashboard(userId: string) {
    const provider = await this.requireProvider(userId);
    const [byListing, byBooking, top, unread] = await Promise.all([
      this.db.select({ kind: s.listings.kind, status: s.listings.status, n: sql<number>`count(*)::int` }).from(s.listings)
        .where(and(eq(s.listings.providerId, provider.id), isNull(s.listings.deletedAt))).groupBy(s.listings.kind, s.listings.status),
      this.db.select({ status: s.serviceRequests.status, n: sql<number>`count(*)::int`, upcoming: sql<number>`count(*) filter (where ${s.serviceRequests.preferredDate} >= ${utcToday()})::int` })
        .from(s.serviceRequests).where(and(eq(s.serviceRequests.providerId, provider.id), isNull(s.serviceRequests.deletedAt))).groupBy(s.serviceRequests.status),
      this.db.select({ id: s.listings.id, name: s.listings.name, kind: s.listings.kind, views: s.listings.viewCount })
        .from(s.listings).where(and(eq(s.listings.providerId, provider.id), isNull(s.listings.deletedAt))).orderBy(desc(s.listings.viewCount)).limit(5),
      this.notifications.list(userId),
    ]);
    const perListing = await this.bookingCounts(top.map((t) => t.id));
    const count = (kind: string, status?: string) => byListing.filter((r) => r.kind === kind && (!status || r.status === status)).reduce((a, r) => a + r.n, 0);
    const b = (status: string) => byBooking.find((r) => r.status === status);
    const completed = await this.db.select({ d: s.serviceRequests.details }).from(s.serviceRequests)
      .where(and(eq(s.serviceRequests.providerId, provider.id), eq(s.serviceRequests.status, "completed"), isNull(s.serviceRequests.deletedAt)));
    // Listed prices of completed bookings. There are no in-app payments, so this is an estimate, and it says so.
    const value = completed.reduce((a, r) => a + ((r.d ? (JSON.parse(r.d) as { priceAmount?: number | null }).priceAmount : 0) ?? 0), 0);
    return {
      provider: this.providerView(provider),
      services: { published: count("service", "published"), draft: count("service", "draft") + count("service", "review"), total: count("service") },
      packages: { published: count("package", "published"), draft: count("package", "draft") + count("package", "review"), total: count("package") },
      bookings: {
        pending: b("pending")?.n ?? 0, confirmed: b("confirmed")?.n ?? 0, upcoming: b("confirmed")?.upcoming ?? 0,
        completed: b("completed")?.n ?? 0, cancelled: b("cancelled")?.n ?? 0,
      },
      completedValueLabel: money(value, "USD"), completedValueNote: "Listed prices of completed bookings. Payments are not processed in the app.",
      topListings: top.map((t) => ({ ...t, bookings: perListing.get(t.id) ?? 0 })), unreadNotifications: unread.unreadCount,
    };
  }

  /** Staff queue additions. */
  async pendingForStaff() {
    const [provs, lst] = await Promise.all([
      this.db.select({ id: s.providers.id, name: s.providers.name, type: s.providers.type, info: s.providers.verificationInfo, createdAt: s.providers.createdAt })
        .from(s.providers).where(and(eq(s.providers.verificationStatus, "pending"), isNull(s.providers.deletedAt))).orderBy(asc(s.providers.updatedAt)).limit(100),
      this.db.select({ id: s.listings.id, name: s.listings.name, kind: s.listings.kind, providerId: s.listings.providerId, createdAt: s.listings.createdAt })
        .from(s.listings).where(and(eq(s.listings.status, "review"), isNull(s.listings.deletedAt))).orderBy(asc(s.listings.updatedAt)).limit(100),
    ]);
    return { providers: provs, listings: lst };
  }
}
