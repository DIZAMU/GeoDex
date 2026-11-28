import { describe, expect, it } from "vitest";
import { createScheduler } from "./scheduler";
import { computeStreak, FREEZE_EVERY, flameTier, freezeNotice, MAX_FREEZES } from "./streak";
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

  it("counts a day on which the daily goal was met, even with due cards left", () => {
    const learn = ["A", "B", "C"].flatMap((c) => [
      ev(0, `${c}:map_to_name`),
      ev(0, `${c}:map_to_name`),
    ]);
    const base = computeStreak(scheduler, learn, BASE + 40 * DAY, 4);
    const firstDue = base.days.findIndex((d, i) => i > 0 && d.due > 0);
    const partial = [...learn, ev(firstDue, "A:map_to_name")];
    const dayStart = base.days[firstDue]?.start ?? 0;
    const s = computeStreak(scheduler, partial, BASE + 40 * DAY, 4, new Set([dayStart]));
    expect(s.days[firstDue]?.counted).toBe(true);
    // A goal with no scheduled review that day still does not count.
    const empty = computeStreak(scheduler, learn, BASE + 40 * DAY, 4, new Set([dayStart]));
    expect(empty.days[firstDue]?.counted).toBe(false);
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

describe("flameTier", () => {
  it("changes colour at 1, 14, 30, 90, 180 and 365 days, and stays at the top after", () => {
    expect(flameTier(0)).toBe("none");
    expect(flameTier(1)).toBe("yellow");
    expect(flameTier(13)).toBe("yellow");
    expect(flameTier(14)).toBe("orange");
    expect(flameTier(30)).toBe("red");
    expect(flameTier(89)).toBe("red");
    expect(flameTier(90)).toBe("blue");
    expect(flameTier(180)).toBe("purple");
    expect(flameTier(364)).toBe("purple");
    expect(flameTier(365)).toBe("gold");
    expect(flameTier(1000)).toBe("gold");
  });
});

describe("freeze notices", () => {
  // A week in a row earns a freeze; day 7 is missed and uses it; days 8 and 9 count.
  const week = [0, 1, 2, 3, 4, 5, 6, 8, 9];
  const now = BASE + 9 * DAY;
  const s = computeStreak(scheduler, daily(week), now, 4);
  const earnedDay = s.days[6]?.start;
  const usedDay = s.days[7]?.start;

  it("records when each freeze was earned and used, and how far the next one is", () => {
    expect(s.freezeEvents).toEqual([
      { kind: "earned", day: earnedDay },
      { kind: "used", day: usedDay },
    ]);
    // Nine counted days in the run (the frozen day keeps it): the next freeze is at 14.
    expect(s.current).toBe(9);
    expect(s.nextFreezeIn).toBe(2 * FREEZE_EVERY - 9);
  });

  it("tells the learner a freeze was used, once", () => {
    const notice = freezeNotice(s, { usedThrough: null, firstSeen: false }, now);
    expect(notice).toEqual({ kind: "used", days: 1, left: 0, nextIn: 5, through: usedDay });
    expect(freezeNotice(s, { usedThrough: usedDay ?? null, firstSeen: true }, now)).toBeNull();
  });

  it("announces the first freeze earned, once, while it is news", () => {
    const fresh = computeStreak(scheduler, daily([0, 1, 2, 3, 4, 5, 6]), BASE + 7 * DAY, 4);
    expect(freezeNotice(fresh, { usedThrough: null, firstSeen: false }, BASE + 7 * DAY)).toEqual({
      kind: "first",
      nextIn: FREEZE_EVERY,
    });
    expect(freezeNotice(fresh, { usedThrough: null, firstSeen: true }, BASE + 7 * DAY)).toBeNull();
    // A month later the first freeze is history, not news.
    expect(
      freezeNotice(fresh, { usedThrough: null, firstSeen: false }, BASE + 37 * DAY),
    ).toBeNull();
  });

  it("stays quiet about freezes used more than a week ago", () => {
    expect(freezeNotice(s, { usedThrough: null, firstSeen: true }, now + 10 * DAY)).toBeNull();
  });

  it("has no next freeze to promise at the cap", () => {
    const full = computeStreak(
      scheduler,
      daily(Array.from({ length: 21 }, (_, i) => i)),
      BASE + 20 * DAY,
      4,
    );
    expect(full.freezes).toBe(MAX_FREEZES);
    expect(full.nextFreezeIn).toBeNull();
  });
});

describe("a restored streak", () => {
  it("sets the run on its day, and the next studied day adds one", () => {
    // Studied days 0 to 2, missed 3 to 5 (streak lost), set to 19 on day 6.
    const events = daily([0, 1, 2, 6]);
    const lost = computeStreak(scheduler, events, BASE + 6 * DAY, 4);
    expect(lost.current).toBe(1);
    const restore = { day: BASE + 6 * DAY, days: 19 };
    const today = computeStreak(scheduler, events, BASE + 6 * DAY, 4, new Set(), restore);
    expect(today.current).toBe(19);
    expect(today.longest).toBe(19);
    const next = computeStreak(
      scheduler,
      daily([0, 1, 2, 6, 7]),
      BASE + 7 * DAY,
      4,
      new Set(),
      restore,
    );
    expect(next.current).toBe(20);
  });

  it("holds even when set before studying that day", () => {
    const restore = { day: BASE + 6 * DAY, days: 19 };
    const s = computeStreak(scheduler, daily([0, 1, 2]), BASE + 6 * DAY, 4, new Set(), restore);
    expect(s.current).toBe(19);
  });
});
