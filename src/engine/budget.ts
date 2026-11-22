/** Daily time budget: how many new cards fit today. */

export const DEFAULT_SECONDS_PER_REVIEW = 10;
export const MAX_NEW_PER_DAY = 25;
export const MAX_DUE_PER_DAY = 200;
/** A new card costs its intro panel and learning steps: about three reviews. */
export const NEW_CARD_COST_FACTOR = 3;
/** Reviews a day holds unless the learner picks another limit. */
export const DEFAULT_REVIEW_LIMIT = 75;
/** The review limits Settings offers; null there means no limit. */
export const REVIEW_LIMITS = [50, 75, 100, 150] as const;
/** New cards pause when the due backlog exceeds the budget by more than this. */
export const BACKLOG_PAUSE_FACTOR = 1.5;

export type BudgetInput = {
  dailyMinutes: number;
  dueToday: number;
  secondsPerReview: number;
  newPerDayOverride: number | null;
  /**
   * Most reviews a day holds; null or absent for no limit. With a limit, the day holds at most
   * the limit plus the new-card limit, reviews first: due reviews past that leave no room for
   * new cards, so a backlog shrinks instead of growing.
   */
  reviewLimit?: number | null;
};

export type Budget = {
  dueToday: number; // capped at the review limit, or 200 without one
  newToday: number;
  estimatedMinutes: number;
  paused: boolean; // new cards paused for backlog
};

export function computeBudget(input: BudgetInput): Budget {
  const seconds = input.secondsPerReview > 0 ? input.secondsPerReview : DEFAULT_SECONDS_PER_REVIEW;
  const limit = input.reviewLimit ?? null;
  const dueToday = Math.min(input.dueToday, limit ?? MAX_DUE_PER_DAY);
  const budgetSeconds = input.dailyMinutes * 60;
  const newLimit =
    input.newPerDayOverride !== null ? Math.max(0, input.newPerDayOverride) : MAX_NEW_PER_DAY;
  // Room for new cards once every due review has its place: limit plus new-card limit in all.
  const room = limit === null ? newLimit : Math.max(0, limit + newLimit - input.dueToday);
  const paused =
    input.dueToday * seconds > BACKLOG_PAUSE_FACTOR * budgetSeconds || (newLimit > 0 && room === 0);
  let newToday: number;
  if (paused) {
    newToday = 0;
  } else if (input.newPerDayOverride !== null) {
    newToday = Math.min(newLimit, room);
  } else {
    const fit = Math.floor((budgetSeconds - dueToday * seconds) / (NEW_CARD_COST_FACTOR * seconds));
    newToday = Math.min(Math.max(fit, 0), MAX_NEW_PER_DAY, room);
  }
  const estimatedMinutes = Math.round(
    (dueToday * seconds + newToday * NEW_CARD_COST_FACTOR * seconds) / 60,
  );
  return { dueToday, newToday, estimatedMinutes, paused };
}

/** Median seconds from prompt to continue over the last 14 days, or the default. */
export function secondsPerReview(
  reviews: readonly { reviewedAt: number; durationMs: number }[],
  now: number,
): number {
  const since = now - 14 * 86_400_000;
  const durations = reviews
    .filter((r) => r.reviewedAt >= since && r.durationMs > 0)
    .map((r) => Math.min(r.durationMs, 120_000))
    .sort((a, b) => a - b);
  if (durations.length < 20) return DEFAULT_SECONDS_PER_REVIEW;
  const mid = Math.floor(durations.length / 2);
  const median =
    durations.length % 2
      ? (durations[mid] as number)
      : ((durations[mid - 1] as number) + (durations[mid] as number)) / 2;
  return median / 1000;
}
