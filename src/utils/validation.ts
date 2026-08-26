/** Frontend-only validators. No network calls — these mirror the UX the
 *  backend will later enforce. */

export const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[a-z]{2,}$/i;
const DIGITS = /\D+/g;

export const MAX_NAME = 40;
export const MAX_FREE_TEXT = 200;

export function validateEmail(value: string): string | undefined {
  const v = value.trim();
  if (!v) return "Email address is required";
  if (v.length > 254) return "Email address is too long";
  if (!EMAIL_RE.test(v)) return "Enter a valid email address";
  return undefined;
}

export function validateRequired(value: string, label: string): string | undefined {
  if (!value.trim()) return `${label} is required`;
  return undefined;
}

export function validateName(value: string, label: string): string | undefined {
  const v = value.trim();
  if (!v) return `${label} is required`;
  if (v.length > MAX_NAME) return `${label} must be ${MAX_NAME} characters or fewer`;
  if (!/^[\p{L}\p{M}'\-. ]+$/u.test(v)) return `${label} contains invalid characters`;
  return undefined;
}

/** North-American style: 10–15 digits once punctuation is stripped. */
export function validatePhone(value: string): string | undefined {
  const v = value.trim();
  if (!v) return "Phone number is required";
  const digits = v.replace(DIGITS, "");
  if (digits.length < 10) return "Enter a valid phone number";
  if (digits.length > 15) return "Phone number is too long";
  return undefined;
}

/** ISO-ish date (YYYY-MM-DD) with a real-calendar and age sanity check. */
export function validateDob(value: string): string | undefined {
  const v = value.trim();
  if (!v) return "Date of birth is required";
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(v);
  if (!m) return "Use the format YYYY-MM-DD";

  const [, y, mo, d] = m.map(Number) as unknown as [string, number, number, number];
  const date = new Date(Date.UTC(y, mo - 1, d));
  const realDate =
    date.getUTCFullYear() === y && date.getUTCMonth() === mo - 1 && date.getUTCDate() === d;
  if (!realDate) return "That date doesn't exist";

  const now = new Date();
  if (date.getTime() > now.getTime()) return "Date of birth can't be in the future";
  const age = (now.getTime() - date.getTime()) / (365.25 * 24 * 3600 * 1000);
  if (age > 120) return "Enter a valid date of birth";
  return undefined;
}

export function validatePassword(value: string): string | undefined {
  if (!value) return "Password is required";
  if (value.length < 8) return "Use at least 8 characters";
  if (value.length > 64) return "Password is too long";
  return undefined;
}

export function validateMaxLength(
  value: string,
  max: number,
  label: string
): string | undefined {
  if (value.length > max) return `${label} must be ${max} characters or fewer`;
  return undefined;
}

/**
 * Convert a UI date (DD/MM/YYYY) to the ISO calendar date the API expects.
 * Returns null when the text is not a real date so the caller can show an error.
 */
export function toIsoDate(input: string): string | null {
  const m = input.trim().match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  if (!m) return null;
  const [, dd, mm, yyyy] = m;
  const date = new Date(`${yyyy}-${mm}-${dd}T00:00:00Z`);
  if (Number.isNaN(date.getTime())) return null;
  if (date.getUTCDate() !== Number(dd) || date.getUTCMonth() + 1 !== Number(mm)) return null;
  return `${yyyy}-${mm}-${dd}`;
}

/** Same as toIsoDate but for the MM/DD/YYYY fields used in the travel flow. */
export function toIsoDateUS(input: string): string | null {
  const m = input.trim().match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  if (!m) return null;
  const [, mm, dd, yyyy] = m;
  return toIsoDate(`${dd}/${mm}/${yyyy}`);
}
