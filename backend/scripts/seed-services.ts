/**
 * Seed data for the location tree, transport coverage, pet services and
 * independent specialists. Kept apart from seed.ts because it is the part most
 * likely to grow as real providers are onboarded.
 *
 * Coverage is deliberately uneven so availability is meaningful: an inland city
 * has no speed boats, a country with no jet operator says so, and so on.
 */
import { uuidv7 } from "uuidv7";
import type { createDb } from "../src/db/client";
import { schema as s } from "../src/db/client";

type Db = ReturnType<typeof createDb>;
const id = () => uuidv7();

interface City { name: string; aliases?: string; airport?: boolean; helipad?: boolean; lat?: number; lng?: number }
interface Region { name: string; code?: string; aliases?: string; cities: City[] }
interface Country { name: string; code: string; aliases?: string; regions: Region[] }

const TREE: Country[] = [
  {
    name: "Canada", code: "CA", aliases: "CAN",
    regions: [
      { name: "Ontario", code: "ON", cities: [
        { name: "Toronto", airport: true, helipad: true, lat: 43.6532, lng: -79.3832 },
        { name: "Ottawa", airport: true, lat: 45.4215, lng: -75.6972 },
        { name: "London", airport: true, lat: 42.9849, lng: -81.2453 },
      ] },
      { name: "Alberta", code: "AB", cities: [
        { name: "Calgary", airport: true, helipad: true, lat: 51.0447, lng: -114.0719 },
        { name: "Edmonton", airport: true, lat: 53.5461, lng: -113.4938 },
      ] },
      { name: "Quebec", code: "QC", aliases: "Québec", cities: [
        { name: "Montreal", aliases: "Montréal", airport: true, lat: 45.5019, lng: -73.5674 },
      ] },
      { name: "British Columbia", code: "BC", cities: [
        { name: "Vancouver", airport: true, helipad: true, lat: 49.2827, lng: -123.1207 },
        { name: "Victoria", helipad: true, lat: 48.4284, lng: -123.3656 },
      ] },
    ],
  },
  {
    name: "United States", code: "US", aliases: "USA,United States of America,America",
    regions: [
      { name: "New York", code: "NY", cities: [
        { name: "New York City", aliases: "New York,Manhattan,Brooklyn,NYC", airport: true, helipad: true, lat: 40.7128, lng: -74.006 },
      ] },
      { name: "California", code: "CA", cities: [
        { name: "Los Angeles", aliases: "LA", airport: true, helipad: true, lat: 34.0522, lng: -118.2437 },
        { name: "San Francisco", airport: true, helipad: true, lat: 37.7749, lng: -122.4194 },
      ] },
    ],
  },
  {
    name: "United Arab Emirates", code: "AE", aliases: "UAE,Emirates",
    regions: [
      { name: "Abu Dhabi", cities: [{ name: "Abu Dhabi", airport: true, helipad: true, lat: 24.4539, lng: 54.3773 }] },
      { name: "Dubai", cities: [{ name: "Dubai", airport: true, helipad: true, lat: 25.2048, lng: 55.2708 }] },
    ],
  },
  {
    name: "United Kingdom", code: "GB", aliases: "UK,Great Britain,Britain",
    regions: [
      { name: "England", cities: [{ name: "London", airport: true, helipad: true, lat: 51.5072, lng: -0.1276 }] },
    ],
  },
  {
    name: "South Korea", code: "KR", aliases: "Korea,Republic of Korea",
    regions: [
      { name: "Seoul", cities: [{ name: "Seoul", airport: true, helipad: true, lat: 37.5665, lng: 126.978 }] },
    ],
  },
];

export interface ProviderIds { emsAir: string; pacific: string; uber: string; harbour: string; gulf: string }

