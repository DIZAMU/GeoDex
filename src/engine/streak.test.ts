import { describe, expect, it } from "vitest";
import { createScheduler } from "./scheduler";
import { computeStreak, MAX_FREEZES } from "./streak";
import type { Rating, ReviewEventCore } from "./types";

const scheduler = createScheduler();
const DAY = 86_400_000;
// Noon local time on day 0, well inside a learning day that starts at 04:00.
const BASE = new Date(2026, 0, 5, 12).getTime();
let n = 0;

function ev(day: number, card: string, opts: Partial<ReviewEventCore> = {}): ReviewEventCore {
  n += 1;
  return {
    id: `e${String(n).padStart(5, "0")}`,
    cardId: card,
    reviewedAt: BASE + day * DAY + n,
    rating: 3 as Rating,
    mode: "mc",
    correct: true,
    chosenAnswer: null,
    responseMs: 2000,
    scheduled: true,
    ...opts,
  };
}

/** The same two cards reviewed on each listed day, so every due card is always done. */
function daily(days: number[]): ReviewEventCore[] {
  return days.flatMap((d) => [ev(d, "A:map_to_name"), ev(d, "B:map_to_name")]);
}

describe("streak", () => {
  it("counts consecutive days, and today in progress does not break it", () => {
    const s = computeStreak(scheduler, daily([0, 1, 2, 3]), BASE + 4 * DAY, 4);
    expect(s.current).toBe(4);
    expect(s.longest).toBe(4);
    expect(s.days.at(-1)?.counted).toBe(false);
  });

  it("breaks after a missed day when there is no freeze", () => {
    const s = computeStreak(scheduler, daily([0, 1, 3, 4]), BASE + 4 * DAY, 4);
    expect(s.current).toBe(2);
    expect(s.longest).toBe(2);
  });

  it("earns a freeze per 7 days, holds at most 2, and spends one on a missed day", () => {
    const fourteen = Array.from({ length: 21 }, (_, i) => i);
    const full = computeStreak(scheduler, daily(fourteen), BASE + 20 * DAY, 4);
    expect(full.freezes).toBe(MAX_FREEZES);
    const gap = computeStreak(scheduler, daily([0, 1, 2, 3, 4, 5, 6, 8, 9]), BASE + 9 * DAY, 4);
    expect(gap.days.find((d) => d.frozen)).toBeDefined();
    expect(gap.current).toBe(9);
    expect(gap.freezes).toBe(0);
  });

  it("needs every due card reviewed, or 30 reviews when the backlog is larger", () => {
    // Day 0: learn three cards; they come due again later.
    const learn = ["A", "B", "C"].flatMap((c) => [
      ev(0, `${c}:map_to_name`),
      ev(0, `${c}:map_to_name`),
    ]);
    const s = computeStreak(scheduler, learn, BASE + 40 * DAY, 4);
    const firstDue = s.days.findIndex((d, i) => i > 0 && d.due > 0);
    expect(firstDue).toBeGreaterThan(0);
    // Review only one of the due cards that day: not counted.
    const partial = [...learn, ev(firstDue, "A:map_to_name")];
    const p = computeStreak(scheduler, partial, BASE + 40 * DAY, 4);
    expect(p.days[firstDue]?.counted).toBe(false);
    // Thirty reviews count even when due cards remain.
    const many = [
      ...learn,
      ...Array.from({ length: 30 }, (_, i) => ev(firstDue, `X${i}:map_to_name`)),
    ];
    expect(computeStreak(scheduler, many, BASE + 40 * DAY, 4).days[firstDue]?.counted).toBe(true);
  });

  it("ignores drill and placement events, and records milestones", () => {
    const drill = [ev(0, "D:map_to_name", { scheduled: false })];
    expect(computeStreak(scheduler, drill, BASE, 4).current).toBe(0);
    const placement = [ev(0, "P:map_to_name", { mode: "placement" })];
    expect(computeStreak(scheduler, placement, BASE, 4).current).toBe(0);
    const week = computeStreak(scheduler, daily([0, 1, 2, 3, 4, 5, 6]), BASE + 7 * DAY, 4);
    expect(week.milestones.map((m) => m.days)).toEqual([7]);
  });
});
