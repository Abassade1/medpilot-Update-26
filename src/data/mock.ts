import { ImageSourcePropType } from "react-native";

export const images = {
  // Brand assets exported from the Figma file
  logoMark: require("../../assets/images/logo-mark.png"),
  avatar: require("../../assets/images/avatar.jpg"),
  cancer: require("../../assets/images/cancer.png"),
  cardiacTreatment: require("../../assets/images/cardiac-treatment.png"),
  privateNurse: require("../../assets/images/private-nurse.png"),
  petCare: require("../../assets/images/pet-care.png"),
  nurseDoctor: require("../../assets/images/nurse-doctor.png"),
  svcMedevac: require("../../assets/images/svc-medevac.png"),
  svcDna: require("../../assets/images/svc-dna.png"),
  svcPet: require("../../assets/images/svc-pet.png"),
  svcBrain: require("../../assets/images/svc-brain.png"),
  svcHand: require("../../assets/images/svc-hand.png"),
  logoKingFahad: require("../../assets/images/logo-king-fahad.png"),
  logoErn: require("../../assets/images/logo-ern.png"),
  logoSnuh: require("../../assets/images/logo-snuh.png"),
  logoBurjeel: require("../../assets/images/logo-burjeel.png"),
  logoNyp: require("../../assets/images/logo-nyp.png"),
  emirates: require("../../assets/images/emirates.png"),
  medevac: require("../../assets/images/medevac.png"),
  pacific: require("../../assets/images/pacific.png"),
  airportAerial: require("../../assets/images/airport-aerial.png"),
  logoEms: require("../../assets/images/logo-ems.png"),
  logoPacific: require("../../assets/images/logo-pacific.png"),
  logoUber: require("../../assets/images/logo-uber.png"),
  facilityIcu: require("../../assets/images/facility-icu.png"),
  facilityStretcher: require("../../assets/images/facility-stretcher.png"),
  facilityGas: require("../../assets/images/facility-gas.png"),
  illusMailbox: require("../../assets/images/illus-mailbox.png"),
  illusRecords: require("../../assets/images/illus-records.png"),
  illusPassword: require("../../assets/images/illus-password.png"),
  faceId: require("../../assets/images/face-id.png"),
  opticId: require("../../assets/images/optic-id.png"),
  tabHome: require("../../assets/images/tab-home.png"),
  tabActivities: require("../../assets/images/tab-activities.png"),
  tabAux: require("../../assets/images/tab-aux.png"),
  tabAppointments: require("../../assets/images/tab-appointments.png"),
  // Generic placeholder photos (no direct Figma export available)
  surgery: require("../../assets/images/surgery.jpg"),
  icu: require("../../assets/images/icu.jpg"),
  jet: require("../../assets/images/jet.jpg"),
  food: require("../../assets/images/food.jpg"),
  doctor1: require("../../assets/images/doctor1.jpg"),
  doctor2: require("../../assets/images/doctor2.jpg"),
  petVet: require("../../assets/images/pet-vet.jpg"),
  horses: require("../../assets/images/horses.jpg"),
  dogGroom: require("../../assets/images/dog-groom.jpg"),
  woman1: require("../../assets/images/woman1.jpg"),
  woman2: require("../../assets/images/woman2.jpg"),
} as const;

export const currentUser = {
  firstName: "Mohammed",
  lastName: "Uwaiz",
  fullName: "Mohammed-Uwaiz",
  email: "mohammed-Uwaiz@gmail.com",
  location: "Ontario, CA",
  avatar: images.avatar,
};

export interface Hospital {
  id: string;
  name: string;
  specialty: string;
  country: string;
  specialists: number;
  logo: ImageSourcePropType;
  logoColor: string;
  logoText: string;
  rating: number;
  about: string;
  careSystem: string;
  openHours: string;
  openHoursNote: string;
  helipad: string;
}

