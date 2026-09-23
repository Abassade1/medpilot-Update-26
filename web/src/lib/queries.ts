import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "./api";
import type {
  ListingDetailFull, ListingDto, ProviderAvailabilityDto, ProviderBookingDto, ProviderDashboardDto, ProviderProfileDto, Taxonomy,
} from "./types";

const qk = {
  taxonomy: ["taxonomy"] as const,
  me: ["me"] as const,
  dashboard: ["dashboard"] as const,
  listings: (kind?: string, status?: string) => ["listings", kind ?? "", status ?? ""] as const,
  listing: (id: string) => ["listing", id] as const,
  availability: (id: string) => ["availability", id] as const,
  bookings: (status?: string) => ["bookings", status ?? ""] as const,
  booking: (id: string) => ["booking", id] as const,
};

export const useTaxonomy = () => useQuery({ queryKey: qk.taxonomy, queryFn: () => api.get<Taxonomy>("/v1/provider/taxonomy"), staleTime: 5 * 60_000 });
export const useMyProvider = () => useQuery({ queryKey: qk.me, queryFn: () => api.get<{ provider: ProviderProfileDto | null }>("/v1/provider/me") });
export const useDashboard = (enabled: boolean) => useQuery({ queryKey: qk.dashboard, queryFn: () => api.get<ProviderDashboardDto>("/v1/provider/dashboard"), enabled });

export const useListings = (kind?: string, status?: string) =>
  useQuery({
    queryKey: qk.listings(kind, status),
    queryFn: () => {
      const q = new URLSearchParams();
      if (kind) q.set("kind", kind);
      if (status) q.set("status", status);
      const qs = q.toString();
      return api.get<ListingDto[]>(`/v1/provider/listings${qs ? `?${qs}` : ""}`);
    },
  });
export const useListing = (id?: string) =>
  useQuery({ queryKey: qk.listing(id ?? ""), queryFn: () => api.get<ListingDto>(`/v1/provider/listings/${id}`), enabled: !!id });

export const useAvailability = (id: string) =>
  useQuery({ queryKey: qk.availability(id), queryFn: () => api.get<ProviderAvailabilityDto>(`/v1/provider/listings/${id}/availability`) });

export const useBookings = (status?: string) =>
  useQuery({ queryKey: qk.bookings(status), queryFn: () => api.get<ProviderBookingDto[]>(`/v1/provider/bookings${status ? `?status=${status}` : ""}`) });
export const useBooking = (id: string) =>
  useQuery({ queryKey: qk.booking(id), queryFn: () => api.get<ProviderBookingDto>(`/v1/provider/bookings/${id}`) });

// The same public detail endpoint the mobile Discover/detail screens use, with ?preview=true so an
// owner can see a draft's rendered page before publishing (server checks ownership for that flag).
export const useListingPreview = (id: string) =>
  useQuery({ queryKey: ["listing-preview", id], queryFn: () => api.get<ListingDetailFull>(`/v1/listings/${id}?preview=true`), enabled: !!id });

const refresh = (qc: ReturnType<typeof useQueryClient>) => {
  void qc.invalidateQueries({ queryKey: qk.me });
  void qc.invalidateQueries({ queryKey: qk.dashboard });
};

export function useSaveProvider() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ create, body }: { create: boolean; body: Record<string, unknown> }) =>
      create ? api.post<{ provider: ProviderProfileDto }>("/v1/provider", body) : api.patch<{ provider: ProviderProfileDto }>("/v1/provider", body),
    onSuccess: () => refresh(qc),
  });
}
export function useSubmitVerification() {
  const qc = useQueryClient();
  return useMutation({ mutationFn: (licenseInfo: string) => api.post<{ provider: ProviderProfileDto }>("/v1/provider/verification", { licenseInfo }), onSuccess: () => refresh(qc) });
}
export function useSaveListing(id?: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: Record<string, unknown>) => (id ? api.patch<ListingDto>(`/v1/provider/listings/${id}`, body) : api.post<ListingDto>("/v1/provider/listings", body)),
    onSuccess: (l) => { qc.setQueryData(qk.listing(l.id), l); void qc.invalidateQueries({ queryKey: ["listings"] }); refresh(qc); },
  });
}
export function useListingAction() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, action }: { id: string; action: "publish" | "unpublish" | "archive" | "duplicate" | "delete" }) =>
      action === "delete" ? api.delete<void>(`/v1/provider/listings/${id}`).then(() => null) : api.post<ListingDto>(`/v1/provider/listings/${id}/${action}`),
    onSuccess: () => { void qc.invalidateQueries({ queryKey: ["listings"] }); refresh(qc); },
  });
}
export function usePutAvailability(id: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: ProviderAvailabilityDto) => api.put<ProviderAvailabilityDto & { listingStatus: string }>(`/v1/provider/listings/${id}/availability`, body),
    onSuccess: () => { void qc.invalidateQueries({ queryKey: qk.availability(id) }); void qc.invalidateQueries({ queryKey: ["listings"] }); refresh(qc); },
  });
}
export function useBookingAction(id: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ action, reason }: { action: "confirm" | "decline" | "complete" | "cancel"; reason?: string }) =>
      api.post<ProviderBookingDto>(`/v1/provider/bookings/${id}/${action}`, reason ? { reason } : {}),
    onSuccess: (b) => { qc.setQueryData(qk.booking(id), b); void qc.invalidateQueries({ queryKey: ["bookings"] }); refresh(qc); },
  });
}
