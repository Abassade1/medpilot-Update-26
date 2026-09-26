/** Response shapes returned by the MedPilot API (mirrors backend serializers). */

export interface SetupStatus { passwordSet: boolean; historyComplete: boolean; emailVerified: boolean }
export interface TokenPairDto { accessToken: string; refreshToken: string; expiresIn: number }

export interface AuthResponse {
  user: { id: string; email: string; emailVerified: boolean };
  profile: { firstName: string; lastName: string; fullName: string };
  tokens: TokenPairDto;
  setup: SetupStatus;
}

export interface MeResponse {
  id: string;
  email: string;
  emailVerified: boolean;
  plan: "basic" | "pro";
  profile?: {
    firstName: string; lastName: string; fullName: string;
    phone: string; dateOfBirth: string;
    gender: string | null; maritalStatus: string | null;
    locationLabel: string | null; avatarAsset: string;
  };
}

export interface HospitalCard {
  id: string; slug: string; name: string; specialty: string;
  country: string; specialistCount: number; logoAsset: string | null; rating: number | null;
  accredited: boolean;
}
/** A specialist listed inside a hospital. Not bookable on their own, so they carry no rating. */
export interface HospitalSpecialistDto {
  id: string; name: string; cardName: string; role: string;
  photoAsset: string | null; available: boolean;
}
export interface SpecialistDetail extends HospitalSpecialistDto {
  certified: boolean; specialization: string | null; experience: string | null;
  operationCountry: string | null; operationCountryNote: string | null;
  languages: string | null; expertise: string[];
}
export interface HospitalDetail extends HospitalCard {
  about: string; careSystem: string; openHours: string; openHoursNote: string | null;
  helipadCode: string | null; bookable: boolean;
  latitude: number | null; longitude: number | null;
  specialists: HospitalSpecialistDto[];
}

export interface PackageCard {
  id: string; slug: string; title: string; priceLabel: string;
  location: string; rating: number | null; description: string;
  heroAsset: string | null; packageInclude: string[]; hospital: HospitalCard;
}
export interface PackageDetail extends PackageCard {
  hospital: HospitalDetail & HospitalCard;
  transportProvider: ProviderDetail | null;
  costSummary: {
    treatmentLabel: string; transportationLabel: string;
    accommodation: string; feeding: string; totalLabel: string;
  };
}

export interface ProviderCardDto {
  id: string; name: string; category: "jet" | "ambulance" | "boat";
  location: string; rating: number | null; verified: boolean;
  priceFromLabel: string | null; description: string; routes: string; tags: string;
  heroAsset: string | null; logoAsset: string | null;
}
export interface AircraftDto {
  id: string; name: string; capacity: string; capacityNote: string | null;
  medicalCrew: string | null; medicalCrewNote: string | null; paramedic: string | null;
  maxAltitude: string | null; maxAltitudeFt: string | null; priceLabel: string | null;
  heroAsset: string | null; facilities: { label: string; imageAsset: string | null }[];
}
export interface ProviderDetail extends ProviderCardDto { aircraft: AircraftDto[] }

export interface PetClinicDto {
  id: string; name: string; category: "vet" | "pedicure" | "sitters";
  location: string; rating: number | null; verified: boolean; priceFromLabel: string | null;
  description: string; openTo: string; logoEmoji: string | null; heroAsset: string | null;
}
export interface ServiceDto {
  id: string; code: string; title: string; description: string;
  color: string; imageAsset: string | null;
}
export interface HomeResponse {
  heroSlides: { id: string; title: string; subtitle: string; priceLabel: string | null; packageId: string | null; imageAsset: string | null }[];
  services: ServiceDto[];
  packages: PackageCard[];
  independentSpecialists: { id: string; title: string; count: string; imageAsset: string | null }[];
  hospitals: HospitalCard[];
}

export interface ReferenceData {
  appointmentTypes: { code: string; label: string }[];
  transportPurposes: { id: string; code: string; label: string }[];
  specialNeeds: { id: string; code: string; label: string }[];
  triageSymptoms: { id: string; code: string; label: string; emoji: string | null }[];
  triageConditions: { id: string; code: string; label: string; emoji: string | null }[];
  conditions: { id: string; code: string; label: string }[];
  relationships: string[];
}