/** Inserts the tree and returns a lookup by "Country" / "Country/Region" / "Country/Region/City". */
async function seedLocations(db: Db): Promise<Map<string, string>> {
  const byPath = new Map<string, string>();
  let order = 0;
  for (const c of TREE) {
    const cid = id();
    byPath.set(c.name, cid);
    await db.insert(s.locations).values({ id: cid, parentId: null, level: "country", name: c.name, code: c.code, aliases: c.aliases ?? "", sortOrder: order++ });
    let ro = 0;
    for (const r of c.regions) {
      const rid = id();
      byPath.set(`${c.name}/${r.name}`, rid);
      await db.insert(s.locations).values({ id: rid, parentId: cid, level: "region", name: r.name, code: r.code ?? null, aliases: r.aliases ?? "", sortOrder: ro++ });
      let co = 0;
      for (const city of r.cities) {
        const lid = id();
        byPath.set(`${c.name}/${r.name}/${city.name}`, lid);
        await db.insert(s.locations).values({
          id: lid, parentId: rid, level: "city", name: city.name, aliases: city.aliases ?? "",
          hasAirport: !!city.airport, hasHelipad: !!city.helipad,
          latitude: city.lat?.toString() ?? null, longitude: city.lng?.toString() ?? null, sortOrder: co++,
        });
      }
    }
  }
  return byPath;
}

