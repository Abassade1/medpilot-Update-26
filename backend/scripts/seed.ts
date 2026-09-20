/**
 * Development / staging seed.
 *
 * Ports the catalog content that shipped inside the frontend's mock layer so
 * the integrated app renders exactly what QA approved. `*_asset` values are
 * keys of the frontend's bundled `images` map (v1 asset bridge — see README).
 *
 * Refuses to run against production. Idempotent: wipes catalog + reference
 * tables and reinserts; never touches user data.
 */
import { uuidv7 } from "uuidv7";
import { createPool, createDb, schema as s } from "../src/db/client";
import { sql } from "drizzle-orm";
import { seedServices } from "./seed-services";

const env = process.env.NODE_ENV ?? "development";
if (env === "production") {
  console.error("Refusing to seed a production database.");
  process.exit(1);
}

const id = () => uuidv7();

async function main() {
  const pool = createPool(process.env.DATABASE_URL ?? "postgres://medpilot@localhost:5433/medpilot_dev");
  const db = createDb(pool);

  await db.execute(sql`
    truncate table
      promo_slides, package_inclusions, medical_packages,
      hospital_specialists, specialists, hospitals,
      aircraft_facilities, aircraft, transport_providers,
      pet_clinics, service_categories, independent_specialist_categories,
      locations, pet_services, independent_specialists, independent_services,
      conditions, transport_purposes, special_needs,
      triage_symptoms, triage_conditions, plans
    restart identity cascade
  `);

  // ---- reference lists --------------------------------------------------
  const cond = (code: string, label: string, i: number) => ({ id: id(), code, label, sortOrder: i });
  await db.insert(s.conditions).values([
    cond("high_blood_pressure", "High Blood Pressure", 0),
    cond("heart_attack_disease", "Heart Attack/Disease", 1),
    cond("joint_pain", "Joint pain", 2),
    cond("mental_problems", "Mental Problems", 3),
    cond("seizures_epilepsy", "Seizures/Epilepsy", 4),
    cond("osteoporosis", "Osteoporosis", 5),
  ]);
  await db.insert(s.transportPurposes).values([
    { id: id(), code: "doctors_appointment", label: "Doctor’s Appointment", sortOrder: 0 },
    { id: id(), code: "hospital_admission", label: "Hospital Admission", sortOrder: 1 },
    { id: id(), code: "surgery", label: "Surgery", sortOrder: 2 },
    { id: id(), code: "physical_therapy", label: "Physical Therapy", sortOrder: 3 },
    { id: id(), code: "dialysis", label: "Dialysis", sortOrder: 4 },
  ]);
  await db.insert(s.specialNeeds).values([
    { id: id(), code: "inflight_oxygen", label: "In Flight Oxygen Support", sortOrder: 0 },
    { id: id(), code: "icu_equipment", label: "ICU Care Equipment", sortOrder: 1 },
    { id: id(), code: "wheelchair", label: "Wheelchair assistance", sortOrder: 2 },
    { id: id(), code: "stretcher_arrival", label: "Stretcher on arrival", sortOrder: 3 },
    { id: id(), code: "medical_escort", label: "Accompanying medical escort", sortOrder: 4 },
  ]);
  await db.insert(s.triageSymptoms).values([
    { id: id(), code: "coughing", label: "Coughing", emoji: "😮‍💨", sortOrder: 0 },
    { id: id(), code: "chest_pain", label: "Chest pain", emoji: "🫀", sortOrder: 1 },
    { id: id(), code: "difficult_breathing", label: "Difficult breathing", emoji: "😮‍💨", sortOrder: 2 },
    { id: id(), code: "severe_headache", label: "Severe headache", emoji: "🤕", sortOrder: 3 },
  ]);
  await db.insert(s.triageConditions).values([
    { id: id(), code: "cancer", label: "Cancer", emoji: "🎗️", sortOrder: 0 },
    { id: id(), code: "diabetics", label: "Diabetics", emoji: "🩸", sortOrder: 1 },
    { id: id(), code: "tuberculosis", label: "Tuberculosis", emoji: "🫁", sortOrder: 2 },
    { id: id(), code: "high_blood_pressure", label: "High Blood Pressure", emoji: "🫀", sortOrder: 3 },
    { id: id(), code: "none", label: "None", emoji: "🚫", sortOrder: 4 },
  ]);

  // ---- service categories ----------------------------------------------
  await db.insert(s.serviceCategories).values([
    { id: id(), code: "transport", title: "Medivac Transportation", description: "Medical Ambulance, Private jets, Speed boats", colorHex: "#F9C1BE", imageAsset: "svcMedevac", sortOrder: 0 },
    { id: id(), code: "specialist", title: "Specialist Treatments", description: "Cancer centres, Cardiac, Neurology emergency", colorHex: "#BFE3B4", imageAsset: "svcDna", sortOrder: 1 },
    { id: id(), code: "pet", title: "Pet Specialist", description: "Pet Bathing, Vet Doctors, Pet sitters", colorHex: "#FCE1A0", imageAsset: "svcPet", sortOrder: 2 },
    { id: id(), code: "organs", title: "Organs Upgrade", description: "Upgrade organs, blood and organs-on-chips", colorHex: "#CDC4F1", imageAsset: "svcBrain", sortOrder: 3 },
    { id: id(), code: "chronic", title: "Chronic Prescriptions", description: "Chronic Drugs, Pharmacies, Pharmacists", colorHex: "#A9D3F5", imageAsset: "svcHand", sortOrder: 4 },
  ]);

  // ---- hospitals + specialists -----------------------------------------
  const H = {
    kingSalman: id(), ernGuard: id(), seoul: id(), burjeel: id(), nyp: id(),
  };
  const about = {
    kingSalman: "King Salman Heart Center is a leading cardiology institute providing advanced cardiac care, surgery and rehabilitation services across the region.",
    ernGuard: "ERN GUARD-Heart is a European reference network for rare and complex diseases of the heart, connecting the best cardiothoracic specialists.",
    seoul: "Seoul National University Hospital is a world-class academic medical center known for oncology and cardiology excellence.",
    burjeel: "Burjeel International Hospital delivers premium tertiary care with an emphasis on cardiology and surgical excellence.",
    nyp: "NewYork-Presbyterian is one of the nation's most comprehensive, integrated academic health care delivery systems, dedicated to providing the highest quality, most compassionate care.",
  };
  const hosp = (hid: string, slug: string, name: string, specialty: string, cc: string, country: string, n: number, logo: string, rating: string, ab: string, helipad: string) => ({
    id: hid, slug, name, specialty, countryCode: cc, countryLabel: country, specialistCount: n,
    logoAsset: logo, rating, about: ab, careSystem: "Special health service",
    openHours: "Open 24 hours", openHoursNote: "Emergency room", helipadCode: helipad,
    accredited: true, bookable: true, status: "published" as const,
  });
  await db.insert(s.hospitals).values([
    hosp(H.kingSalman, "king-salman", "King Salman Heart Center", "Cardiology services", "SA", "Saudi Arabia", 15, "logoKingFahad", "4.5", about.kingSalman, "TC LID:KSA1"),
    hosp(H.ernGuard, "ern-guard", "ERN GUARD-Heart", "Cardiothoracic hospital", "FR", "France", 7, "logoErn", "4.4", about.ernGuard, "TC LID:FRA2"),
    hosp(H.seoul, "seoul-national", "Seoul National University Hospital", "Cancer and Cardiology Services", "KR", "South Korea", 23, "logoSnuh", "4.7", about.seoul, "TC LID:KOR3"),
    hosp(H.burjeel, "burjeel", "Burjeel International Hospital", "Cardiology services", "SA", "Saudi Arabia", 15, "logoBurjeel", "4.5", about.burjeel, "TC LID:UAE4"),
    hosp(H.nyp, "ny-presbyterian", "New York-Presbyterian Hospital", "Neurology", "US", "USA", 5, "logoNyp", "4.6", about.nyp, "TC LID:CEM2"),
  ]);

  const SP = { friska: id(), lidya: id(), lidya2: id() };
  await db.insert(s.specialists).values([
    {
      id: SP.friska, fullName: "Dr. Friska James", shortName: "Dr. Friska",
      role: "Internal Medicine Specialist", specialization: "Internal Medicine Specialist",
      experienceLabel: "10+ Years of Experience", operationCountry: "United States",
      otherCountries: "Canada, Qatar", languages: "English, Arabic",
      expertise: [
        "Chronic disease management (diabetes, hypertension)",
        "Preventive care and health screenings",
        "Women’s health",
        "Telehealth consultations and remote monitoring",
      ],
      rating: "4.5", photoAsset: "doctor1", available: true, certified: true,
    },
    {
      id: SP.lidya, fullName: "Lidya Bey", shortName: "Lidya Bey",
      role: "Director of Nursing", specialization: "Director of Nursing",
      experienceLabel: "8+ Years of Experience", operationCountry: "United States",
      otherCountries: "Canada", languages: "English, French",
      expertise: ["Critical care nursing", "Patient advocacy", "Care team coordination"],
      rating: "4.5", photoAsset: "doctor2", available: true, certified: true,
    },
    {
      id: SP.lidya2, fullName: "Dr. Lidya Nour", shortName: "Dr. Lidya",
      role: "Nutrition and Dietetics", specialization: "Nutrition and Dietetics",
      experienceLabel: "6+ Years of Experience", operationCountry: "Canada",
      otherCountries: "UAE", languages: "English, Arabic",
      expertise: ["Clinical nutrition", "Diet planning for chronic conditions"],
      rating: "4.5", photoAsset: "doctor3", available: true, certified: true,
    },
  ]);
  const links = Object.values(H).flatMap((hid) =>
    [SP.friska, SP.lidya, SP.lidya2].map((sid, i) => ({ hospitalId: hid, specialistId: sid, sortOrder: i })),
  );
  await db.insert(s.hospitalSpecialists).values(links);

  // ---- transport providers + fleet -------------------------------------
  const P = { emsAir: id(), pacific: id(), uber: id(), harbour: id(), gulf: id() };
  const trusted = "Your trusted partner in Emergency Medical Services and Medical Repatriation. Bringing you and your loved ones safely home.";
  await db.insert(s.transportProviders).values([
    {
      id: P.emsAir, name: "Air Ambulance & Medical Repatriation", category: "ambulance",
      location: "London, ON", rating: "4.3", verified: false,
      priceFromAmount: 150000, description: "EMS is a medical repatriation company that specialises in worldwide patient transportation.",
      routes: "Worldwide aid  +136 countries", tags: "AIR Ambulance | Canada",
      heroAsset: "emirates", logoAsset: "logoEms", status: "published",
    },
    {
      id: P.pacific, name: "Pacific Western EMS", category: "ambulance",
      location: "Richmond, ON", rating: "4.5", verified: true,
      priceFromAmount: 245000, description: trusted,
      routes: "USA | Mexico | UK | India | Italy", tags: "AIR Ambulance | Canada",
      heroAsset: "medevac", logoAsset: "logoPacific", status: "published",
    },
    {
      id: P.uber, name: "Uber at YYC International Airport", category: "jet",
      location: "Calgary, CA", rating: "4.5", verified: true,
      priceFromAmount: 245000, description: trusted,
      routes: "USA | Mexico | UK | India | Italy", tags: "AIR Ambulance | Canada",
      heroAsset: "airportAerial", logoAsset: "logoUber", status: "published",
    },
    {
      id: P.harbour, name: "Harbour Medevac Marine", category: "boat",
      location: "Vancouver, CA", rating: "4.4", verified: true,
      priceFromAmount: 85000, description: "Fast medical rescue boats for coastal and harbour transfers, crewed by paramedics.",
      routes: "Vancouver | Victoria | New York | Los Angeles | Dubai | Seoul", tags: "Speed Boat | Coastal",
      heroAsset: "medevac", logoAsset: "logoEms", status: "published",
    },
    {
      id: P.gulf, name: "Gulf Air Rescue", category: "jet",
      location: "Dubai, AE", rating: "4.6", verified: true,
      priceFromAmount: 320000, description: "Long-range medical jets based in Dubai, serving the Gulf and East Asia.",
      routes: "UAE | Saudi Arabia | South Korea | India", tags: "Private Jet | Middle East",
      heroAsset: "emirates", logoAsset: "logoPacific", status: "published",
    },
  ]);
  const AC = { bombardier: id(), emsDouble: id() };
  const plane = (aid: string, pid: string, name: string, hero: string) => ({
    id: aid, providerId: pid, name,
    capacityLabel: "1 patient and up to 8 co-travelers", capacityNote: "up to 8 co-travelers",
    medicalCrew: "EMS-Physician", medicalCrewNote: "2nd Med Crew possible",
    paramedicLabel: "Paramedic:", maxAltitudeM: "15.550 m", maxAltitudeFt: "51.000 ft",
    priceAmount: 245000, heroAsset: hero,
  });
  // fleet is seeded for every provider so each detail screen has aircraft
  const fleet: (ReturnType<typeof plane>)[] = [];
  for (const pid of Object.values(P)) {
    if (pid === P.harbour) {
      // Boats get vessels, not aircraft, so a marine provider never lists a jet.
      fleet.push({ ...plane(id(), pid, "Rescue Speedboat 40", "medevac"), capacityLabel: "1 patient and up to 4 co-travelers", capacityNote: "up to 4 co-travelers", medicalCrew: "Paramedic crew", medicalCrewNote: "Physician on request", maxAltitudeM: "n/a", maxAltitudeFt: "n/a", priceAmount: 85000 });
      fleet.push({ ...plane(id(), pid, "Coastal Response Cruiser", "medevac"), capacityLabel: "2 patients and up to 6 co-travelers", capacityNote: "up to 6 co-travelers", medicalCrew: "Paramedic crew", medicalCrewNote: "Physician on request", maxAltitudeM: "n/a", maxAltitudeFt: "n/a", priceAmount: 140000 });
      continue;
    }
    fleet.push(plane(pid === P.uber ? AC.bombardier : id(), pid, "Bombardier Global Express", "jet"));
    fleet.push(plane(pid === P.uber ? AC.emsDouble : id(), pid, "EMS Double Engine", "pacific"));
  }
  await db.insert(s.aircraft).values(fleet);
  const facRows = fleet.flatMap((a) => [
    { id: id(), aircraftId: a.id, label: "ICU-care equipments", imageAsset: "facilityIcu", sortOrder: 0 },
    { id: id(), aircraftId: a.id, label: "Airline Stretcher", imageAsset: "facilityStretcher", sortOrder: 1 },
    { id: id(), aircraftId: a.id, label: "In Flight Care", imageAsset: "facilityGas", sortOrder: 2 },
  ]);
  await db.insert(s.aircraftFacilities).values(facRows);

  // ---- packages ---------------------------------------------------------
  const PK = { uae: id(), asia: id(), special: id(), ksa: id(), uaeFree: id() };
  const pkg = (pid: string, slug: string, title: string, hid: string, amount: number, label: string, loc: string, hero: string, desc: string) => ({
    id: pid, slug, title, hospitalId: hid, transportProviderId: P.uber,
    priceAmount: amount, priceLabel: label, locationLabel: loc, rating: "4.5",
    description: desc, heroAsset: hero, status: "published" as const,
  });
  const pdesc = "Your trusted partner in Emergency Medical Services and Medical Repatriation. Bringing you world class care.";
  await db.insert(s.medicalPackages).values([
    pkg(PK.uae, "uae-cardiology", "UAE Cardiology specialist", H.burjeel, 475000000000, "$4.75m", "Abu dhabi, UAE", "cardiacTreatment",
      "Your treatment covers Emergency Medical services and Key cell Regeneration, Plastic surgeries and more."),
    pkg(PK.asia, "asia-cardio", "Asia Cardio plan", H.seoul, 475000000000, "$4.75m", "Seoul, South Korea", "cancer", pdesc),
    pkg(PK.special, "special-cardio", "Special Cardio package", H.nyp, 275000000000, "$2.75m", "New York, United States", "icu", pdesc),
    pkg(PK.ksa, "ksa-cardio", "KSA cardio treatment", H.kingSalman, 475000000000, "$4.75m", "Jedah, Kingdom of Saudi Arabia", "surgery", pdesc),
    pkg(PK.uaeFree, "uae-free-cardio", "UAE free cardio treatment", H.nyp, 475000000000, "$4.75m", "New York, United States", "nurseDoctor", pdesc),
  ]);
  const incl: { id: string; packageId: string; label: string; sortOrder: number }[] = [];
  const inclusions: Record<string, string[]> = {
    [PK.uae]: ["First class logistics", "Accommodation", "Feeding"],
    [PK.asia]: ["First class logistics", "Accommodation"],
    [PK.special]: ["First class logistics", "Accommodation", "Feeding"],
    [PK.ksa]: ["First class logistics", "Feeding"],
    [PK.uaeFree]: ["First class logistics", "Accommodation", "Feeding"],
  };
  for (const [pid, labels] of Object.entries(inclusions))
    labels.forEach((label, i) => incl.push({ id: id(), packageId: pid, label, sortOrder: i }));
  await db.insert(s.packageInclusions).values(incl);

  // ---- pet clinics, promos, independent categories ----------------------
  // pet clinics and their services are seeded in seed-services.ts

  await db.insert(s.promoSlides).values([
    { id: id(), title: "Asia Cancer specialists", subtitle: "First class logistics | Accommodation | feeding", priceLabel: "$4.75M", packageId: PK.asia, imageAsset: "cancer", sortOrder: 0 },
    { id: id(), title: "UAE Cardiology specialists", subtitle: "First class logistics | Accommodation | feeding", priceLabel: "$4.75M", packageId: PK.uae, imageAsset: "cardiacTreatment", sortOrder: 1 },
    { id: id(), title: "Special Cardio package", subtitle: "First class logistics | Accommodation | feeding", priceLabel: "$2.75M", packageId: PK.special, imageAsset: "icu", sortOrder: 2 },
  ]);
  await db.insert(s.independentSpecialistCategories).values([
    { id: id(), title: "Private Nurses", countLabel: "+54k Specialists", imageAsset: "privateNurse", sortOrder: 0 },
    { id: id(), title: "Animal Care Givers", countLabel: "+13k Specialists", imageAsset: "petCare", sortOrder: 1 },
    { id: id(), title: "Care Givers", countLabel: "+554k Specialists", imageAsset: "facilityGas", sortOrder: 2 },
  ]);

  await seedServices(db, P);

  // ---- plans ------------------------------------------------------------
  await db.insert(s.plans).values([
    {
      id: id(), code: "basic", name: "MedPilot Basic", priceAmount: 0, interval: "month",
      features: ["1 meal Analysis", "10  access to local medical clinic", "2 access to medical evacuation services", "Upgrade Anytime"],
    },
    {
      id: id(), code: "pro", name: "MedPilot Pro", priceAmount: 1000, interval: "month",
      appleProductId: "app.medpilot.pro.monthly", googleProductId: "pro_monthly",
      features: ["Unlimited meal Analysis", "Unlimited Access to medical clinic", "Unlimited access to medical evacuation services", "Cancel Anytime"],
    },
  ]);

  const counts = await db.execute(sql`
    select 'hospitals' t, count(*) n from hospitals
    union all select 'specialists', count(*) from specialists
    union all select 'packages', count(*) from medical_packages
    union all select 'providers', count(*) from transport_providers
    union all select 'aircraft', count(*) from aircraft
    union all select 'pet_clinics', count(*) from pet_clinics
    union all select 'locations', count(*) from locations
    union all select 'coverage', count(*) from transport_provider_coverage
    union all select 'pet_services', count(*) from pet_services
    union all select 'indep_specialists', count(*) from independent_specialists
    union all select 'plans', count(*) from plans
  `);
  console.table(counts.rows);
  await pool.end();
}
main().catch((e) => { console.error(e); process.exit(1); });
