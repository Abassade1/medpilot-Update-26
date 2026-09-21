import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { endpoints } from "./endpoints";
import type { ActivityTypeDto } from "./types";

/** Query keys in one place so invalidation stays consistent. */
export const qk = {
  home: ["home"] as const,
  hospitals: (q?: string) => ["hospitals", q ?? ""] as const,
  hospital: (id: string) => ["hospital", id] as const,
  specialist: (id: string) => ["specialist", id] as const,
  packages: (q?: string) => ["packages", q ?? ""] as const,
  package: (id: string) => ["package", id] as const,
  providers: (c?: string) => ["providers", c ?? ""] as const,
  provider: (id: string) => ["provider", id] as const,
  petClinics: (c?: string) => ["petClinics", c ?? ""] as const,
  services: ["services"] as const,
  reference: ["reference"] as const,
  me: ["me"] as const,
  conditions: ["conditions"] as const,
  records: ["records"] as const,
  contact: ["emergencyContact"] as const,
  appointments: ["appointments"] as const,
  transport: ["transportBookings"] as const,
  activities: (t?: string) => ["activities", t ?? "all"] as const,
  subscription: ["subscription"] as const,
  plans: ["plans"] as const,
  notifications: ["notifications"] as const,
  appointment: (id: string) => ["appointment", id] as const,
  transportBooking: (id: string) => ["transportBooking", id] as const,
  petClinic: (id: string) => ["petClinic", id] as const,
  specialists: (categoryId?: string, q?: string) => ["specialists", categoryId ?? "", q ?? ""] as const,
  specialistCategories: ["specialistCategories"] as const,
  indieSpecialist: (id: string) => ["indieSpecialist", id] as const,
  serviceRequests: ["serviceRequests"] as const,
  serviceRequest: (id: string) => ["serviceRequest", id] as const,
  locations: (parentId?: string, coveredBy?: string) => ["locations", parentId ?? "", coveredBy ?? ""] as const,
  availability: (locationId: string) => ["availability", locationId] as const,
  preferences: ["preferences"] as const,
  chat: ["chat"] as const,
};

// Catalog is stable; member data is not.
const CATALOG_STALE = 5 * 60_000;
const MEMBER_STALE = 30_000;

export const useHome = () => useQuery({ queryKey: qk.home, queryFn: endpoints.catalog.home, staleTime: CATALOG_STALE });
export const useHospitals = (q?: string) =>
  useQuery({ queryKey: qk.hospitals(q), queryFn: () => endpoints.catalog.hospitals(q), staleTime: CATALOG_STALE });
export const useHospital = (id: string) =>
  useQuery({ queryKey: qk.hospital(id), queryFn: () => endpoints.catalog.hospital(id), staleTime: CATALOG_STALE });
export const useSpecialist = (id: string | null) =>
  useQuery({ queryKey: qk.specialist(id ?? ""), queryFn: () => endpoints.catalog.specialist(id!), enabled: !!id, staleTime: CATALOG_STALE });
export const usePackages = (q?: string) =>
  useQuery({ queryKey: qk.packages(q), queryFn: () => endpoints.catalog.packages(q), staleTime: CATALOG_STALE });
export const usePackage = (id: string) =>
  useQuery({ queryKey: qk.package(id), queryFn: () => endpoints.catalog.package(id), staleTime: CATALOG_STALE });
export const useProviders = (category?: string) =>
  useQuery({ queryKey: qk.providers(category), queryFn: () => endpoints.catalog.providers(category), staleTime: CATALOG_STALE });
export const useProvider = (id: string) =>
  useQuery({ queryKey: qk.provider(id), queryFn: () => endpoints.catalog.provider(id), staleTime: CATALOG_STALE });
export const usePetClinics = (category?: string) =>
  useQuery({ queryKey: qk.petClinics(category), queryFn: () => endpoints.catalog.petClinics(category), staleTime: CATALOG_STALE });
export const useServices = () =>
  useQuery({ queryKey: qk.services, queryFn: endpoints.catalog.services, staleTime: CATALOG_STALE });
export const useReference = () =>
  useQuery({ queryKey: qk.reference, queryFn: endpoints.catalog.reference, staleTime: CATALOG_STALE });

export const useMe = () => useQuery({ queryKey: qk.me, queryFn: endpoints.me.get, staleTime: MEMBER_STALE });
export const useConditions = () => useQuery({ queryKey: qk.conditions, queryFn: endpoints.me.conditions, staleTime: MEMBER_STALE });
export const useRecords = () => useQuery({ queryKey: qk.records, queryFn: endpoints.me.records, staleTime: MEMBER_STALE });
export const useEmergencyContact = () =>
  useQuery({ queryKey: qk.contact, queryFn: endpoints.me.emergencyContact, staleTime: MEMBER_STALE });

