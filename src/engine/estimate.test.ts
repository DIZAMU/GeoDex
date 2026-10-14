import { describe, expect, it } from "vitest";
import { masteryEstimate } from "./estimate";

describe("masteryEstimate", () => {
  it("is deterministic and grows with the number of cards", () => {
    const a = masteryEstimate({ totalCards: 400, dailyMinutes: 18 });
    expect(masteryEstimate({ totalCards: 400, dailyMinutes: 18 })).toEqual(a);
    const b = masteryEstimate({ totalCards: 1600, dailyMinutes: 18 });
    expect(b.daysToIntroduce).toBeGreaterThan(a.daysToIntroduce);
  });

  it("gets shorter with more minutes a day", () => {
    const slow = masteryEstimate({ totalCards: 1600, dailyMinutes: 10 });
    const fast = masteryEstimate({ totalCards: 1600, dailyMinutes: 30 });
    expect(fast.months).toBeLessThan(slow.months);
  });

  it("always needs the mastery period after the last new card", () => {
    const e = masteryEstimate({ totalCards: 10, dailyMinutes: 18 });
    expect(e.daysToIntroduce).toBe(1);
    expect(e.daysToMaster).toBe(63);
    expect(e.months).toBe(2);
  });

  it("stops at the safety limit when no new cards ever fit", () => {
    const e = masteryEstimate({ totalCards: 100, dailyMinutes: 0, maxDays: 50 });
    expect(e.daysToIntroduce).toBe(50);
  });
});
