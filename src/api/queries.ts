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
