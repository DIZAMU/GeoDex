/**
 * "How long until I know everything?" for the welcome page. A rough,
 * deterministic simulation under the real daily budget: each new card comes back after
 * intervals that roughly follow FSRS for a learner who mostly answers right, until it holds
 * for two months. The answer is shown as "about", never as a promise.
 */
import { computeBudget, DEFAULT_REVIEW_LIMIT, DEFAULT_SECONDS_PER_REVIEW } from "./budget";

/** Days after its first review on which a typical card is reviewed again. */
export const TYPICAL_REVIEW_DAYS = [1, 4, 11, 27, 62] as const;
/** A card counts as mastered once it holds this long (as in the explanation engine). */
export const MASTERED_AFTER_DAYS = 62;

export type MasteryEstimate = {
  /** Days until every card has been introduced. */
  daysToIntroduce: number;
  /** Days until the last card is mastered. */
  daysToMaster: number;
  /** Rounded months, at least 1. */
  months: number;
};

export function masteryEstimate(input: {
  totalCards: number;
  dailyMinutes: number;
  secondsPerReview?: number;
  /** Safety stop for absurd inputs. */
  maxDays?: number;
}): MasteryEstimate {
  const seconds = input.secondsPerReview ?? DEFAULT_SECONDS_PER_REVIEW;
  const maxDays = input.maxDays ?? 3650;
  const due = new Map<number, number>();
  let introduced = 0;
  let day = 0;
  while (introduced < input.totalCards && day < maxDays) {
    const dueToday = due.get(day) ?? 0;
    const { newToday } = computeBudget({
      dailyMinutes: input.dailyMinutes,
      dueToday,
      secondsPerReview: seconds,
      newPerDayOverride: null,
      reviewLimit: DEFAULT_REVIEW_LIMIT,
    });
    const fresh = Math.min(newToday, input.totalCards - introduced);
    introduced += fresh;
    for (const offset of TYPICAL_REVIEW_DAYS) {
      due.set(day + offset, (due.get(day + offset) ?? 0) + fresh);
    }
    day += 1;
  }
  const daysToIntroduce = day;
  const daysToMaster = daysToIntroduce + MASTERED_AFTER_DAYS;
  return { daysToIntroduce, daysToMaster, months: Math.max(1, Math.round(daysToMaster / 30)) };
}