export interface ConditionDto { id: string; code: string; label: string }
export interface EmergencyContactDto {
  id: string; firstName: string; lastName: string; phone: string; relationship: string;
}
export interface MedicalRecordDto {
  id: string; displayName: string; kind: "pdf" | "doc" | "image";
  source: string; status: "uploading" | "ready" | "failed";
  sizeBytes: number; downloadUrl: string | null; createdAt: string;
}

export type AppointmentStatus = "pending" | "confirmed" | "cancelled" | "completed";
export interface AppointmentDto {
  id: string; reference: string; status: AppointmentStatus;
  appointmentType: string; appointmentTypeLabel: string;
  requestedDate: string; requestedTime: string | null; scheduledAt: string | null;
  hospital: { id: string; name: string; logoAsset: string | null; location: string };
  contactPerson: { name: string; role: string; photoAsset: string } | null;
  underTreatment: boolean; conditionNote: string | null;
  emergencyContact: { name: string; phone: string; relationship: string; accompanies: boolean } | null;
  cancelledReason: string | null;
  /** The server decides what is allowed; the app only reflects it. */
  canReschedule: boolean; canCancel: boolean;
  canReview: boolean; reviewed: boolean;
  createdAt: string; updatedAt: string;
}
export interface TransportDto {
  id: string; reference: string; status: string;
  pickup: { country: string; region: string | null; city?: string | null; address?: string | null; date: string; time: string | null; siteType: string; siteCode: string | null };
  dropoff: { country: string; region: string | null; city?: string | null; siteType: string; siteCode: string | null };
  returnTrip: boolean; flightNumber: string | null;
  departAt: string | null; arriveAt: string | null;
  provider: { id: string; name: string; logoAsset: string | null; tags: string };
  canReview: boolean; reviewed: boolean;
  createdAt: string;
  canCancel?: boolean;
}
/** The full record behind a transport booking's own screen. */
export interface TransportDetailDto extends TransportDto {
  purposes: string[]; needs: string[]; aircraft: string | null;
  emergencyContact: { name: string; phone: string; relationship: string; accompanies: boolean } | null;
  canCancel: boolean; cancelledReason: string | null;
}

export type ReviewTargetType = "hospital" | "transport_provider" | "pet_clinic" | "independent_specialist";
export interface ReviewDto { id: string; rating: number; comment: string | null; reviewer: string; createdAt: string }
export interface ReviewsPage { total: number; average: number | null; items: ReviewDto[] }

export type ActivityTypeDto = "appointment" | "transport" | "diagnosis" | "meal" | "record" | "plan" | "service";
export interface ActivityDto {
  id: string; type: ActivityTypeDto; title: string; subtitle: string | null;
  status: "completed" | "booked" | "cancelled" | "pending" | null;
  targetType: string | null; targetId: string | null;
  occurredAt: string; day: string; time: string;
}
export interface ActivityPage { items: ActivityDto[]; nextCursor: string | null }

export interface TriageStart {
  sessionId: string; step: "conditions";
  prompt: { title: string; subtitle: string };
  conditions: { code: string; label: string; emoji: string | null }[];
}
export interface TriageResultDto {
  sessionId: string; title: string; summary: string;
  possibleCauses: string; recommendedTreatment: string;
  severity: "routine" | "urgent" | "emergency"; disclaimer: string; createdAt: string;
}
export type TriageStep = TriageStart | { sessionId: string; step: "result"; result: TriageResultDto };

export interface MealAnalysisDto {
  id: string; status: "queued" | "processing" | "complete" | "failed";
  caloriesEstimate?: number | null; baselineDeltaPct?: number | null;
  segments?: { label: string; percentage: number; colorHex: string }[];
  details?: { code: string; label: string; body: string | null }[];
  disclaimer?: string; failureReason?: string | null; pollAfterMs?: number;
}

export interface PlanDto { id: string; code: "basic" | "pro"; name: string; priceLabel: string; features: string[] }
export interface SubscriptionDto {
  planCode: "basic" | "pro"; status: string; currentPeriodEnd: string | null;
  cancelAtPeriodEnd?: boolean;
  usage: {
    mealAnalysis: { used: number; limit: number | null };
    clinicAccess: { used: number; limit: number | null };
    evacuation: { used: number; limit: number | null };
  };
}

export interface NotificationsDto {
  unreadCount: number;
  items: { id: string; type: string; title: string; body: string; data: { url?: string } | null; read: boolean; createdAt: string }[];
}