export const useAppointments = () =>
  useQuery({ queryKey: qk.appointments, queryFn: endpoints.bookings.appointments, staleTime: MEMBER_STALE });
export const useTransportBookings = () =>
  useQuery({ queryKey: qk.transport, queryFn: endpoints.bookings.transport, staleTime: MEMBER_STALE });
export const useActivities = (type?: ActivityTypeDto | "all") =>
  useQuery({
    queryKey: qk.activities(type),
    queryFn: () => endpoints.bookings.activities(type && type !== "all" ? { type } : undefined),
    staleTime: MEMBER_STALE,
  });

export const useSubscription = () =>
  useQuery({ queryKey: qk.subscription, queryFn: endpoints.billing.subscription, staleTime: MEMBER_STALE });
export const usePlans = () => useQuery({ queryKey: qk.plans, queryFn: endpoints.billing.plans, staleTime: CATALOG_STALE });
export const useNotifications = () =>
  useQuery({ queryKey: qk.notifications, queryFn: endpoints.notifications.list, staleTime: MEMBER_STALE });

/** Booking mutations invalidate every list the new row appears in. */
export function useCreateAppointment() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ body, idempotencyKey }: { body: Record<string, unknown>; idempotencyKey: string }) =>
      endpoints.bookings.createAppointment(body, idempotencyKey),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: qk.appointments });
      void qc.invalidateQueries({ queryKey: ["activities"] });
      void qc.invalidateQueries({ queryKey: qk.subscription });
    },
  });
}

export function useCreateTransport() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ body, idempotencyKey }: { body: Record<string, unknown>; idempotencyKey: string }) =>
      endpoints.bookings.createTransport(body, idempotencyKey),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: qk.transport });
      void qc.invalidateQueries({ queryKey: ["activities"] });
      void qc.invalidateQueries({ queryKey: qk.subscription });
    },
  });
}

export function usePutConditions() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (ids: string[]) => endpoints.me.putConditions(ids),
    onSuccess: () => { void qc.invalidateQueries({ queryKey: qk.conditions }); },
  });
}

export function useDeleteRecord() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => endpoints.me.deleteRecord(id),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: qk.records });
      void qc.invalidateQueries({ queryKey: ["activities"] });
    },
  });
}


// ---- appointments: detail, reschedule, cancel ---------------------------------
export const useAppointment = (id: string) =>
  useQuery({ queryKey: qk.appointment(id), queryFn: () => endpoints.bookings.appointment(id), staleTime: MEMBER_STALE });

/** Every place an appointment shows up must refresh together, or one screen lies. */
function invalidateAppointmentViews(qc: ReturnType<typeof useQueryClient>, id?: string) {
  void qc.invalidateQueries({ queryKey: qk.appointments });
  void qc.invalidateQueries({ queryKey: ["activities"] });
  void qc.invalidateQueries({ queryKey: qk.notifications });
  void qc.invalidateQueries({ queryKey: qk.subscription });
  if (id) void qc.invalidateQueries({ queryKey: qk.appointment(id) });
}

export function useRescheduleAppointment(id: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: { requestedDate?: string; requestedTime?: string | null; appointmentType?: string }) =>
      endpoints.bookings.rescheduleAppointment(id, body),
    onSuccess: (updated) => {
      qc.setQueryData(qk.appointment(id), updated);
      invalidateAppointmentViews(qc, id);
    },
  });
}

export function useCancelAppointment(id: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => endpoints.bookings.cancelAppointment(id),
    onSuccess: (updated) => {
      qc.setQueryData(qk.appointment(id), updated);
      invalidateAppointmentViews(qc, id);
    },
  });
}

// ---- pet clinics, independent specialists, requests ---------------------------
export const usePetClinic = (id: string) =>
  useQuery({ queryKey: qk.petClinic(id), queryFn: () => endpoints.catalog.petClinic(id), staleTime: CATALOG_STALE });
export const useSpecialistCategories = () =>
  useQuery({ queryKey: qk.specialistCategories, queryFn: endpoints.catalog.specialistCategories, staleTime: CATALOG_STALE });
export const useSpecialists = (categoryId?: string, q?: string) =>
  useQuery({
    queryKey: qk.specialists(categoryId, q),
    queryFn: () => endpoints.catalog.specialists({ categoryId, q }),
    staleTime: CATALOG_STALE,
    placeholderData: (prev) => prev, // keep the list on screen while a search refetches
  });
export const useSpecialistProfile = (id: string) =>
  useQuery({ queryKey: qk.indieSpecialist(id), queryFn: () => endpoints.catalog.specialistProfile(id), staleTime: CATALOG_STALE });