export const hospitals: Hospital[] = [
  {
    id: "king-salman",
    name: "King Salman Heart Center",
    specialty: "Cardiology services",
    country: "Saudi Arabia",
    specialists: 15,
    logo: images.logoKingFahad,
    logoColor: "#F4EFE7",
    logoText: "KS",
    rating: 4.5,
    about:
      "King Salman Heart Center is a leading cardiology institute providing advanced cardiac care, surgery and rehabilitation services across the region.",
    careSystem: "Special health service",
    openHours: "Open 24 hours",
    openHoursNote: "Emergency room",
    helipad: "TC LID:KSA1",
  },
  {
    id: "ern-guard",
    name: "ERN GUARD-Heart",
    specialty: "Cardiothoracic hospital",
    country: "France",
    specialists: 7,
    logo: images.logoErn,
    logoColor: "#DFF0EE",
    logoText: "EG",
    rating: 4.4,
    about:
      "ERN GUARD-Heart is a European reference network for rare and complex diseases of the heart, connecting the best cardiothoracic specialists.",
    careSystem: "Special health service",
    openHours: "Open 24 hours",
    openHoursNote: "Emergency room",
    helipad: "TC LID:FRA2",
  },
  {
    id: "seoul-national",
    name: "Seoul National University Hospital",
    specialty: "Cancer and Cardiology Services",
    country: "South Korea",
    specialists: 23,
    logo: images.logoSnuh,
    logoColor: "#1D3D8F",
    logoText: "SNUH",
    rating: 4.7,
    about:
      "Seoul National University Hospital is a world-class academic medical center known for oncology and cardiology excellence.",
    careSystem: "Special health service",
    openHours: "Open 24 hours",
    openHoursNote: "Emergency room",
    helipad: "TC LID:KOR3",
  },
  {
    id: "burjeel",
    name: "Burjeel International Hospital",
    specialty: "Cardiology services",
    country: "Saudi Arabia",
    specialists: 15,
    logo: images.logoBurjeel,
    logoColor: "#F3E4F1",
    logoText: "BJ",
    rating: 4.5,
    about:
      "Burjeel International Hospital delivers premium tertiary care with an emphasis on cardiology and surgical excellence.",
    careSystem: "Special health service",
    openHours: "Open 24 hours",
    openHoursNote: "Emergency room",
    helipad: "TC LID:UAE4",
  },
  {
    id: "ny-presbyterian",
    name: "New York-Presbyterian Hospital",
    specialty: "Neurology",
    country: "USA",
    specialists: 5,
    logo: images.logoNyp,
    logoColor: "#E02D2D",
    logoText: "NYP",
    rating: 4.6,
    about:
      "NewYork-Presbyterian is one of the nation's most comprehensive, integrated academic health care delivery systems, dedicated to providing the highest quality, most compassionate care.",
    careSystem: "Special health service",
    openHours: "Open 24 hours",
    openHoursNote: "Emergency room",
    helipad: "TC LID:CEM2",
  },
];

export interface Specialist {
  id: string;
  name: string;
  /** Shortened name used on the compact specialist cards (per Figma). */
  cardName: string;
  role: string;
  rating: number;
  photo: ImageSourcePropType;
  available: boolean;
  certified: boolean;
  specialization: string;
  experience: string;
  operationCountry: string;
  operationCountryNote: string;
  languages: string;
  expertise: string[];
}

