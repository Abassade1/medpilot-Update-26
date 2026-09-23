// Mirrors the shapes the mobile app already consumes from the same API — see src/api/types.ts.
// Kept as a separate copy on purpose: the web portal is a distinct frontend, and duplicating a
// few interfaces here is cheaper and safer than sharing a package across React Native and Vite.

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

export interface ListingDetailFull {
  id: string; kind: "service" | "package"; name: string; status: string; description: string; capacity: number;
  priceLabel: string; priceAmount: number | null; priceType: string; priceTypeLabel: string; durationMinutes: number | null;
  category: { code: string; label: string }; subcategory: { code: string; label: string };
  locationModes: string[]; locationLabels: string[]; country: string | null; region: string | null; city: string | null; serviceRadiusKm: number | null;
  requirements: string; preparation: string; cancellationPolicy: string; terms: string;
  details: { label: string; value: string }[];
  includes: { label: string; listingId?: string }[]; images: string[];
  availability: { weekday: number; start: string; end: string }[];
  providerProfile: {
    id: string; name: string; typeLabel: string; verified: boolean; description: string; city: string | null; region: string | null; country: string | null;
    languages: string[]; operatingHours: string; phone: string | null; email: string | null; website: string | null;
    logoUrl: string | null; coverUrl: string | null; certifications: string; address: string | null; serviceAreas: string;
  };
  isOwner: boolean; preview: boolean; bookable: boolean;
}

export interface NotificationsDto {
  unreadCount: number;
  items: { id: string; type: string; title: string; body: string; data: { url?: string } | null; read: boolean; createdAt: string }[];
}

export interface AuthResponse {
  user: { id: string; email: string; emailVerified: boolean };
  profile: { firstName: string; lastName: string; fullName: string };
  tokens: { accessToken: string; refreshToken: string; expiresIn: number };
  setup: { passwordSet: boolean; historyComplete: boolean; emailVerified: boolean };
}
