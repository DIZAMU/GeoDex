/** Daily time budget: how many new cards fit today. */

export const DEFAULT_SECONDS_PER_REVIEW = 10;
export const MAX_NEW_PER_DAY = 25;
export const MAX_DUE_PER_DAY = 200;
/** A new card costs its intro panel and learning steps: about three reviews. */
export const NEW_CARD_COST_FACTOR = 3;
/** New cards pause when the due backlog exceeds the budget by more than this. */
export const BACKLOG_PAUSE_FACTOR = 1.5;

export type BudgetInput = {
  dailyMinutes: number;
  dueToday: number;
  secondsPerReview: number;
  newPerDayOverride: number | null;
};

export type Budget = {
  dueToday: number; // capped at 200
  newToday: number;
  estimatedMinutes: number;
  paused: boolean; // new cards paused for backlog
};

export function computeBudget(input: BudgetInput): Budget {
  const seconds = input.secondsPerReview > 0 ? input.secondsPerReview : DEFAULT_SECONDS_PER_REVIEW;
  const dueToday = Math.min(input.dueToday, MAX_DUE_PER_DAY);
  const budgetSeconds = input.dailyMinutes * 60;
  const paused = input.dueToday * seconds > BACKLOG_PAUSE_FACTOR * budgetSeconds;
  let newToday: number;
  if (paused) {
    newToday = 0;
  } else if (input.newPerDayOverride !== null) {
    newToday = Math.max(0, input.newPerDayOverride);
  } else {
    const fit = Math.floor((budgetSeconds - dueToday * seconds) / (NEW_CARD_COST_FACTOR * seconds));
    newToday = Math.min(Math.max(fit, 0), MAX_NEW_PER_DAY);
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
