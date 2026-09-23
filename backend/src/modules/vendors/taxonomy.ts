/**
 * The provider taxonomy. Everything the portal shows for a provider type — its categories, the
 * type-specific listing fields, and what a listing needs before it can be published — comes from here,
 * served to the app through GET /v1/provider/taxonomy. Adding a provider type or category means adding
 * an entry to this file; no client release is needed.
 */
export type FieldInput = "text" | "textarea" | "number" | "select" | "multiselect" | "toggle";

export interface FieldDef {
  key: string;
  label: string;
  input: FieldInput;
  required?: boolean;
  options?: { value: string; label: string }[];
  help?: string;
  /** Only shown for this kind of listing. Omit for both. */
  kind?: "service" | "package";
}

interface Sub { code: string; label: string }
export interface Category { code: string; label: string; subcategories: Sub[] }

type Family = "medical" | "veterinary" | "sitting" | "transport" | "nursing" | "tourism" | "other";

const opt = (...pairs: [string, string][]) => pairs.map(([value, label]) => ({ value, label }));
const cat = (code: string, label: string, subs: [string, string][]): Category => ({
  code, label, subcategories: subs.map(([c, l]) => ({ code: c, label: l })),
});

const FAMILY_FIELDS: Record<Family, FieldDef[]> = {
  medical: [
    { key: "specialty", label: "Specialty", input: "text", required: true, help: "e.g. Cardiology" },
    { key: "consultation_modes", label: "Consultation type", input: "multiselect", options: opt(["in_person", "In person"], ["video", "Video call"]), required: true },
    { key: "accepts_insurance", label: "Accepts insurance", input: "toggle" },
    { key: "requires_referral", label: "Referral required", input: "toggle" },
  ],
  veterinary: [
    { key: "species", label: "Animals treated", input: "multiselect", required: true, options: opt(["dog", "Dogs"], ["cat", "Cats"], ["horse", "Horses"], ["bird", "Birds"], ["small_animal", "Small animals"], ["other", "Other"]) },
    { key: "emergency_available", label: "Emergency cases accepted", input: "toggle" },
  ],
  sitting: [
    { key: "species", label: "Animals cared for", input: "multiselect", required: true, options: opt(["dog", "Dogs"], ["cat", "Cats"], ["horse", "Horses"], ["bird", "Birds"], ["small_animal", "Small animals"], ["other", "Other"]) },
    { key: "max_pets", label: "Most pets at once", input: "number", required: true },
    { key: "overnight", label: "Overnight care", input: "toggle" },
    { key: "daily_updates", label: "Daily photo updates", input: "toggle" },
  ],
  transport: [
    { key: "vehicle_type", label: "Vehicle", input: "select", required: true, options: opt(["ambulance", "Ambulance"], ["jet", "Air ambulance / jet"], ["boat", "Speed boat"], ["car", "Car"], ["van", "Accessible van"]) },
    { key: "passenger_capacity", label: "Passengers (besides the patient)", input: "number", required: true },
    { key: "medical_crew", label: "Medical crew on board", input: "select", options: opt(["none", "None"], ["paramedic", "Paramedic"], ["nurse", "Nurse"], ["doctor", "Doctor"]) },
    { key: "oxygen_equipment", label: "Oxygen equipment", input: "toggle" },
    { key: "stretcher", label: "Stretcher", input: "toggle" },
    { key: "coverage_note", label: "Routes or coverage notes", input: "textarea" },
  ],
  nursing: [
    { key: "qualification", label: "Qualification", input: "select", required: true, options: opt(["rn", "Registered nurse"], ["lpn", "Licensed practical nurse"], ["carer", "Certified care assistant"]) },
    { key: "shift_types", label: "Shifts offered", input: "multiselect", required: true, options: opt(["day", "Day"], ["night", "Night"], ["live_in", "Live-in"]) },
    { key: "years_experience", label: "Years of experience", input: "number" },
    { key: "specialisations", label: "Specialisations", input: "text" },
  ],
  tourism: [
    { key: "destination_country", label: "Destination country", input: "text", required: true },
    { key: "treatment_type", label: "Treatment", input: "text", required: true, help: "e.g. Knee replacement" },
    { key: "package_days", label: "Total days", input: "number", kind: "package", required: true },
    { key: "includes_accommodation", label: "Accommodation included", input: "toggle" },
    { key: "includes_transport", label: "Transport included", input: "toggle" },
  ],
  other: [],
};