export const specialists: Specialist[] = [
  {
    id: "friska",
    name: "Dr. Friska James",
    cardName: "Dr. Friska",
    role: "Internal Medicine Specialist",
    rating: 4.5,
    photo: images.doctor1,
    available: true,
    certified: true,
    specialization: "Internal Medicine Specialist",
    experience: "10+ Years of Experience",
    operationCountry: "United States",
    operationCountryNote: "Canada, Qatar",
    languages: "English, Arabic",
    expertise: [
      "Chronic disease management (diabetes, hypertension)",
      "Preventive care and health screenings",
      "Women’s health",
      "Telehealth consultations and remote monitoring",
    ],
  },
  {
    id: "lidya",
    name: "Lidya Bey",
    cardName: "Lidya Bey",
    role: "Director of Nursing",
    rating: 4.5,
    photo: images.doctor2,
    available: true,
    certified: true,
    specialization: "Director of Nursing",
    experience: "8+ Years of Experience",
    operationCountry: "United States",
    operationCountryNote: "Canada",
    languages: "English, French",
    expertise: [
      "Critical care nursing leadership",
      "Patient safety and quality programs",
      "Telehealth consultations and remote monitoring",
    ],
  },
  {
    id: "lidya-2",
    name: "Dr. Lidya Nour",
    cardName: "Dr. Lidya",
    role: "Nutritionist",
    rating: 4.4,
    photo: require("../../assets/images/doctor3.jpg"),
    available: true,
    certified: true,
    specialization: "Clinical Nutritionist",
    experience: "6+ Years of Experience",
    operationCountry: "Canada",
    operationCountryNote: "Qatar",
    languages: "English, Arabic",
    expertise: [
      "Clinical nutrition therapy",
      "Metabolic health programs",
      "Diet planning for chronic conditions",
    ],
  },
];

export interface ServiceItem {
  id: string;
  title: string;
  description: string;
  color: string;
  image: ImageSourcePropType;
}

export const services: ServiceItem[] = [
  {
    id: "transport",
    title: "Medivac Transportation",
    description: "Medical Ambulance, Private jets, Speed boats",
    color: "#F9C1BE",
    image: images.svcMedevac,
  },
  {
    id: "specialist",
    title: "Specialist Treatments",
    description: "Cancer centres, Cardiac, Neurology emergency",
    color: "#BFE3B4",
    image: images.svcDna,
  },
  {
    id: "pet",
    title: "Pet Specialist",
    description: "Pet Bathing, Vet Doctors, Pet sitters",
    color: "#FCE1A0",
    image: images.svcPet,
  },
  {
    id: "organs",
    title: "Organs Upgrade",
    description: "Upgrade organs, blood and organs-on-chips",
    color: "#CDC4F1",
    image: images.svcBrain,
  },
  {
    id: "chronic",
    title: "Chronic Prescriptions",
    description: "Chronic Drugs, Pharmacies, Pharmacists",
    color: "#A9D3F5",
    image: images.svcHand,
  },
];

export interface MedicalPackage {
  id: string;
  title: string;
  price: string;
  image: ImageSourcePropType;
  hospitalId: string;
  location: string;
  rating: number;
  description: string;
  packageInclude: string[];
}

export const medicalPackages: MedicalPackage[] = [
  {
    id: "uae-cardiology",
    title: "UAE Cardiology specialist",
    price: "$4.75m",
    image: images.cardiacTreatment,
    hospitalId: "burjeel",
    location: "Abu dhabi, UAE",
    rating: 4.5,
    description:
      "Your treatment covers Emergency Medical services and Key cell Regeneration, Plastic surgeries and more.",
    packageInclude: ["First class logistics", "Accommodation", "Feeding"],
  },
  {
    id: "asia-cardio",
    title: "Asia Cardio plan",
    price: "$4.75m",
    image: images.cancer,
    hospitalId: "seoul-national",
    location: "Seoul, South Korea",
    rating: 4.5,
    description:
      "Your trusted partner in Emergency Medical Services and Medical Repatriation. Bringing you world class care.",
    packageInclude: ["First class logistics", "Accommodation"],
  },
  {
    id: "special-cardio",
    title: "Special Cardio package",
    price: "$2.75m",
    image: images.icu,
    hospitalId: "ny-presbyterian",
    location: "New York, United States",
    rating: 4.5,
    description:
      "Your trusted partner in Emergency Medical Services and Medical Repatriation. Bringing you world class care.",
    packageInclude: ["First class logistics", "Accommodation", "Feeding"],
  },
  {
    id: "ksa-cardio",
    title: "KSA cardio treatment",
    price: "$4.75m",
    image: images.surgery,
    hospitalId: "king-salman",
    location: "Jedah, Kingdom of Saudi Arabia",
    rating: 4.5,
    description:
      "Your trusted partner in Emergency Medical Services and Medical Repatriation. Bringing you world class care.",
    packageInclude: ["First class logistics", "Feeding"],
  },
  {
    id: "uae-free-cardio",
    title: "UAE free cardio treatment",
    price: "$4.75m",
    image: images.nurseDoctor,
    hospitalId: "ny-presbyterian",
    location: "New York, United States",
    rating: 4.5,
    description:
      "Your trusted partner in Emergency Medical Services and Medical Repatriation. Bringing you world class care.",
    packageInclude: ["First class logistics", "Accommodation", "Feeding"],
  },
];

