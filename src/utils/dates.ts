/**
 * Calendar-date helpers.
 *
 * Dates travel through the app as "YYYY-MM-DD" strings and times as "HH:MM".
 * They are never round-tripped through `toISOString()`, which converts to UTC
 * and shifts the calendar day for anyone west or east of Greenwich — a booking
 * for the 12th would silently become the 11th or 13th.
 */

const pad = (n: number) => String(n).padStart(2, "0");

const MONTHS = [
  "Jan", "Feb", "Mar", "Apr", "May", "Jun",
  "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
];
const MONTHS_LONG = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

/** A Date's *local* calendar day as YYYY-MM-DD. */
export function toIso(d: Date): string {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

/**
 * Parses YYYY-MM-DD into a local-midnight Date, or null if it isn't a real day.
 * Date.parse rolls 31 Feb into 3 Mar, so validity is a round trip through the
 * date's own components.
 */
export function fromIso(iso: string): Date | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso);
  if (!m) return null;
  const [y, mo, d] = [Number(m[1]), Number(m[2]), Number(m[3])];
  const date = new Date(y, mo - 1, d);
  if (date.getFullYear() !== y || date.getMonth() !== mo - 1 || date.getDate() !== d) return null;
  return date;
}

/** Days in a month, leap years included. */
export function daysInMonth(year: number, month1: number): number {
  return new Date(year, month1, 0).getDate();
}

/** "12 Oct 2026" — unambiguous, so it can never be misread as DD/MM or MM/DD. */
export function formatDate(iso: string | null | undefined): string {
  if (!iso) return "";
  const d = fromIso(iso.slice(0, 10));
  if (!d) return iso;
  return `${d.getDate()} ${MONTHS[d.getMonth()]} ${d.getFullYear()}`;
}

/** "12 October 2026" for places with room. */
export function formatDateLong(iso: string | null | undefined): string {
  if (!iso) return "";
  const d = fromIso(iso.slice(0, 10));
  if (!d) return iso;
  return `${d.getDate()} ${MONTHS_LONG[d.getMonth()]} ${d.getFullYear()}`;
}

/** "14:30" -> "2:30 PM". */
export function formatTime(hhmm: string | null | undefined): string {
  if (!hhmm) return "";
  const m = /^(\d{2}):(\d{2})/.exec(hhmm);
  if (!m) return hhmm;
  const h = Number(m[1]);
  return `${h % 12 === 0 ? 12 : h % 12}:${m[2]} ${h < 12 ? "AM" : "PM"}`;
}

/** Today's date in UTC. The API decides "today" in UTC, so windows must too. */
export function utcTodayIso(now: Date = new Date()): string {
  return `${now.getUTCFullYear()}-${pad(now.getUTCMonth() + 1)}-${pad(now.getUTCDate())}`;
}

/** Adds whole days to a YYYY-MM-DD without any timezone arithmetic. */
export function addDays(iso: string, days: number): string {
  const [y, m, d] = iso.split("-").map(Number) as [number, number, number];
  const t = new Date(Date.UTC(y, m - 1, d + days));
  return `${t.getUTCFullYear()}-${pad(t.getUTCMonth() + 1)}-${pad(t.getUTCDate())}`;
}

export interface DateRule {
  min?: string; // inclusive, YYYY-MM-DD
  max?: string; // inclusive, YYYY-MM-DD
  /** Wording for the bounds, so errors say "after today" not "before 2026-09-21". */
  minMessage?: string;
  maxMessage?: string;
}

/** Explains what is wrong with a complete YYYY-MM-DD, or undefined if it is fine. */
export function validateIso(iso: string, rule: DateRule = {}): string | undefined {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso);
  if (!m) return "Enter the date as YYYY-MM-DD";
  const [y, mo, d] = [Number(m[1]), Number(m[2]), Number(m[3])];
  if (mo < 1 || mo > 12) return "Month must be between 01 and 12";
  if (!fromIso(iso)) return `${MONTHS_LONG[mo - 1]} ${y} doesn't have a day ${d}`;
  if (rule.min && iso < rule.min) return rule.minMessage ?? `Choose ${formatDate(rule.min)} or later`;
  if (rule.max && iso > rule.max) return rule.maxMessage ?? `Choose ${formatDate(rule.max)} or earlier`;
  return undefined;
}

/** Explains what is wrong with an HH:MM, or undefined if it is fine (24-hour). */
export function validateTime(hhmm: string): string | undefined {
  const m = /^(\d{2}):(\d{2})$/.exec(hhmm);
  if (!m) return "Enter the time as HH:MM (24-hour)";
  if (Number(m[1]) > 23 || Number(m[2]) > 59) return "That isn't a valid time of day";
  return undefined;
}

/** Digits-only typing -> "YYYY-MM-DD" as the user types, capped at 8 digits. */
export function maskDate(text: string): string {
  const digits = text.replace(/\D/g, "").slice(0, 8);
  if (digits.length <= 4) return digits;
  if (digits.length <= 6) return `${digits.slice(0, 4)}-${digits.slice(4)}`;
  return `${digits.slice(0, 4)}-${digits.slice(4, 6)}-${digits.slice(6)}`;
}

/** Digits-only typing -> "HH:MM" as the user types, capped at 4 digits. */
export function maskTime(text: string): string {
  const digits = text.replace(/\D/g, "").slice(0, 4);
  return digits.length <= 2 ? digits : `${digits.slice(0, 2)}:${digits.slice(2)}`;
}

/** A local-time Date for a picker seed, from HH:MM. */
export function timeToDate(hhmm: string | null, base: Date = new Date()): Date {
  const d = new Date(base);
  const m = hhmm ? /^(\d{2}):(\d{2})$/.exec(hhmm) : null;
  d.setHours(m ? Number(m[1]) : 9, m ? Number(m[2]) : 0, 0, 0);
  return d;
}

export const toHHMM = (d: Date) => `${pad(d.getHours())}:${pad(d.getMinutes())}`;

/** "12 Oct 2026 at 2:30 PM" for an absolute instant, shown in the viewer's own timezone. */
export function formatInstant(iso: string | null | undefined): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return `${formatDate(toIso(d))} at ${formatTime(toHHMM(d))}`;
}