interface TypeDef {
  label: string;
  family: Family;
  categories: Category[];
  /** What a listing of this type is measured in. Drives whether a duration/slot length is required. */
  bookable: boolean;
}

const MEDICAL_CATS = [
  cat("consultation", "Consultation", [["general", "General consultation"], ["specialist", "Specialist consultation"], ["follow_up", "Follow-up"]]),
  cat("diagnostics", "Diagnostics", [["imaging", "Imaging"], ["laboratory", "Laboratory tests"], ["screening", "Screening"]]),
  cat("procedure", "Procedures & surgery", [["minor", "Minor procedure"], ["surgery", "Surgery"], ["day_case", "Day case"]]),
  cat("emergency", "Emergency services", [["urgent_care", "Urgent care"], ["emergency", "Emergency"]]),
  cat("rehabilitation", "Rehabilitation", [["physio", "Physiotherapy"], ["recovery", "Recovery programme"]]),
];

export const PROVIDER_TYPES: Record<string, TypeDef> = {
  hospital: { label: "Hospital", family: "medical", bookable: true, categories: MEDICAL_CATS },
  clinic: { label: "Medical clinic", family: "medical", bookable: true, categories: MEDICAL_CATS },
  independent_specialist: { label: "Independent medical specialist", family: "medical", bookable: true, categories: MEDICAL_CATS.slice(0, 3) },
  independent_consultant: {
    label: "Independent consultant", family: "medical", bookable: true,
    categories: [cat("consultation", "Consultation", [["general", "General consultation"], ["second_opinion", "Second opinion"], ["care_planning", "Care planning"]])],
  },
  vet_clinic: {
    label: "Veterinary clinic", family: "veterinary", bookable: true,
    categories: [
      cat("consultation", "Veterinary consultation", [["general", "General check-up"], ["specialist", "Specialist consultation"]]),
      cat("surgery", "Surgery", [["routine", "Routine surgery"], ["complex", "Complex surgery"]]),
      cat("vaccination", "Vaccination", [["core", "Core vaccines"], ["travel", "Travel vaccines"]]),
      cat("grooming", "Grooming", [["bath", "Bath & brush"], ["full", "Full groom"], ["nails", "Nail care"]]),
      cat("diagnostics", "Diagnostics", [["imaging", "Imaging"], ["laboratory", "Laboratory tests"]]),
      cat("boarding", "Pet boarding", [["day", "Day care"], ["overnight", "Overnight"]]),
    ],
  },
  pet_specialist: {
    label: "Pet specialist", family: "veterinary", bookable: true,
    categories: [
      cat("grooming", "Grooming", [["bath", "Bath & brush"], ["full", "Full groom"]]),
      cat("training", "Training", [["basic", "Basic training"], ["behaviour", "Behaviour"]]),
      cat("consultation", "Consultation", [["nutrition", "Nutrition"], ["general", "General"]]),
    ],
  },
  pet_sitter: {
    label: "Pet sitter", family: "sitting", bookable: true,
    categories: [cat("sitting", "Pet sitting", [["visit", "Home visit"], ["overnight", "Overnight stay"], ["boarding", "Boarding at sitter's home"], ["walking", "Dog walking"]])],
  },
  transport_company: {
    label: "Transport company", family: "transport", bookable: true,
    categories: [
      cat("ground", "Ground transportation", [["car", "Private car"], ["van", "Accessible van"], ["airport_transfer", "Airport transfer"]]),
      cat("air", "Air transport", [["private_jet", "Private jet"], ["charter", "Charter"]]),
      cat("sea", "Sea transport", [["speed_boat", "Speed boat"]]),
    ],
  },
  private_transport: {
    label: "Private transportation provider", family: "transport", bookable: true,
    categories: [cat("ground", "Ground transportation", [["car", "Private car"], ["van", "Accessible van"], ["airport_transfer", "Airport transfer"]]), cat("escort", "Medical escort", [["escort", "Escort"]])],
  },
  medical_transport: {
    label: "Medical transportation provider", family: "transport", bookable: true,
    categories: [
      cat("ambulance", "Medical ambulance", [["ground", "Ground ambulance"], ["air", "Air ambulance"], ["repatriation", "Repatriation"]]),
      cat("air", "Air transport", [["private_jet", "Private jet"]]),
      cat("sea", "Sea transport", [["speed_boat", "Speed boat"]]),
      cat("escort", "Medical escort", [["escort", "Escort"]]),
    ],
  },
  private_nurse: {
    label: "Private nurse", family: "nursing", bookable: true,
    categories: [
      cat("home_nursing", "Home nursing", [["general", "General nursing"], ["wound_care", "Wound care"]]),
      cat("post_surgery", "Post-surgery care", [["recovery", "Recovery care"], ["dressing", "Dressing changes"]]),
      cat("elder_care", "Elder care", [["daily", "Daily care"], ["dementia", "Dementia care"]]),
      cat("medication", "Medication assistance", [["administration", "Administration"], ["monitoring", "Monitoring"]]),
      cat("recovery_support", "Recovery support", [["mobility", "Mobility support"], ["companion", "Companion care"]]),
    ],
  },
  medical_tourism: {
    label: "Medical tourism provider", family: "tourism", bookable: true,
    categories: [
      cat("treatment", "Treatment packages", [["treatment", "Treatment"], ["second_opinion", "Second opinion"]]),
      cat("surgery", "Surgery packages", [["surgery", "Surgery"]]),
      cat("accommodation", "Accommodation packages", [["hotel", "Hotel stay"], ["recovery_stay", "Recovery stay"]]),
      cat("transportation", "Transportation packages", [["transfers", "Transfers"], ["flights", "Flights"]]),
      cat("complete", "Complete medical travel packages", [["complete", "All-inclusive"]]),
    ],
  },
  other: { label: "Other provider", family: "other", bookable: true, categories: [cat("general", "General service", [["general", "General"]])] },
};

