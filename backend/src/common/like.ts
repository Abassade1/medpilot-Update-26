/**
 * Builds a "contains" pattern for LIKE/ILIKE from user input.
 *
 * `%` and `_` are wildcards in LIKE, so a search for "50%" or "a_b" would
 * otherwise match far more than it says. They (and the escape character
 * itself) are escaped so the search is literal.
 */
export const containsPattern = (q: string): string => `%${q.replace(/[\\%_]/g, "\\$&")}%`;
