/**
 * A stored rating is the average of member reviews, and 0 means there are none yet (a real
 * average is at least 1). The API says `null` for that, so clients show "No reviews yet".
 */
export const displayRating = (stored: string | number): number | null => Number(stored) || null;
