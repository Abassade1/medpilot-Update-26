import { api } from "./client";
import type {
  ActivityPage, AircraftDto, AppointmentDto, AuthResponse, ConditionDto,
  EmergencyContactDto, HomeResponse, HospitalCard, HospitalDetail, MeResponse,
  MealAnalysisDto, MedicalRecordDto, NotificationsDto, PackageCard, PackageDetail,
  PetClinicDto, PlanDto, ProviderCardDto, ProviderDetail, ReferenceData,
  ServiceDto, SetupStatus, SpecialistDetail, SubscriptionDto, TokenPairDto,
  TransportDto, TriageResultDto, TriageStep, UploadTicket,
  AvailabilityDto, ChatHistoryDto, ChatReplyDto, LocationDto, PetClinicDetail, PreferencesDto,
  ResolveDto, ServiceRequestDto, SpecialistCardDto, SpecialistCategoryDto, SpecialistProfileDto,
} from "./types";

/** Every server call in one place; screens never build URLs themselves. */
export const endpoints = {
  auth: {
    register: (body: {
      email: string; password?: string; firstName: string; lastName: string;
      phone: string; dateOfBirth: string; gender?: string; maritalStatus?: string;
    }) => api.post<AuthResponse>("/v1/auth/register", body, { anonymous: true }),

    login: (email: string, password: string) =>
      api.post<AuthResponse>("/v1/auth/login", { email, password }, { anonymous: true }),

    checkEmail: (email: string) =>
      api.post<{ available: boolean }>("/v1/auth/check-email", { email }, { anonymous: true }),

    logout: (refreshToken: string) => api.post<void>("/v1/auth/logout", { refreshToken }),
    logoutAll: () => api.post<void>("/v1/auth/logout-all"),

    forgotPassword: (email: string) =>
      api.post<{ message: string }>("/v1/auth/password/forgot", { email }, { anonymous: true }),
    resetPassword: (token: string, password: string) =>
      api.post<void>("/v1/auth/password/reset", { token, password }, { anonymous: true }),

    resendVerification: () => api.post<{ message: string }>("/v1/auth/verification/resend"),
    confirmVerification: (token: string) =>
      api.post<void>("/v1/auth/verification/confirm", { token }, { anonymous: true }),
    verificationStatus: () => api.get<{ emailVerified: boolean }>("/v1/auth/verification-status"),
  },

  me: {
    get: () => api.get<MeResponse>("/v1/me"),
    setupStatus: () => api.get<SetupStatus>("/v1/me/setup-status"),
    patchProfile: (body: Record<string, unknown>) => api.patch<MeResponse>("/v1/me/profile", body),
    preferences: () => api.get<PreferencesDto>("/v1/me/preferences"),
    patchPreferences: (body: Partial<PreferencesDto>) => api.patch<PreferencesDto>("/v1/me/preferences", body),
    setPassword: (password: string, currentPassword?: string) =>
      api.post<{ tokens: TokenPairDto }>("/v1/me/password", { password, currentPassword }),
    deleteAccount: () => api.delete<{ message: string }>("/v1/me"),

    conditions: () => api.get<ConditionDto[]>("/v1/me/conditions"),
    putConditions: (conditionIds: string[]) => api.put<ConditionDto[]>("/v1/me/conditions", { conditionIds }),

    emergencyContact: () => api.get<{ contact: EmergencyContactDto | null }>("/v1/me/emergency-contact"),
    putEmergencyContact: (body: {
      firstName: string; lastName: string; phone: string; relationship: string;
    }) => api.put<{ contact: EmergencyContactDto }>("/v1/me/emergency-contact", body),

    records: () => api.get<MedicalRecordDto[]>("/v1/me/records"),
    recordUploadUrl: (body: { fileName: string; mimeType: string; sizeBytes: number; source?: string }) =>
      api.post<UploadTicket>("/v1/me/records/upload-url", body),
    createRecord: (body: { fileId: string; displayName: string; source?: string }) =>
      api.post<MedicalRecordDto>("/v1/me/records", body),
    deleteRecord: (id: string) => api.delete<void>(`/v1/me/records/${id}`),

    registerDevice: (body: { platform: "ios" | "android"; installId: string; pushToken?: string | null }) =>
      api.post<{ id: string }>("/v1/me/devices", body),
    setBiometric: (body: { installId: string; enabled: boolean; publicKey?: string | null }) =>
      api.post<{ enabled: boolean }>("/v1/me/devices/biometric", body),
  },

  catalog: {
    home: () => api.get<HomeResponse>("/v1/home"),
    hospitals: (q?: string) =>
      api.get<HospitalCard[]>(`/v1/hospitals${q ? `?q=${encodeURIComponent(q)}` : ""}`),
    hospital: (id: string) => api.get<HospitalDetail>(`/v1/hospitals/${id}`),
    specialist: (id: string) => api.get<SpecialistDetail>(`/v1/specialists/${id}`),
    packages: (q?: string) =>
      api.get<PackageCard[]>(`/v1/packages${q ? `?q=${encodeURIComponent(q)}` : ""}`),
    package: (id: string) => api.get<PackageDetail>(`/v1/packages/${id}`),
    providers: (category?: string) =>
      api.get<ProviderCardDto[]>(`/v1/transport-providers${category ? `?category=${category}` : ""}`),
    provider: (id: string) => api.get<ProviderDetail>(`/v1/transport-providers/${id}`),
    aircraft: (id: string) => api.get<AircraftDto>(`/v1/aircraft/${id}`),
    petClinics: (category?: string) =>
      api.get<PetClinicDto[]>(`/v1/pet-clinics${category ? `?category=${category}` : ""}`),
    petClinic: (id: string) => api.get<PetClinicDetail>(`/v1/pet-clinics/${id}`),
    specialistCategories: () => api.get<SpecialistCategoryDto[]>("/v1/independent-specialist-categories"),
    specialists: (params?: { categoryId?: string; q?: string }) => {
      const q = new URLSearchParams();
      if (params?.categoryId) q.set("categoryId", params.categoryId);
      if (params?.q) q.set("q", params.q);
      const qs = q.toString();
      return api.get<SpecialistCardDto[]>(`/v1/independent-specialists${qs ? `?${qs}` : ""}`);
    },
    specialistProfile: (id: string) => api.get<SpecialistProfileDto>(`/v1/independent-specialists/${id}`),
    locations: (params?: { parentId?: string; coveredBy?: string }) => {
      const q = new URLSearchParams();
      if (params?.parentId) q.set("parentId", params.parentId);
      if (params?.coveredBy) q.set("coveredBy", params.coveredBy);
      const qs = q.toString();
      return api.get<LocationDto[]>(`/v1/locations${qs ? `?${qs}` : ""}`);
    },
    resolveLocation: (p: { country?: string; region?: string; city?: string }) => {
      const q = new URLSearchParams();
      for (const [k, v] of Object.entries(p)) if (v) q.set(k, v);
      return api.get<ResolveDto>(`/v1/locations/resolve?${q.toString()}`);
    },
    availability: (locationId: string) => api.get<AvailabilityDto>(`/v1/transport/availability?locationId=${locationId}`),
    services: () => api.get<ServiceDto[]>("/v1/services"),
    reference: () => api.get<ReferenceData>("/v1/reference"),
  },

  bookings: {
    createAppointment: (body: Record<string, unknown>, idempotencyKey: string) =>
      api.post<AppointmentDto>("/v1/appointments", body, { idempotencyKey }),
    appointments: () => api.get<AppointmentDto[]>("/v1/appointments"),
    appointment: (id: string) => api.get<AppointmentDto>(`/v1/appointments/${id}`),
    cancelAppointment: (id: string) => api.post<AppointmentDto>(`/v1/appointments/${id}/cancel`),
    rescheduleAppointment: (id: string, body: { requestedDate?: string; requestedTime?: string | null; appointmentType?: string }) =>
      api.patch<AppointmentDto>(`/v1/appointments/${id}`, body),

    requestPet: (clinicId: string, body: Record<string, unknown>, idempotencyKey: string) =>
      api.post<ServiceRequestDto>(`/v1/pet-clinics/${clinicId}/requests`, body, { idempotencyKey }),
    requestSpecialist: (specialistId: string, body: Record<string, unknown>, idempotencyKey: string) =>
      api.post<ServiceRequestDto>(`/v1/independent-specialists/${specialistId}/requests`, body, { idempotencyKey }),
    serviceRequests: () => api.get<ServiceRequestDto[]>("/v1/service-requests"),
    serviceRequest: (id: string) => api.get<ServiceRequestDto>(`/v1/service-requests/${id}`),
    cancelServiceRequest: (id: string) => api.post<ServiceRequestDto>(`/v1/service-requests/${id}/cancel`),

    createTransport: (body: Record<string, unknown>, idempotencyKey: string) =>
      api.post<TransportDto>("/v1/transport-bookings", body, { idempotencyKey }),
    transport: () => api.get<TransportDto[]>("/v1/transport-bookings"),

    activities: (params?: { type?: string; cursor?: string; limit?: number }) => {
      const q = new URLSearchParams();
      if (params?.type) q.set("type", params.type);
      if (params?.cursor) q.set("cursor", params.cursor);
      if (params?.limit) q.set("limit", String(params.limit));
      const qs = q.toString();
      return api.get<ActivityPage>(`/v1/activities${qs ? `?${qs}` : ""}`);
    },
  },

  aux: {
    chat: (message: string, sessionId?: string) =>
      api.post<ChatReplyDto>("/v1/aux/chat", { message, ...(sessionId ? { sessionId } : {}) }),
    latestChat: () => api.get<ChatHistoryDto>("/v1/aux/chat"),
    startTriage: (symptomCode: string) => api.post<TriageStep>("/v1/aux/triage", { symptomCode }),
    continueTriage: (sessionId: string, conditionCode: string) =>
      api.post<TriageStep>("/v1/aux/triage", { sessionId, conditionCode }),
    session: (id: string) => api.get<TriageResultDto>(`/v1/aux/sessions/${id}`),
    translate: (id: string, locale: string) =>
      api.post<Record<string, string>>(`/v1/aux/sessions/${id}/translate`, { locale }),
    escalate: (id: string, kind: "doctor" | "hospital" | "evacuation") =>
      api.post<{ status: string; kind: string }>(`/v1/aux/sessions/${id}/escalate`, { kind }),

    mealUploadUrl: (body: { mimeType: string; sizeBytes: number }) =>
      api.post<UploadTicket>("/v1/aux/meals/upload-url", body),
    createMeal: (fileId: string) => api.post<MealAnalysisDto>("/v1/aux/meals", { fileId }),
    meal: (id: string) => api.get<MealAnalysisDto>(`/v1/aux/meals/${id}`),
  },

  billing: {
    plans: () => api.get<PlanDto[]>("/v1/plans", { anonymous: true }),
    subscription: () => api.get<SubscriptionDto>("/v1/me/subscription"),
    verifyReceipt: (body: { platform: "apple" | "google"; receipt: string; productId: string }) =>
      api.post<SubscriptionDto>("/v1/me/subscription/verify", body),
  },

  notifications: {
    list: () => api.get<NotificationsDto>("/v1/notifications"),
    markRead: (ids: string[] | "all") => api.post<NotificationsDto>("/v1/notifications/read", { ids }),
  },
};
