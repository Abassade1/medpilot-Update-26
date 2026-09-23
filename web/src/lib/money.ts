export function dollarsToCents(text: string): number | null | "invalid" {
  const t = text.trim().replace(/[$,\s]/g, "");
  if (!t) return null;
  if (!/^\d+(\.\d{1,2})?$/.test(t)) return "invalid";
  return Math.round(Number(t) * 100);
}
export const centsToDollars = (cents: number | null | undefined) =>
  cents == null ? "" : (cents / 100).toFixed(2).replace(/\.00$/, "");