export interface IndependentSpecialistCategory {
  id: string;
  title: string;
  count: string;
  image: ImageSourcePropType;
}

export const independentSpecialists: IndependentSpecialistCategory[] = [
  { id: "nurses", title: "Private Nurses", count: "+54k Specialists", image: images.privateNurse },
  { id: "animal", title: "Animal Care Givers", count: "+13k Specialists", image: images.petCare },
  { id: "caregivers", title: "Care Givers", count: "+554k Specialists", image: images.facilityGas },
];

export interface Aircraft {
  id: string;
  name: string;
  capacity: string;
  image: ImageSourcePropType;
  price: string;
  capacityNote: string;
  medicalCrew: string;
  medicalCrewNote: string;
  paramedic: string;
  maxAltitude: string;
  maxAltitudeFt: string;
}

export const aircrafts: Aircraft[] = [
  {
    id: "bombardier",
    name: "Bombardier Global Express",
    capacity: "1 patient and up to 8 co-travelers",
    image: images.jet,
    price: "$2,450.00",
    capacityNote: "up to 8 co-travelers",
    medicalCrew: "EMS-Physician",
    medicalCrewNote: "2nd Med Crew possible",
    paramedic: "Paramedic:",
    maxAltitude: "15.550 m",
    maxAltitudeFt: "51.000 ft",
  },
  {
    id: "ems-double",
    name: "EMS Double Engine",
    capacity: "1 patient and up to 8 co-travellers",
    image: images.pacific,
    price: "$2,450.00",
    capacityNote: "up to 8 co-travelers",
    medicalCrew: "EMS-Physician",
    medicalCrewNote: "2nd Med Crew possible",
    paramedic: "Paramedic:",
    maxAltitude: "15.550 m",
    maxAltitudeFt: "51.000 ft",
  },
];

export interface TransportProvider {
  id: string;
  name: string;
  location: string;
  rating: number;
  verified: boolean;
  price: string;
  image: ImageSourcePropType;
  logo: ImageSourcePropType;
  logoText: string;
  logoColor: string;
  logoDark?: boolean;
  description: string;
  routes: string;
  category: "jet" | "ambulance" | "boat";
  tags: string;
}

export const transportProviders: TransportProvider[] = [
  {
    id: "ems-air",
    name: "Air Ambulance & Medical Repatriation",
    location: "London, ON",
    rating: 4.3,
    verified: false,
    price: "$1,500.00",
    image: images.emirates,
    logo: images.logoEms,
    logoText: "EMS",
    logoColor: "#FFFFFF",
    description:
      "EMS is a medical repatriation company that specialises in worldwide patient transportation.",
    routes: "Worldwide aid  +136 countries",
    category: "ambulance",
    tags: "AIR Ambulance | Canada",
  },
  {
    id: "pacific-western",
    name: "Pacific Western EMS",
    location: "Richmond, ON",
    rating: 4.5,
    verified: true,
    price: "$2,450.00",
    image: images.medevac,
    logo: images.logoPacific,
    logoText: "PW",
    logoColor: "#20315C",
    description:
      "Your trusted partner in Emergency Medical Services and Medical Repatriation. Bringing you and your loved ones safely home.",
    routes: "USA | Mexico | UK | India | Italy",
    category: "ambulance",
    tags: "AIR Ambulance | Canada",
  },
  {
    id: "uber-yyc",
    name: "Uber at YYC International Airport",
    location: "Calgary, CA",
    rating: 4.5,
    verified: true,
    price: "$2,450.00",
    image: images.airportAerial,
    logo: images.logoUber,
    logoText: "Uber",
    logoColor: "#000000",
    logoDark: true,
    description:
      "Your trusted partner in Emergency Medical Services and Medical Repatriation. Bringing you and your loved ones safely home.",
    routes: "USA | Mexico | UK | India | Italy",
    category: "jet",
    tags: "AIR Ambulance | Canada",
  },
];