const COMMON_FIELDS: FieldDef[] = [
  { key: "requirements", label: "Requirements", input: "textarea", help: "What the customer needs to bring or provide" },
  { key: "preparation", label: "Preparation instructions", input: "textarea" },
];
export { COMMON_FIELDS };

export const LOCATION_MODES = [
  { value: "onsite", label: "At the provider's location" },
  { value: "home", label: "Home visit" },
  { value: "remote", label: "Remote / online" },
];
export const PRICE_TYPES = [
  { value: "fixed", label: "Fixed price" },
  { value: "from", label: "Starting from" },
  { value: "per_hour", label: "Per hour" },
  { value: "per_day", label: "Per day" },
  { value: "quote", label: "Price on request" },
];

export const typeOf = (t: string) => PROVIDER_TYPES[t];
export const fieldsFor = (providerType: string, kind: "service" | "package"): FieldDef[] => {
  const def = PROVIDER_TYPES[providerType];
  if (!def) return [];
  return FAMILY_FIELDS[def.family].filter((f) => !f.kind || f.kind === kind);
};

export function categoryLabel(providerType: string, category: string, subcategory?: string) {
  const c = PROVIDER_TYPES[providerType]?.categories.find((x) => x.code === category);
  const sub = c?.subcategories.find((x) => x.code === subcategory);
  return { category: c?.label ?? category, subcategory: sub?.label ?? subcategory ?? "" };
}

/** The whole taxonomy in the shape the app renders forms from. */
export function taxonomyForClient() {
  return {
    providerTypes: Object.entries(PROVIDER_TYPES).map(([code, d]) => ({
      code, label: d.label, family: d.family, categories: d.categories,
      serviceFields: fieldsFor(code, "service"), packageFields: fieldsFor(code, "package"),
    })),
    commonFields: COMMON_FIELDS, locationModes: LOCATION_MODES, priceTypes: PRICE_TYPES,
  };
}
