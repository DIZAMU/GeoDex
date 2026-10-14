/**
 * "Reset progress" without deleting anything (CLAUDE.md invariant 1): events stay in the
 * log, and every replay starts after the reset time kept in the synced settings.
 */
export function eventsSince<T extends { reviewedAt: number }>(
  events: readonly T[],
  resetAt: number | null | undefined,
): T[] {
  return resetAt == null ? [...events] : events.filter((e) => e.reviewedAt > resetAt);
}