export interface PetClinic {
  id: string;
  name: string;
  location: string;
  rating: number;
  price: string;
  image: ImageSourcePropType;
  logoEmoji: string;
  description: string;
  openTo: string;
  category: "vet" | "pedicure" | "sitters";
}

export const petClinics: PetClinic[] = [
  {
    id: "pet-life",
    name: "Pet+Life Veterinary Clinic",
    location: "Tokyo, Japan",
    rating: 4.5,
    price: "$449.00",
    image: images.petVet,
    logoEmoji: "🦊",
    description:
      "We provide assistance for exporting and importing pets as well as pet hotel services",
    openTo: "USA | Mexico | UK | India | Italy",
    category: "pedicure",
  },
  {
    id: "russell-equine",
    name: "Russell Equine Veterinary Service",
    location: "Ontario Canada",
    rating: 4.5,
    price: "$449.00",
    image: images.horses,
    logoEmoji: "🐎",
    description:
      "We are consistently pushing to offer the best in both diagnostic and therapeutic modalities to our clients",
    openTo: "Canada | USA",
    category: "pedicure",
  },
  {
    id: "bonnieland",
    name: "Bonnieland Puppy Parlor",
    location: "Calgary, Canada",
    rating: 4.5,
    price: "$449.00",
    image: images.dogGroom,
    logoEmoji: "🐶",
    description:
      "Grooming Calgary is focused on high-quality service and customer satisfaction",
    openTo: "USA | Mexico | UK | India | Italy",
    category: "pedicure",
  },
];

export interface MedicalAppointment {
  id: string;
  hospitalId: string;
  type: string;
  location: string;
  date: string;
  contactName: string;
  contactRole: string;
  contactPhoto: ImageSourcePropType;
  bookingId: string;
}

export const medicalAppointments: MedicalAppointment[] = [
  {
    id: "a1",
    hospitalId: "burjeel",
    type: "Surgery",
    location: "Abu-dhabi, UAE",
    date: "03 April, 2024 | 4:10 PM",
    contactName: "Waleed Junaid",
    contactRole: "Specialist Consultant",
    contactPhoto: images.doctor1,
    bookingId: "#CA25-3198-324",
  },
  {
    id: "a2",
    hospitalId: "ny-presbyterian",
    type: "Check-up",
    location: "Jedah, Kingdom of Saudi Arabia",
    date: "13 June, 2024 | 4:56 PM",
    contactName: "Ana Jade",
    contactRole: "Senior Consultant",
    contactPhoto: images.doctor2,
    bookingId: "#CA15-9420-247",
  },
  {
    id: "a3",
    hospitalId: "king-salman",
    type: "Check-up",
    location: "Jedah, Kingdom of Saudi Arabia",
    date: "25 Jan, 2024 | 1:56 PM",
    contactName: "Muhammed Oqud",
    contactRole: "Senior Consultant",
    contactPhoto: require("../../assets/images/doctor3.jpg"),
    bookingId: "#CA15-9420-247",
  },
  {
    id: "a4",
    hospitalId: "seoul-national",
    type: "Check-up",
    location: "Jedah, Kingdom of Saudi Arabia",
    date: "19 Aug, 2024 | 8:50 PM",
    contactName: "Michael Gardner",
    contactRole: "Senior Specialist Consultant",
    contactPhoto: images.doctor1,
    bookingId: "#CA25-3198-324",
  },
];

