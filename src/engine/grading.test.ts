import { describe, expect, it } from "vitest";
import {
  type GradeInput,
  grade,
  gradePin,
  LANDMARK_PIN,
  ratingForPhase,
  rollingMedian,
} from "./grading";
import { applyReview, type CardState, createScheduler } from "./scheduler";
import type { Rating } from "./types";

const base: GradeInput = {
  correct: true,
  responseMs: 3000,
  mode: "typed",
  inputSetting: "auto",
  medianMs: 3000,
  reviewsInMode: 100,
};

describe("grade", () => {
  it("rates wrong, given-up and timed-out answers Again", () => {
    expect(grade({ ...base, correct: false })).toBe(1);
    expect(grade({ ...base, gaveUp: true })).toBe(1);
  });

  it("rates a normal correct answer Good", () => {
    expect(grade(base)).toBe(3);
  });

  it("rates hints, typos, slow answers and answers over 60 s Hard", () => {
    expect(grade({ ...base, usedHint: true })).toBe(2);
    expect(grade({ ...base, typo: true })).toBe(2);
    expect(grade({ ...base, responseMs: 6001 })).toBe(2);
    expect(grade({ ...base, responseMs: 61_000, medianMs: null, reviewsInMode: 0 })).toBe(2);
  });

  it("rates fast answers Easy only in typed, map and pin modes with 50 reviews", () => {
    expect(grade({ ...base, responseMs: 1700 })).toBe(4);
    expect(grade({ ...base, responseMs: 1700, mode: "map" })).toBe(4);
    expect(grade({ ...base, responseMs: 1700, reviewsInMode: 49 })).toBe(3);
    expect(grade({ ...base, responseMs: 1700, mode: "mc", inputSetting: "mc" })).toBe(3);
  });

  it("does not judge slowness before 10 reviews in a mode", () => {
    expect(grade({ ...base, responseMs: 20_000, reviewsInMode: 9 })).toBe(3);
  });

  it("caps the multiple choice setting at Good", () => {
    expect(grade({ ...base, mode: "map", inputSetting: "mc", responseMs: 1000 })).toBe(3);
  });
});

describe("rollingMedian", () => {
  it("returns the median of the window, capped at 60 s per value", () => {
    expect(rollingMedian([])).toBeNull();
    expect(rollingMedian([1, 3, 2])).toBe(2);
    expect(rollingMedian([1, 2, 3, 4])).toBe(2.5);
    expect(rollingMedian([1000, 90_000, 90_000])).toBe(60_000);
    expect(rollingMedian([100, 1, 2, 3], 3)).toBe(2);
  });
});

describe("gradePin", () => {
  it("grades by distance: 100 km Good, 300 km Hard, beyond Again", () => {
    expect(gradePin(0)).toEqual({ rating: 3, correct: true });
    expect(gradePin(100)).toEqual({ rating: 3, correct: true });
    expect(gradePin(101)).toEqual({ rating: 2, correct: true });
    expect(gradePin(300)).toEqual({ rating: 2, correct: true });
    expect(gradePin(301)).toEqual({ rating: 1, correct: false });
  });

  it("is looser for landmarks: 150 km Good, 500 km Hard", () => {
    expect(gradePin(150, LANDMARK_PIN)).toEqual({ rating: 3, correct: true });
    expect(gradePin(151, LANDMARK_PIN)).toEqual({ rating: 2, correct: true });
    expect(gradePin(500, LANDMARK_PIN)).toEqual({ rating: 2, correct: true });
    expect(gradePin(501, LANDMARK_PIN)).toEqual({ rating: 1, correct: false });
  });
});

describe("ratingForPhase", () => {
  it("counts Hard as Good in learning and relearning steps only", () => {
    expect(ratingForPhase(2, "learning")).toBe(3);
    expect(ratingForPhase(2, "relearning")).toBe(3);
    expect(ratingForPhase(2, "review")).toBe(2);
    expect(ratingForPhase(2, "new")).toBe(2);
    expect(ratingForPhase(2, undefined)).toBe(2);
    expect(ratingForPhase(1, "relearning")).toBe(1);
    expect(ratingForPhase(4, "learning")).toBe(4);
  });

  it("lets a missed card leave relearning on the next right answer, even a Hard one", () => {
    // Marrakesh: known, missed once, then pinned 100 to 300 km off (Hard) again and again.
    const scheduler = createScheduler();
    const review = (state: CardState | null, rating: Rating, at: number) =>
      applyReview(scheduler, state, {
        cardId: "MAR-marrakesh:city_to_map",
        reviewedAt: at,
        rating: ratingForPhase(rating, state?.phase),
        scheduled: true,
        mode: "pin",
      });
    let now = Date.UTC(2026, 10, 9, 10);
    let state = review(null, 3, now);
    for (const rating of [3, 3] as const) {
      now = Math.max(now + 60_000, state?.due ?? now);
      state = review(state, rating, now);
    }
    expect(state?.phase).toBe("review");
    now = state?.due ?? now;
    state = review(state, 1, now);
    expect(state?.phase).toBe("relearning");
    now = state?.due ?? now;
    state = review(state, 2, now);
    // Out of the short step: the card waits a day or more, not 15 minutes.
    expect(state?.phase).toBe("review");
    expect((state?.due ?? 0) - now).toBeGreaterThan(12 * 60 * 60_000);
  });
});