export interface UploadTicket {
  fileId: string; uploadUrl: string; method: "PUT"; headers: Record<string, string>;
}


// ---- locations & transport availability -------------------------------------
export type LocationLevel = "country" | "region" | "city";
export interface LocationDto {
  id: string; parentId: string | null; level: LocationLevel; name: string; code: string | null;
  hasAirport: boolean; hasHelipad: boolean; latitude: number | null; longitude: number | null;
  /** Present when the list was restricted to a provider. */
  coverage?: "full" | "partial";
}
export interface ResolveDto {
  matched: boolean; matchedLevel: LocationLevel | null;
  country: LocationDto | null; region: LocationDto | null; city: LocationDto | null;
}
export interface AvailableProviderDto {
  id: string; name: string; rating: number | null; verified: boolean; priceFromLabel: string | null;
  logoAsset: string | null; heroAsset: string | null; tags: string;
  coverage: "full" | "partial"; servedVia: string;
}
export interface AvailabilityService {
  category: "jet" | "ambulance" | "boat"; label: string; available: boolean;
  coverage: "none" | "full" | "partial"; providers: AvailableProviderDto[];
}
export interface AvailabilityDto {
  location: LocationDto; path: string[]; services: AvailabilityService[]; anyAvailable: boolean;
}

// ---- pet clinics & independent specialists ----------------------------------
export interface ServiceOfferDto {
  id: string; name: string; description: string; priceLabel: string | null; durationLabel: string;
  kind?: "appointment" | "sitting";
}
export interface PetClinicDetail extends PetClinicDto {
  services: ServiceOfferDto[]; canBookAppointment: boolean; canRequestSitting: boolean;
}
export type PetType = "dog" | "cat" | "horse" | "bird" | "small_animal" | "other";
export interface SpecialistCategoryDto { id: string; title: string; countLabel: string; imageAsset: string | null }
export interface SpecialistCardDto {
  id: string; name: string; role: string; rating: number | null; verified: boolean;
  locationLabel: string; photoAsset: string | null; availabilityLabel: string;
  acceptingRequests: boolean; categoryId: string; categoryTitle?: string;
}
export interface SpecialistProfileDto extends SpecialistCardDto {
  bio: string; languages: string; yearsExperience: number | null; services: ServiceOfferDto[];
}
export type RequestKind = "pet_appointment" | "pet_sitting" | "specialist_booking" | "specialist_connect" | "listing_booking";
export interface ServiceRequestDto {
  id: string; reference: string; kind: RequestKind; kindLabel: string; status: AppointmentStatus;
  target: {
    type: "pet_clinic" | "independent_specialist" | "listing"; id: string; name: string; subtitle: string;
    photoAsset: string | null; emoji: string | null;
  };
  service: { id: string; name: string; priceLabel: string | null } | null;
  preferredDate: string | null; endDate: string | null; preferredTime: string | null;
  message: string | null; details: { petName?: string; petType?: string } | null;
  canCancel: boolean; canReview: boolean; reviewed: boolean; cancelledReason: string | null; createdAt: string;
}

// ---- preferences & chat -----------------------------------------------------
export interface PreferencesDto {
  pushEnabled: boolean; emailUpdates: boolean; appointmentReminders: boolean; language: "en" | "fr";
}
export type ChatAction =
  | "triage" | "meal" | "hospitals" | "appointments" | "transport"
  | "pet" | "specialists" | "upgrade" | "packages" | "profile";
export interface ChatSuggestion { label: string; action: ChatAction }
export interface ChatMessageDto {
  id: string; role: "user" | "assistant"; text: string;
  suggestions: ChatSuggestion[]; urgent: boolean; createdAt: string;
}
export interface ChatHistoryDto { sessionId: string | null; messages: ChatMessageDto[] }
export interface ChatReplyDto {
  sessionId: string; mode: "rule_based"; disclaimer: string;
  reply: { id: string; text: string; suggestions: ChatSuggestion[]; urgent: boolean; intent: string };
}