export async function seedServices(db: Db, P: ProviderIds): Promise<void> {
  const loc = await seedLocations(db);
  const at = (path: string) => {
    const v = loc.get(path);
    if (!v) throw new Error(`seed: unknown location ${path}`);
    return v;
  };

  const cover = (providerId: string, paths: string[]) =>
    paths.map((p) => ({ providerId, locationId: at(p) }));

  await db.insert(s.transportProviderCoverage).values([
    // Worldwide repatriation: every country in the tree.
    ...cover(P.emsAir, ["Canada", "United States", "United Arab Emirates", "United Kingdom", "South Korea"]),
    ...cover(P.pacific, ["Canada", "United States", "United Kingdom"]),
    // Western-Canada jet operator: three provinces plus the US.
    ...cover(P.uber, ["Canada/Alberta", "Canada/Ontario", "Canada/British Columbia", "United States"]),
    // Speed boats only make sense on the water, so coverage is coastal cities.
    ...cover(P.harbour, [
      "Canada/British Columbia/Vancouver", "Canada/British Columbia/Victoria",
      "United States/New York/New York City", "United States/California/Los Angeles",
      "United States/California/San Francisco", "United Arab Emirates/Dubai/Dubai",
      "United Arab Emirates/Abu Dhabi/Abu Dhabi", "South Korea/Seoul/Seoul",
    ]),
    ...cover(P.gulf, ["United Arab Emirates", "South Korea"]),
  ]);

  // ---- pet clinics: spread across all three tabs, each with real services ----
  const clinic = (name: string, category: "vet" | "pedicure" | "sitters", location: string, description: string,
    emoji: string, hero: string, openTo: string, price: number) =>
    ({ id: id(), name, category, location, priceFromAmount: price, description, openTo, logoEmoji: emoji, heroAsset: hero, verified: true });

  const C = {
    petLife: clinic("Pet+Life Veterinary Clinic", "vet", "Tokyo, Japan", "We provide assistance for exporting and importing pets as well as pet hotel services", "🦊", "petVet", "USA | Mexico | UK | India | Italy", 44900),
    russell: clinic("Russell Equine Veterinary Service", "vet", "Ontario Canada", "We are consistently pushing to offer the best in both diagnostic and therapeutic modalities to our clients", "🐎", "horses", "Canada | USA", 44900),
    bonnie: clinic("Bonnieland Puppy Parlor", "pedicure", "Calgary, Canada", "Grooming Calgary is focused on high-quality service and customer satisfaction", "🐶", "dogGroom", "USA | Mexico | UK | India | Italy", 44900),
    coastal: clinic("Coastal Vet Care", "vet", "Vancouver, Canada", "Family-run veterinary practice offering wellness exams, vaccinations and same-day urgent care", "🩺", "petVet", "Canada", 8500),
    pampered: clinic("Pampered Paws Grooming", "pedicure", "Toronto, Canada", "Full-service grooming and nail care for dogs and cats, by appointment", "✂️", "dogGroom", "Canada", 6500),
    happy: clinic("Happy Paws Sitters", "sitters", "Toronto, Canada", "Trusted in-home pet sitters and dog walkers, background-checked and insured", "🐾", "petCare", "Canada", 4500),
    maple: clinic("Maple Pet Hotel & Sitting", "sitters", "Calgary, Canada", "Boarding, daycare and overnight sitting in a calm, supervised setting", "🏡", "petCare", "Canada | USA", 5500),
  };
  await db.insert(s.petClinics).values(Object.values(C));

  const svc = (clinicId: string, name: string, description: string, kind: "appointment" | "sitting", price: number, duration: string, order: number) =>
    ({ id: id(), clinicId, name, description, kind, priceAmount: price, durationLabel: duration, sortOrder: order });
  await db.insert(s.petServices).values([
    svc(C.petLife.id, "Wellness exam", "Full nose-to-tail check with vaccination review", "appointment", 12000, "45 min", 0),
    svc(C.petLife.id, "Pet travel certificate", "Import/export paperwork and health clearance", "appointment", 44900, "1 hr", 1),
    svc(C.petLife.id, "Pet hotel stay", "Supervised boarding while you travel", "sitting", 8000, "per night", 2),
    svc(C.russell.id, "Equine dental care", "Floating and dental examination", "appointment", 30000, "1 hr", 0),
    svc(C.russell.id, "Lameness evaluation", "Diagnostic exam with flexion tests", "appointment", 44900, "1.5 hr", 1),
    svc(C.bonnie.id, "Full groom", "Bath, cut, nails and ear cleaning", "appointment", 7500, "2 hr", 0),
    svc(C.bonnie.id, "Nail trim", "Quick nail trim and file", "appointment", 2500, "20 min", 1),
    svc(C.coastal.id, "Annual check-up", "Exam, vaccines and parasite prevention", "appointment", 8500, "40 min", 0),
    svc(C.coastal.id, "Urgent care visit", "Same-day assessment for sudden illness or injury", "appointment", 14000, "45 min", 1),
    svc(C.pampered.id, "Bath & brush", "Shampoo, blow-dry and brush-out", "appointment", 6500, "1 hr", 0),
    svc(C.pampered.id, "Cat groom", "Gentle grooming for cats", "appointment", 7000, "1 hr", 1),
    svc(C.happy.id, "Drop-in visit", "A 30-minute visit at your home", "sitting", 2500, "30 min", 0),
    svc(C.happy.id, "Dog walking", "One-hour walk, with photo updates", "sitting", 3000, "1 hr", 1),
    svc(C.happy.id, "Overnight sitting", "A sitter stays in your home overnight", "sitting", 7500, "per night", 2),
    svc(C.maple.id, "Daycare", "Supervised play and rest, drop-off to pick-up", "sitting", 4500, "per day", 0),
    svc(C.maple.id, "Boarding", "Overnight stay in a climate-controlled suite", "sitting", 6500, "per night", 1),
  ]);

  // ---- independent specialists ------------------------------------------------
  const cats = await db.select().from(s.independentSpecialistCategories);
  const cat = (title: string) => {
    const c = cats.find((x) => x.title === title);
    if (!c) throw new Error(`seed: missing category ${title}`);
    return c.id;
  };
  const spec = (categoryTitle: string, name: string, role: string, bio: string, location: string,
    years: number, availability: string, photo: string, languages = "English") =>
    ({ id: id(), categoryId: cat(categoryTitle), name, role, bio, locationLabel: location, languages,
       yearsExperience: years, availabilityLabel: availability, photoAsset: photo, verified: true });
  const S = {
    amara: spec("Private Nurses", "Amara Okafor", "Registered Nurse · Post-operative care", "Twelve years in surgical recovery and wound care, now providing one-to-one nursing at home for patients returning from treatment abroad.", "Toronto, Canada", 12, "Mon–Fri · 08:00–18:00", "nurseDoctor", "English, Igbo"),
    daniel: spec("Private Nurses", "Daniel Reyes", "Critical-care nurse", "Former ICU nurse experienced with ventilated and long-term monitoring patients. Available for overnight cover.", "Calgary, Canada", 9, "Nights and weekends", "doctor1", "English, Spanish"),
    mei: spec("Private Nurses", "Mei Lin Chen", "Palliative & elder-care nurse", "Compassionate end-of-life and elder care, coordinating with family and physicians.", "Vancouver, Canada", 15, "Daily · flexible", "woman1", "English, Mandarin, Cantonese"),
    sofia: spec("Animal Care Givers", "Sofia Marino", "Certified veterinary technician", "Home visits for medication, injections and post-surgical care for pets.", "Toronto, Canada", 8, "Tue–Sat · 09:00–17:00", "petCare", "English, Italian"),
    liam: spec("Animal Care Givers", "Liam O'Connor", "Professional pet sitter", "Live-in sitting for dogs, cats and small animals while you are travelling for treatment.", "Calgary, Canada", 6, "Short-notice available", "dogGroom", "English"),
    grace: spec("Care Givers", "Grace Mwangi", "Live-in caregiver", "Personal support for daily living, mobility assistance and companionship.", "Ottawa, Canada", 11, "Weekly rota", "woman2", "English, Swahili"),
    omar: spec("Care Givers", "Omar Haddad", "Rehabilitation support worker", "Supports recovery routines, exercises and appointments after major surgery.", "Montreal, Canada", 7, "Mon–Sat · 07:00–19:00", "doctor2", "English, French, Arabic"),
  };
  await db.insert(s.independentSpecialists).values(Object.values(S));

  const iSvc = (specialistId: string, name: string, description: string, price: number, duration: string, order: number) =>
    ({ id: id(), specialistId, name, description, priceAmount: price, durationLabel: duration, sortOrder: order });
  await db.insert(s.independentServices).values([
    iSvc(S.amara.id, "Post-operative home visit", "Dressing changes, vitals and medication review", 9500, "1 hr", 0),
    iSvc(S.amara.id, "Full-day nursing", "Continuous nursing support for the day", 32000, "8 hr", 1),
    iSvc(S.daniel.id, "Overnight monitoring", "Overnight clinical monitoring and support", 28000, "10 hr", 0),
    iSvc(S.daniel.id, "Critical-care consult", "Assessment and care-plan advice", 12000, "1 hr", 1),
    iSvc(S.mei.id, "Elder-care visit", "Personal care and companionship", 6500, "2 hr", 0),
    iSvc(S.mei.id, "Palliative support", "Comfort-focused care with family guidance", 9000, "3 hr", 1),
    iSvc(S.sofia.id, "Pet medication visit", "Administer medication and injections at home", 6000, "45 min", 0),
    iSvc(S.sofia.id, "Post-surgery pet care", "Wound care and recovery monitoring", 8500, "1 hr", 1),
    iSvc(S.liam.id, "Live-in pet sitting", "Sitter stays with your pets in your home", 8000, "per night", 0),
    iSvc(S.liam.id, "Daily walks", "One-hour walk with updates", 2500, "1 hr", 1),
    iSvc(S.grace.id, "Daily living support", "Meals, mobility and personal care", 5500, "4 hr", 0),
    iSvc(S.grace.id, "Live-in week", "Seven days of live-in support", 78000, "7 days", 1),
    iSvc(S.omar.id, "Rehab exercise session", "Guided recovery exercises", 5000, "1 hr", 0),
    iSvc(S.omar.id, "Appointment escort", "Accompany you to and from appointments", 4000, "3 hr", 1),
  ]);
}
