import { describe, expect, it } from "vitest";
import { type GradeInput, grade, rollingMedian } from "./grading";

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