// ---- vendor / provider portal -----------------------------------------------
export type FieldInput = "text" | "textarea" | "number" | "select" | "multiselect" | "toggle";
export interface FieldDef {
  key: string; label: string; input: FieldInput; required?: boolean; help?: string;
  options?: { value: string; label: string }[];
}
export interface TaxonomyCategory { code: string; label: string; subcategories: { code: string; label: string }[] }
export interface ProviderTypeDef {
  code: string; label: string; family: string; categories: TaxonomyCategory[];
  serviceFields: FieldDef[]; packageFields: FieldDef[];
}
export interface Taxonomy {
  providerTypes: ProviderTypeDef[]; commonFields: FieldDef[];
  locationModes: { value: string; label: string }[]; priceTypes: { value: string; label: string }[];
}
export type VerificationStatus = "unverified" | "pending" | "verified" | "rejected";
export interface ProviderProfileDto {
  id: string; type: string; typeLabel: string; name: string; description: string;
  phone: string | null; email: string | null; website: string | null; address: string | null;
  country: string | null; region: string | null; city: string | null;
  serviceAreas: string; operatingHours: string; languages: string; certifications: string;
  logoUrl: string | null; coverUrl: string | null;
  verificationStatus: VerificationStatus; verificationInfo: string | null; verificationNote: string | null;
  profileComplete: boolean; profileGaps: Record<string, string>;
}
export type ListingStatus = "draft" | "review" | "published" | "unpublished" | "archived";
export interface ListingDto {
  id: string; kind: "service" | "package"; category: string; subcategory: string;
  name: string; description: string;
  priceAmount: number | null; priceCurrency: string; priceType: string; priceLabel: string;
  durationMinutes: number | null; capacity: number; locationModes: string[];
  country: string | null; region: string | null; city: string | null; serviceRadiusKm: number | null;
  requirements: string; preparation: string; cancellationPolicy: string; terms: string;
  attributes: Record<string, unknown>; includes: { label: string; listingId?: string }[]; images: string[];
  status: ListingStatus; rejectionNote: string | null; viewCount: number; bookable: boolean; bookingCount: number;
  categoryLabel: string; subcategoryLabel: string; updatedAt: string;
}
export interface ProviderDashboardDto {
  provider: ProviderProfileDto;
  services: { published: number; draft: number; total: number };
  packages: { published: number; draft: number; total: number };
  bookings: { pending: number; confirmed: number; upcoming: number; completed: number; cancelled: number };
  completedValueLabel: string | null; completedValueNote: string;
  topListings: { id: string; name: string; kind: string; views: number; bookings: number }[];
  unreadNotifications: number;
}
export interface ProviderAvailabilityDto {
  windows: { weekday: number; start: string; end: string }[]; blackouts: string[];
}
export interface ProviderBookingDto {
  id: string; reference: string; status: "pending" | "confirmed" | "completed" | "cancelled";
  date: string | null; time: string | null; notes: string | null;
  listing: { id: string; name: string; kind: string } | null; priceLabel: string | null;
  customer: { name: string; phone: string | null };
  cancelledReason: string | null; createdAt: string;
  canConfirm: boolean; canDecline: boolean; canComplete: boolean; canCancel: boolean;
}
export interface ListingCardDto {
  id: string; kind: "service" | "package"; name: string; category: string; categoryLabel: string; subcategoryLabel: string;
  priceLabel: string; priceAmount: number | null; priceType: string; durationMinutes: number | null;
  locationModes: string[]; country: string | null; region: string | null; city: string | null; image: string | null; bookable: boolean;
  provider: { id: string; name: string; type: string; typeLabel: string; verified: boolean; logoUrl: string | null; city: string | null; country: string | null };
}
export interface ListingDetailFull extends Omit<ListingCardDto, "category"> {
  status: string; description: string; capacity: number;
  category: { code: string; label: string }; subcategory: { code: string; label: string };
  locationLabels: string[]; serviceRadiusKm: number | null;
  requirements: string; preparation: string; cancellationPolicy: string; terms: string;
  details: { label: string; value: string }[];
  includes: { label: string; listingId?: string }[]; images: string[];
  availability: { weekday: number; start: string; end: string }[]; priceTypeLabel: string;
  providerProfile: {
    id: string; name: string; typeLabel: string; verified: boolean; description: string; city: string | null; region: string | null; country: string | null;
    languages: string[]; operatingHours: string; phone: string | null; email: string | null; website: string | null;
    logoUrl: string | null; coverUrl: string | null; certifications: string; address: string | null; serviceAreas: string;
  };
  isOwner: boolean; preview: boolean;
}
export interface SlotsDto { date: string; slots: { time: string; remaining: number }[]; reason: string | null }
export interface ListingFacets {
  types: { code: string; label: string; count: number }[];
  categories: { type: string; code: string; label: string; count: number }[];
}
