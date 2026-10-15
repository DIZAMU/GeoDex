import { describe, expect, it } from "vitest";
import { DAY_MS } from "./types";
import {
  computeXp,
  goalToday,
  MILESTONES,
  RANK_FROM,
  RANKS,
  rankOf,
  type XpEvent,
  xpForLevel,
  xpLevel,
} from "./xp";

// Noon local time keeps every event inside one learning day (day starts at 04:00).
const T0 = new Date(2026, 0, 5, 12).getTime();
const options = { dayStartHour: 4, dailyGoalMinutes: 10 };

function ev(
  at: number,
  cardId = "NOR:map_to_name",
  correct = true,
  mode: XpEvent["mode"] = "mc",
  durationMs = 10_000,
): XpEvent {
  return { cardId, reviewedAt: at, correct, mode, durationMs };
}

describe("computeXp", () => {
  it("is zero with no events", () => {
    expect(computeXp([], options).total).toBe(0);
  });

  it("pays more for typed and map answers than multiple choice, nothing for misses", () => {
    const xp = computeXp(
      [
        ev(T0, "A:x", true, "mc"),
        ev(T0 + 1000, "B:x", true, "typed"),
        ev(T0 + 2000, "C:x", true, "map"),
        ev(T0 + 3000, "D:x", false, "typed"),
      ],
      options,
    );
    expect(xp.answers).toBe(10 + 15 + 15);
  });

  it("pays a session bonus scaled by length, from five answers", () => {
    const four = Array.from({ length: 4 }, (_, i) => ev(T0 + i * 1000, `C${i}:x`));
    expect(computeXp(four, options).sessions).toBe(0);
    const ten = Array.from({ length: 10 }, (_, i) => ev(T0 + i * 1000, `C${i}:x`));
    expect(computeXp(ten, options).sessions).toBe(20);
    // A long gap splits one run into two short sessions.
    const split = [...four, ...four.map((e) => ({ ...e, reviewedAt: e.reviewedAt + 3600_000 }))];
    expect(computeXp(split, options).sessions).toBe(0);
  });

  it("pays each study day, and the daily goal when met", () => {
    const short = computeXp([ev(T0)], options);
    expect(short.days).toBe(10);
    expect(short.goals).toBe(0);
    const goal = computeXp([ev(T0, "A:x", true, "mc", 11 * 60_000)], options);
    expect(goal.goals).toBe(40);
    const twoDays = computeXp([ev(T0), ev(T0 + DAY_MS)], options);
    expect(twoDays.days).toBe(20);
  });

  it("pays each memory milestone once per card", () => {
    const xp = computeXp(
      [
        ev(T0),
        ev(T0 + 8 * DAY_MS),
        // Holding a week again pays nothing new.
        ev(T0 + 16 * DAY_MS),
        // A miss after a long gap pays nothing.
        ev(T0 + 100 * DAY_MS, "NOR:map_to_name", false),
        ev(T0 + 101 * DAY_MS),
      ],
      options,
    );
    expect(xp.milestones).toBe(MILESTONES[0].xp);
    const jump = computeXp([ev(T0), ev(T0 + 70 * DAY_MS)], options);
    expect(jump.milestones).toBe(MILESTONES.reduce((sum, m) => sum + m.xp, 0));
  });

  it("gives placement answers answer XP only", () => {
    const xp = computeXp(
      Array.from({ length: 6 }, (_, i) => ev(T0 + i, `P${i}:x`, true, "placement")),
      options,
    );
    expect(xp.answers).toBe(30);
    expect(xp.sessions + xp.days + xp.goals).toBe(0);
  });

  it("only goes up as events are added", () => {
    const events = Array.from({ length: 40 }, (_, i) =>
      ev(T0 + i * 7 * 3600_000, `C${i % 6}:x`, i % 3 !== 0, i % 2 ? "typed" : "mc", 90_000),
    );
    let last = 0;
    for (let n = 0; n <= events.length; n++) {
      const total = computeXp(events.slice(0, n), options).total;
      expect(total).toBeGreaterThanOrEqual(last);
      last = total;
    }
  });

  it("does not depend on event order", () => {
    const events = [ev(T0), ev(T0 + 8 * DAY_MS), ev(T0 + 500, "B:x")];
    expect(computeXp([...events].reverse(), options)).toEqual(computeXp(events, options));
  });
});

describe("goalToday", () => {
  it("sums today's study time, not placement or other days", () => {
    const g = goalToday(
      [
        ev(T0, "A:x", true, "mc", 6 * 60_000),
        ev(T0 + 1, "B:x", true, "placement", 60 * 60_000),
        ev(T0 - DAY_MS, "C:x", true, "mc", 60 * 60_000),
      ],
      T0 + 1000,
      options,
    );
    expect(g.minutes).toBeCloseTo(6);
    expect(g.done).toBe(false);
  });
});

describe("xpLevel and ranks", () => {
  it("grows level sizes", () => {
    expect([1, 2, 3, 4, 5].map(xpForLevel)).toEqual([0, 100, 300, 600, 1000]);
    expect(xpLevel(0)).toMatchObject({ level: 1, into: 0, span: 100, rank: "tourist" });
    expect(xpLevel(99).level).toBe(1);
    expect(xpLevel(100)).toMatchObject({ level: 2, into: 0, span: 200 });
    expect(xpLevel(1050)).toMatchObject({ level: 5, into: 50, rank: "explorer" });
  });

  it("names a rank for every level, in order", () => {
    expect(RANK_FROM).toHaveLength(RANKS.length);
    RANKS.forEach((rank, i) => {
      expect(rankOf(RANK_FROM[i] ?? 1)).toBe(rank);
    });
    expect(rankOf(99)).toBe("atlasKeeper");
  });
});