export const useServiceRequests = () =>
  useQuery({ queryKey: qk.serviceRequests, queryFn: endpoints.bookings.serviceRequests, staleTime: MEMBER_STALE });
export const useServiceRequest = (id: string) =>
  useQuery({ queryKey: qk.serviceRequest(id), queryFn: () => endpoints.bookings.serviceRequest(id), staleTime: MEMBER_STALE });

function invalidateRequestViews(qc: ReturnType<typeof useQueryClient>, id?: string) {
  void qc.invalidateQueries({ queryKey: qk.serviceRequests });
  void qc.invalidateQueries({ queryKey: ["activities"] });
  void qc.invalidateQueries({ queryKey: qk.notifications });
  if (id) void qc.invalidateQueries({ queryKey: qk.serviceRequest(id) });
}

export function useRequestPet(clinicId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ body, idempotencyKey }: { body: Record<string, unknown>; idempotencyKey: string }) =>
      endpoints.bookings.requestPet(clinicId, body, idempotencyKey),
    onSuccess: (r) => invalidateRequestViews(qc, r.id),
  });
}
export function useRequestSpecialist(specialistId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ body, idempotencyKey }: { body: Record<string, unknown>; idempotencyKey: string }) =>
      endpoints.bookings.requestSpecialist(specialistId, body, idempotencyKey),
    onSuccess: (r) => invalidateRequestViews(qc, r.id),
  });
}
export function useCancelServiceRequest(id: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => endpoints.bookings.cancelServiceRequest(id),
    onSuccess: (updated) => {
      qc.setQueryData(qk.serviceRequest(id), updated);
      invalidateRequestViews(qc, id);
    },
  });
}

// ---- locations & availability ---------------------------------------------------
/** `enabled` lets a dependent dropdown wait until the field above it is chosen. */
export const useLocations = (parentId?: string, coveredBy?: string, enabled = true) =>
  useQuery({
    queryKey: qk.locations(parentId, coveredBy),
    queryFn: () => endpoints.catalog.locations({ parentId, coveredBy }),
    staleTime: CATALOG_STALE,
    enabled,
  });
export const useAvailability = (locationId: string | null) =>
  useQuery({
    queryKey: qk.availability(locationId ?? ""),
    queryFn: () => endpoints.catalog.availability(locationId!),
    enabled: !!locationId,
    staleTime: CATALOG_STALE,
  });

// ---- preferences & notifications -----------------------------------------------
export const usePreferences = () =>
  useQuery({ queryKey: qk.preferences, queryFn: endpoints.me.preferences, staleTime: MEMBER_STALE });

export function usePatchPreferences() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: Partial<import("./types").PreferencesDto>) => endpoints.me.patchPreferences(body),
    // Optimistic: a toggle should flip immediately, and snap back if the save fails.
    onMutate: async (body) => {
      await qc.cancelQueries({ queryKey: qk.preferences });
      const prev = qc.getQueryData<import("./types").PreferencesDto>(qk.preferences);
      if (prev) qc.setQueryData(qk.preferences, { ...prev, ...body });
      return { prev };
    },
    onError: (_e, _b, ctx) => { if (ctx?.prev) qc.setQueryData(qk.preferences, ctx.prev); },
    onSettled: () => { void qc.invalidateQueries({ queryKey: qk.preferences }); },
  });
}

export function useMarkNotificationsRead() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (ids: string[] | "all") => endpoints.notifications.markRead(ids),
    onSuccess: (data) => { qc.setQueryData(qk.notifications, data); },
  });
}

// ---- profile ---------------------------------------------------------------------
export function usePatchProfile() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: Record<string, unknown>) => endpoints.me.patchProfile(body),
    onSuccess: (me) => {
      qc.setQueryData(qk.me, me);
      void qc.invalidateQueries({ queryKey: qk.home });
    },
  });
}

export function usePutEmergencyContact() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: { firstName: string; lastName: string; phone: string; relationship: string }) =>
      endpoints.me.putEmergencyContact(body),
    onSuccess: () => { void qc.invalidateQueries({ queryKey: qk.contact }); },
  });
}

// ---- transport booking detail ------------------------------------------------------
export const useTransportBooking = (id: string) =>
  useQuery({ queryKey: qk.transportBooking(id), queryFn: () => endpoints.bookings.transportBooking(id), staleTime: MEMBER_STALE });

export function useCancelTransport(id: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => endpoints.bookings.cancelTransport(id),
    onSuccess: (updated) => {
      qc.setQueryData(qk.transportBooking(id), updated);
      void qc.invalidateQueries({ queryKey: qk.transport });
      void qc.invalidateQueries({ queryKey: ["activities"] });
      void qc.invalidateQueries({ queryKey: qk.notifications });
      void qc.invalidateQueries({ queryKey: qk.subscription });
    },
  });
}
