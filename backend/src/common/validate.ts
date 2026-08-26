import { z } from "zod";
import { AppError } from "./errors";

/**
 * Validates external input against a Zod schema; on failure throws the 422
 * envelope shape the frontend maps onto TextField errors.
 */
export function validate<T extends z.ZodType>(schema: T, data: unknown): z.output<T> {
  const r = schema.safeParse(data);
  if (r.success) return r.data;
  const fields: Record<string, string> = {};
  for (const issue of r.error.issues) {
    const key = issue.path.join(".") || "_";
    if (!fields[key]) fields[key] = issue.message;
  }
  const first = Object.values(fields)[0] ?? "Invalid request";
  throw new AppError("validation_failed", first, { fields });
}
