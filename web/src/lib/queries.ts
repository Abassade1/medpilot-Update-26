import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "./api";
import type {
  InvitePreviewDto, ListingDetailFull, ListingDto, MyRole, NotificationsDto, ProviderAvailabilityDto, ProviderBookingDto,
  ProviderDashboardDto, ProviderProfileDto, StaffQueueDto, Taxonomy, TeamDto, TeamMemberRole,
} from "./types";

const qk = {
  taxonomy: ["taxonomy"] as const,
  me: ["me"] as const,
  dashboard: ["dashboard"] as const,
  notifications: ["notifications"] as const,
  listings: (kind?: string, status?: string) => ["listings", kind ?? "", status ?? ""] as const,
  listing: (id: string) => ["listing", id] as const,
  availability: (id: string) => ["availability", id] as const,
  bookings: (status?: string) => ["bookings", status ?? ""] as const,
  booking: (id: string) => ["booking", id] as const,
  team: ["team"] as const,
};

export const useTaxonomy = () => useQuery({ queryKey: qk.taxonomy, queryFn: () => api.get<Taxonomy>("/v1/provider/taxonomy"), staleTime: 5 * 60_000 });
export const useMyProvider = () =>
  useQuery({ queryKey: qk.me, queryFn: () => api.get<{ provider: ProviderProfileDto | null; myRole: MyRole | null }>("/v1/provider/me") });
export const useDashboard = (enabled: boolean) => useQuery({ queryKey: qk.dashboard, queryFn: () => api.get<ProviderDashboardDto>("/v1/provider/dashboard"), enabled });

export const useNotifications = () =>
  useQuery({ queryKey: qk.notifications, queryFn: () => api.get<NotificationsDto>("/v1/notifications"), refetchInterval: 30_000 });
export function useMarkNotificationsRead() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (ids: string[] | "all") => api.post<NotificationsDto>("/v1/notifications/read", { ids }),
    onSuccess: (d) => qc.setQueryData(qk.notifications, d),
  });
}

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

// ---- team roster ------------------------------------------------------------------------------------
export const useTeam = () => useQuery({ queryKey: qk.team, queryFn: () => api.get<TeamDto>("/v1/provider/team") });
export function useInviteMember() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: { email: string; role: TeamMemberRole }) => api.post<TeamDto>("/v1/provider/team/invite", body),
    onSuccess: (d) => qc.setQueryData(qk.team, d),
  });
}
export function useResendInvite() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.post<TeamDto>(`/v1/provider/team/${id}/resend`),
    onSuccess: (d) => qc.setQueryData(qk.team, d),
  });
}
export function useRemoveMember() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.delete<TeamDto>(`/v1/provider/team/${id}`),
    onSuccess: (d) => qc.setQueryData(qk.team, d),
  });
}
export const useInvitePreview = (token: string | null) =>
  useQuery({ queryKey: ["invite", token ?? ""], queryFn: () => api.get<InvitePreviewDto>(`/v1/provider/team/invite/${encodeURIComponent(token!)}`), enabled: !!token, retry: false });
export function useAcceptInvite() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (token: string) => api.post<{ provider: ProviderProfileDto | null; myRole: MyRole | null }>("/v1/provider/team/accept", { token }),
    onSuccess: () => { void qc.invalidateQueries({ queryKey: qk.me }); },
  });
}

// ---- staff review (verify providers, approve/reject listings) --------------------------------------
export const useStaffQueue = () => useQuery({ queryKey: ["staff", "queue"], queryFn: () => api.get<StaffQueueDto>("/v1/staff/vendor-queue"), staleTime: 10_000 });
export function useDecideProvider() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, decision, reason }: { id: string; decision: "verify" | "reject"; reason?: string }) =>
      api.post(`/v1/staff/providers/${id}/${decision}`, reason ? { reason } : {}),
    onSuccess: () => void qc.invalidateQueries({ queryKey: ["staff", "queue"] }),
  });
}
export function useDecideListing() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, decision, reason }: { id: string; decision: "approve" | "reject"; reason?: string }) =>
      api.post(`/v1/staff/listings/${id}/${decision}`, reason ? { reason } : {}),
    onSuccess: () => void qc.invalidateQueries({ queryKey: ["staff", "queue"] }),
  });
}