export interface TransportBooking {
  id: string;
  fromCode: string;
  fromCity: string;
  fromTime: string;
  toCode: string;
  toCity: string;
  toTime: string;
  duration: string;
  departureDate: string;
  flightNumber: string;
  providerId: string;
}

export const transportBookings: TransportBooking[] = [
  {
    id: "t1",
    fromCode: "YYC",
    fromCity: "Calgary",
    fromTime: "07h05",
    toCode: "AUH",
    toCity: "Abu dhabi",
    toTime: "09h15",
    duration: "12h/35m",
    departureDate: "Feb 25, 2023",
    flightNumber: "AB689",
    providerId: "uber-yyc",
  },
  {
    id: "t2",
    fromCode: "YYC",
    fromCity: "Calgary",
    fromTime: "07h05",
    toCode: "AUH",
    toCity: "Abu dhabi",
    toTime: "09h15",
    duration: "12h/35m",
    departureDate: "Feb 25, 2023",
    flightNumber: "AB689",
    providerId: "uber-yyc",
  },
];

export const medicalConditions = [
  "High Blood Pressure",
  "Heart Attack/Disease",
  "Joint pain",
  "Mental Problems",
  "Seizures/Epilepsy",
  "Osteoporosis",
];

export const appointmentTypes = ["General Check-up", "Specialist Consultation", "Surgery"];

export const transportPurposes = [
  "Doctor’s Appointment",
  "Hospital Admission",
  "Surgery",
  "Physical Therapy",
  "Dialysis",
];

export const specialMedicalNeeds = [
  "In Flight Oxygen Support",
  "ICU Care Equipment",
  "Wheelchair assistance",
  "Stretcher on arrival",
  "Accompanying medical escort",
];

export const heroSlides = [
  {
    id: "h1",
    title: "Asia Cancer specialists",
    price: "$4.75M",
    subtitle: "First class logistics | Accommodation | feeding",
    image: images.cancer,
  },
  {
    id: "h2",
    title: "UAE Cardiology specialists",
    price: "$4.75M",
    subtitle: "First class logistics | Accommodation | feeding",
    image: images.cardiacTreatment,
  },
  {
    id: "h3",
    title: "Special Cardio package",
    price: "$2.75M",
    subtitle: "First class logistics | Accommodation | feeding",
    image: images.icu,
  },
];

export const uploadedFiles = [
  { id: "f1", name: "clifford-hospital-medical-record.doc", size: "192 kb", type: "doc" as const },
  { id: "f2", name: "clifford-hospital-medical-record.pdf", size: "192 kb", type: "pdf" as const },
  { id: "f3", name: "Ultroscan-test-result.pdf", size: "192 kb", type: "pdf" as const },
];

export const diagnosisSymptoms = ["Coughing", "Chest pain", "Difficult breathing", "Severe headache"];

export const diagnosisConditions = ["Cancer", "Diabetics", "Tuberculosis", "High Blood Pressure", "None"];

export const diagnosisResult = {
  title: "Chest pain",
  summary:
    "Fast and/or difficult breathing — your breathing will become hard work, and you may see the ribs or skin under the neck “sucking in” or nostrils flaring when they are breathing, younger babies may bob their heads when breathing.",
  possibleCauses:
    "Gastroesophageal reflux disease (GERD or chronic heartburn) is the most common cause of chest pain. Heart issue or not, you should get medical attention to get a diagnosis and the treatment you need.",
  recommendedTreatment:
    "Chest pain treatment depends on the cause of the pain. If a heart attack is causing your chest pain, you’ll get emergency treatment as soon as you seek help. This can include medication and a procedure or surgery to restore blood flow to your heart.",
};

