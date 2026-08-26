import { z } from "zod";

export const PageQuery = z.object({
  cursor: z.string().max(200).optional(),
  limit: z.coerce.number().int().min(1).max(50).default(20),
});
export type PageQuery = z.infer<typeof PageQuery>;

/**
 * Keyset cursor: base64url of `${occurredAtIso}|${id}`. Opaque to clients;
 * no offset pagination anywhere, so no unbounded scans.
 */
export function encodeCursor(at: Date, id: string): string {
  return Buffer.from(`${at.toISOString()}|${id}`).toString("base64url");
}
export function decodeCursor(cursor: string): { at: Date; id: string } | null {
  try {
    const [iso, id] = Buffer.from(cursor, "base64url").toString("utf8").split("|");
    const at = new Date(iso!);
    if (!id || Number.isNaN(at.getTime())) return null;
    return { at, id };
  } catch { return null; }
}
