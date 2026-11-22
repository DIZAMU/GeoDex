import { describe, expect, it } from "vitest";
import { computeBudget, DEFAULT_SECONDS_PER_REVIEW, secondsPerReview } from "./budget";

describe("computeBudget", () => {
  it("fits new cards into the time left after due reviews", () => {
    // 18 min = 1080 s; 60 due x 10 s = 600 s; 480 s / 30 s = 16 new.
    expect(
      computeBudget({
        dailyMinutes: 18,
        dueToday: 60,
        secondsPerReview: 10,
        newPerDayOverride: null,
      }),
    ).toEqual({
      dueToday: 60,
      newToday: 16,
      estimatedMinutes: 18,
      paused: false,
    });
  });

  it("caps new cards at 25 and never goes negative", () => {
    expect(
      computeBudget({
        dailyMinutes: 60,
        dueToday: 0,
        secondsPerReview: 10,
        newPerDayOverride: null,
      }).newToday,
    ).toBe(25);
    expect(
      computeBudget({
        dailyMinutes: 15,
        dueToday: 100,
        secondsPerReview: 10,
        newPerDayOverride: null,
      }).newToday,
    ).toBe(0);
  });

  it("pauses new cards when the backlog exceeds the budget by more than 50%", () => {
    // 15 min = 900 s; 136 due x 10 s = 1360 s > 1350 s.
    const result = computeBudget({
      dailyMinutes: 15,
      dueToday: 136,
      secondsPerReview: 10,
      newPerDayOverride: 5,
    });
    expect(result.paused).toBe(true);
    expect(result.newToday).toBe(0);
  });

  it("uses the override when set and caps due reviews at 200", () => {
    expect(
      computeBudget({ dailyMinutes: 60, dueToday: 10, secondsPerReview: 10, newPerDayOverride: 7 })
        .newToday,
    ).toBe(7);
    expect(
      computeBudget({
        dailyMinutes: 60,
        dueToday: 300,
        secondsPerReview: 10,
        newPerDayOverride: null,
      }).dueToday,
    ).toBe(200);
  });
});

describe("the review limit", () => {
  const base = { dailyMinutes: 60, secondsPerReview: 10, newPerDayOverride: null };
  it("caps reviews at the limit and gives new cards only the room left under limit plus 25", () => {
    expect(computeBudget({ ...base, dueToday: 120, reviewLimit: 75 })).toMatchObject({
      dueToday: 75,
      newToday: 0,
      paused: true,
    });
    expect(computeBudget({ ...base, dueToday: 90, reviewLimit: 75 }).newToday).toBe(10);
    expect(computeBudget({ ...base, dueToday: 30, reviewLimit: 75 }).newToday).toBe(25);
  });

  it("lets a raised new-card limit raise the day's total", () => {
    expect(
      computeBudget({ ...base, newPerDayOverride: 50, dueToday: 90, reviewLimit: 75 }).newToday,
    ).toBe(35);
  });

  it("keeps the old behaviour with no limit", () => {
    expect(computeBudget({ ...base, dueToday: 120, reviewLimit: null })).toMatchObject({
      dueToday: 120,
      newToday: 25,
      paused: false,
    });
  });
});

describe("secondsPerReview", () => {
  const now = Date.UTC(2026, 5, 1);
  it("defaults to 10 s with too little history", () => {
    expect(secondsPerReview([], now)).toBe(DEFAULT_SECONDS_PER_REVIEW);
  });

  it("uses the 14-day median", () => {
    const recent = Array.from({ length: 21 }, (_, i) => ({
      reviewedAt: now - i * 3_600_000,
      durationMs: 6000 + i * 100,
    }));
    const old = Array.from({ length: 50 }, () => ({
      reviewedAt: now - 20 * 86_400_000,
      durationMs: 60_000,
    }));
    expect(secondsPerReview([...recent, ...old], now)).toBe(7);
  });
});