export const mealReport = {
  calories: 250,
  deltaLabel: "+ 14% ↑ *",
  segments: [
    { pct: 40, label: "Carbohydrate", color: "#2563EB" },
    { pct: 23, label: "fat & oil", color: "#F59E0B" },
    { pct: 20, label: "Vegetable", color: "#16A34A" },
    { pct: 47, label: "Red meat", color: "#E02D2D" },
  ],
  detailRows: [
    { id: "nutrition", label: "Nutrition value", emoji: "🥗" },
    { id: "ingredient", label: "Active Ingridient", emoji: "🥑" },
    { id: "health", label: "Health factors", emoji: "🩺" },
    { id: "warning", label: "Not suitable for!", emoji: "⚠️" },
  ],
};

/* ------------------------------------------------------------------ *
 * Activity feed
 * A chronological record of what the user has done across the app:
 * bookings, AUX sessions, uploaded records and plan changes.
 * ------------------------------------------------------------------ */

export type ActivityType =
  | "appointment"
  | "transport"
  | "diagnosis"
  | "meal"
  | "record"
  | "plan";

export type ActivityStatus = "Completed" | "Booked" | "Cancelled" | "Pending";

export interface ActivityItem {
  id: string;
  type: ActivityType;
  title: string;
  subtitle: string;
  /** Grouping label for the timeline section. */
  day: string;
  time: string;
  status?: ActivityStatus;
  /** Id passed to the screen this row opens, where one is needed. */
  targetId?: string;
}

export const activityFilters: { id: ActivityType | "all"; label: string }[] = [
  { id: "all", label: "All" },
  { id: "appointment", label: "Appointments" },
  { id: "transport", label: "Transport" },
  { id: "diagnosis", label: "Diagnosis" },
  { id: "meal", label: "Meal Analysis" },
  { id: "record", label: "Records" },
];

export const activities: ActivityItem[] = [
  {
    id: "ac1",
    type: "diagnosis",
    title: "Chest pain assessment",
    subtitle: "AUX diagnosis · 3 symptoms reviewed",
    day: "Today",
    time: "09:24 AM",
    status: "Completed",
  },
  {
    id: "ac2",
    type: "meal",
    title: "Meal analysis",
    subtitle: "250 estimated calories · 40% carbohydrate",
    day: "Today",
    time: "08:10 AM",
    status: "Completed",
  },
  {
    id: "ac3",
    type: "appointment",
    title: "Burjeel International Hospital",
    subtitle: "Surgery · Abu-dhabi, UAE",
    day: "Yesterday",
    time: "04:10 PM",
    status: "Booked",
    targetId: "burjeel",
  },
  {
    id: "ac4",
    type: "transport",
    title: "Uber at YYC International Airport",
    subtitle: "YYC → AUH · Bombardier Global Express",
    day: "Yesterday",
    time: "01:35 PM",
    status: "Booked",
    targetId: "uber-yyc",
  },
  {
    id: "ac5",
    type: "record",
    title: "Medical records uploaded",
    subtitle: "2 files · clifford-hospital-medical-record",
    day: "Yesterday",
    time: "11:02 AM",
    status: "Completed",
  },
  {
    id: "ac6",
    type: "appointment",
    title: "New York-Presbyterian Hospital",
    subtitle: "Check-up · Neurology",
    day: "Earlier this week",
    time: "04:56 PM",
    status: "Completed",
    targetId: "ny-presbyterian",
  },
  {
    id: "ac7",
    type: "plan",
    title: "MedPilot Basic",
    subtitle: "Current plan · upgrade for unlimited analysis",
    day: "Earlier this week",
    time: "02:18 PM",
    status: "Pending",
  },
  {
    id: "ac8",
    type: "appointment",
    title: "King Salman Heart Center",
    subtitle: "Check-up · Jedah, Kingdom of Saudi Arabia",
    day: "Earlier this week",
    time: "01:56 PM",
    status: "Cancelled",
    targetId: "king-salman",
  },
  {
    id: "ac9",
    type: "transport",
    title: "Pacific Western EMS",
    subtitle: "Air ambulance quote requested",
    day: "Earlier this week",
    time: "10:41 AM",
    status: "Completed",
    targetId: "pacific-western",
  },
];
