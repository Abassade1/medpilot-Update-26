import { z } from "zod";

/**
 * Mirrors src/utils/validation.ts in the React Native app (spec §15) so the
 * backend rejects exactly what the client flags, with matching messages.
 */
export const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[a-z]{2,}$/i;
const NAME_RE = /^[\p{L}\p{M}'\-. ]+$/u;

export const email = z.string().trim().min(1, "Email address is required")
  .max(254, "Email address is too long")
  .regex(EMAIL_RE, "Enter a valid email address")
  .transform((v) => v.toLowerCase());

export const password = z.string().min(8, "Use at least 8 characters").max(64, "Password is too long");

export const personName = (label: string) =>
  z.string().trim().min(1, `${label} is required`)
    .max(40, `${label} must be 40 characters or fewer`)
    .regex(NAME_RE, `${label} contains invalid characters`);

export const phone = z.string().trim().min(1, "Phone number is required")
  .refine((v) => { const d = v.replace(/\D+/g, ""); return d.length >= 10 && d.length <= 15; },
    "Enter a valid phone number")
  .transform((v) => {
    const digits = v.replace(/\D+/g, "");
    return v.startsWith("+") ? `+${digits}` : `+1${digits}`; // CA default per profile
  });

export const dateOfBirth = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Use the format YYYY-MM-DD")
  .superRefine((v, ctx) => {
    const [y, m, d] = v.split("-").map(Number) as [number, number, number];
    const dt = new Date(Date.UTC(y, m - 1, d));
    const real = dt.getUTCFullYear() === y && dt.getUTCMonth() === m - 1 && dt.getUTCDate() === d;
    if (!real) return ctx.addIssue({ code: "custom", message: "That date doesn't exist" });
    if (dt.getTime() > Date.now()) return ctx.addIssue({ code: "custom", message: "Date of birth can't be in the future" });
    const age = (Date.now() - dt.getTime()) / (365.25 * 24 * 3600 * 1000);
    if (age > 120) ctx.addIssue({ code: "custom", message: "Enter a valid date of birth" });
  });

export const RegisterBody = z.object({
  email,
  // Optional: the app collects the password on a later onboarding step. An
  // account created without one has no password hash at all, so it reports
  // "password not set" honestly and cannot be signed into until one is chosen.
  password: password.optional(),
  firstName: personName("Firstname"),
  lastName: personName("Lastname"),
  phone,
  dateOfBirth,
  gender: z.enum(["male", "female", "undisclosed"]).optional(),
  maritalStatus: z.enum(["single", "married", "divorced", "widowed"]).optional(),
});

export const LoginBody = z.object({ email, password: z.string().min(1, "Password is required").max(64) });
export const RefreshBody = z.object({ refreshToken: z.string().min(20).max(200) });
export const CheckEmailBody = z.object({ email });
export const ForgotBody = z.object({ email });
export const ResetBody = z.object({ token: z.string().min(20).max(200), password });
export const ConfirmVerificationBody = z.object({ token: z.string().min(20).max(200) });

export const TokenPairShape = z.object({
  accessToken: z.string(), refreshToken: z.string(), expiresIn: z.number(),
});
export const AuthResponse = z.object({
  user: z.object({ id: z.string(), email: z.string(), emailVerified: z.boolean() }),
  profile: z.object({ firstName: z.string(), lastName: z.string(), fullName: z.string() }),
  tokens: TokenPairShape,
  setup: z.object({ passwordSet: z.boolean(), historyComplete: z.boolean(), emailVerified: z.boolean() }),
});
