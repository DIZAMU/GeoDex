import { describe, expect, it } from "vitest";
import type { CardState } from "./scheduler";
import { activity, forecast, leeches, recognitionOnly, retention, skillGrid } from "./stats";
import type { Rating, ReviewEventCore } from "./types";

const DAY = 86_400_000;
const NOW = new Date(2026, 5, 15, 12).getTime();
let n = 0;
const ev = (
  cardId: string,
  daysAgo: number,
  correct = true,
  opts: Partial<ReviewEventCore> = {},
): ReviewEventCore => {
  n += 1;
  return {
    id: `s${String(n).padStart(5, "0")}`,
    cardId,
    reviewedAt: NOW - daysAgo * DAY + n,
    rating: (correct ? 3 : 1) as Rating,
    mode: "mc",
    correct,
    chosenAnswer: null,
    responseMs: 2000,
    scheduled: true,
    ...opts,
  };
};
const state = (cardId: string, over: Partial<CardState>): CardState => ({
  cardId,
  phase: "review",
  due: NOW,
  stability: 30,
  difficulty: 5,
  elapsedDays: 0,
  scheduledDays: 0,
  learningSteps: 0,
  reps: 3,
  lapses: 0,
  lastReview: NOW - DAY,
  ...over,
});

describe("stats", () => {
  it("counts daily activity for the last year, ignoring drill and placement", () => {
    const days = activity(
      [
        ev("A:map_to_name", 0),
        ev("A:map_to_name", 0),
        ev("B:map_to_name", 3),
        ev("C:x", 1, true, { scheduled: false }),
        ev("D:x", 1, true, { mode: "placement" }),
      ],
      NOW,
      4,
    );
    expect(days).toHaveLength(365);
    expect(days.at(-1)?.count).toBe(2);
    expect(days.at(-4)?.count).toBe(1);
    expect(days.at(-2)?.count).toBe(0);
  });

  it("measures retention only on cards seen before", () => {
    const rows = retention(
      [
        ev("A:map_to_name", 5),
        ev("A:map_to_name", 1, false),
        ev("A:map_to_name", 0),
        ev("B:map_to_name", 0, false),
      ],
      NOW,
      4,
    );
    expect(rows.at(-1)).toMatchObject({ total: 1, correct: 1 });
    expect(rows.at(-2)).toMatchObject({ total: 1, correct: 0 });
  });

  it("forecasts due cards per day with overdue cards today", () => {
    const f = forecast(
      [
        state("A", { due: NOW - 5 * DAY }),
        state("B", { due: NOW + 2 * DAY }),
        state("C", { phase: "new" }),
        state("D", { due: NOW + 90 * DAY }),
      ],
      NOW,
      4,
    );
    expect(f).toHaveLength(30);
    expect(f[0]?.count).toBe(1);
    expect(f[2]?.count).toBe(1);
    expect(f.reduce((s, d) => s + d.count, 0)).toBe(2);
  });

  it("fills the skill by continent grid", () => {
    const states = new Map([
      ["AAA:map_to_name", state("AAA:map_to_name", {})],
      ["AAA:name_to_map", state("AAA:name_to_map", { stability: 3 })],
    ]);
    const grid = skillGrid(
      [
        { id: "AAA", continent: "europe" },
        { id: "BBB", continent: "europe" },
      ],
      states,
    );
    expect(grid.get("location")?.get("europe")).toEqual({ total: 4, started: 2, mastered: 1 });
    expect(grid.get("flags")?.get("europe")).toEqual({ total: 4, started: 0, mastered: 0 });
  });

  it("lists leeches and recognition-only countries", () => {
    const states = new Map([
      ["AAA:map_to_name", state("AAA:map_to_name", { lapses: 7 })],
      ["BBB:map_to_name", state("BBB:map_to_name", {})],
      ["BBB:name_to_map", state("BBB:name_to_map", { stability: 20 })],
    ]);
    expect(leeches(states.values()).map((s) => s.cardId)).toEqual(["AAA:map_to_name"]);
    expect(recognitionOnly(states)).toEqual({ count: 1, of: 2, ids: ["AAA"] });
  });
});
