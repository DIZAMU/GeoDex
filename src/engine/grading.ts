import type { AnswerMode, InputSetting, Rating } from "./types";

/** Responses over this count as Hard, not wrong (PLAN.md 6.2). */
export const RESPONSE_CAP_MS = 60_000;
/** Easy is not given until a mode has this many reviews, so "fast" means something. */
export const MIN_REVIEWS_FOR_EASY = 50;
/** Slow is not judged until a mode has this many reviews. */
export const MIN_REVIEWS_FOR_SLOW = 10;

export type GradeInput = {
  correct: boolean;
  /** Gave up, or the visible countdown ran out. */
  gaveUp?: boolean;
  usedHint?: boolean;
  /** Typed answer accepted with a typo. */
  typo?: boolean;
  responseMs: number;
  mode: AnswerMode;
  inputSetting: InputSetting;
  /** Rolling median response time for this mode, and how many reviews it is based on. */
  medianMs: number | null;
  reviewsInMode: number;
};

const EASY_MODES: ReadonlySet<AnswerMode> = new Set(["typed", "map", "pin"]);

export function grade(input: GradeInput): Rating {
  if (!input.correct || input.gaveUp) return 1;

  let rating: Rating = 3;
  const median = input.medianMs;
  if (input.usedHint || input.typo || input.responseMs > RESPONSE_CAP_MS) {
    rating = 2;
  } else if (
    median !== null &&
    input.reviewsInMode >= MIN_REVIEWS_FOR_SLOW &&
    input.responseMs > 2 * median
  ) {
    rating = 2;
  } else if (
    median !== null &&
    EASY_MODES.has(input.mode) &&
    input.reviewsInMode >= MIN_REVIEWS_FOR_EASY &&
    input.responseMs < 0.6 * median
  ) {
    rating = 4;
  }

  // Multiple choice tests recognition only, so it never earns Easy.
  if (input.inputSetting === "mc" || input.mode === "mc") return Math.min(rating, 3) as Rating;
  return rating;
}

/** Median of the last `window` values, or null when there are none. */
export function rollingMedian(values: readonly number[], window = 200): number | null {
  const recent = values.slice(-window).map((v) => Math.min(v, RESPONSE_CAP_MS));
  if (recent.length === 0) return null;
  const sorted = [...recent].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2
    ? (sorted[mid] as number)
    : ((sorted[mid - 1] as number) + (sorted[mid] as number)) / 2;
}

/** Pin grading for cities (PLAN.md 5.3): distance in km to the rating. */
export const PIN_GOOD_KM = 100;
export const PIN_HARD_KM = 300;

export function gradePin(distanceKm: number): { rating: Rating; correct: boolean } {
  if (distanceKm <= PIN_GOOD_KM) return { rating: 3, correct: true };
  if (distanceKm <= PIN_HARD_KM) return { rating: 2, correct: true };
  return { rating: 1, correct: false };
}
