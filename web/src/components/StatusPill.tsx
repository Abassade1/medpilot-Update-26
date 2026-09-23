const LABELS: Record<string, string> = {
  draft: "Draft", review: "In review", published: "Published", unpublished: "Unpublished", archived: "Archived",
  verified: "Verified", unverified: "Not verified", pending: "Pending", rejected: "Not approved",
  confirmed: "Confirmed", completed: "Completed", cancelled: "Cancelled",
};

export default function StatusPill({ status }: { status: string }) {
  return <span className={`pill pill-${status}`}>{LABELS[status] ?? status}</span>;
}
