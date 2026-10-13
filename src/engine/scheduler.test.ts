import { describe, expect, it } from "vitest";
import { createRng, shuffle } from "./random";
import { applyReview, createScheduler, replay, replayAll, retrievability } from "./scheduler";
import { DAY_MS, type Rating, type ReviewEventCore } from "./types";

const T0 = Date.UTC(2026, 0, 5, 8);
let n = 0;
function event(cardId: string, at: number, rating: Rating, scheduled = true): ReviewEventCore {
  n += 1;
  return {
    id: `e${String(n).padStart(4, "0")}`,
    cardId,
    reviewedAt: at,
    rating,
    mode: "mc",
    correct: rating > 1,
    chosenAnswer: null,
    responseMs: 3000,
    scheduled,
  };
}

function history(): ReviewEventCore[] {
  const rng = createRng("history");
  const events: ReviewEventCore[] = [];
  for (const card of ["NOR:map_to_name", "SWE:map_to_name", "FIN:name_to_map"]) {
    let at = T0;
    for (let i = 0; i < 12; i++) {
      at += Math.floor(rng() * 5 * DAY_MS) + 600_000;
      events.push(event(card, at, (1 + Math.floor(rng() * 4)) as Rating, rng() > 0.1));
    }
  }
  return events;
}

describe("replay", () => {
  const scheduler = createScheduler();

  it("gives identical state regardless of event arrival order", () => {
    const events = history();
    const inOrder = replayAll(scheduler, events);
    for (const seed of [1, 2, 3]) {
      const shuffled = replayAll(createScheduler(), shuffle(events, createRng(seed)));
      expect([...shuffled.entries()].sort()).toEqual([...inOrder.entries()].sort());
    }
  });

  it("matches applying reviews one at a time", () => {
    const events = history().filter((e) => e.cardId === "NOR:map_to_name");
    let incremental = null;
    for (const e of events) incremental = applyReview(scheduler, incremental, e);
    expect(replay(scheduler, "NOR:map_to_name", events)).toEqual(incremental);
  });

  it("ignores unscheduled events", () => {
    const scheduled = [event("X:map_to_name", T0, 3)];
    const withDrill = [...scheduled, event("X:map_to_name", T0 + 1000, 1, false)];
    expect(replay(scheduler, "X:map_to_name", withDrill)).toEqual(
      replay(scheduler, "X:map_to_name", scheduled),
    );
    expect(replay(scheduler, "Y:map_to_name", [event("Y:map_to_name", T0, 1, false)])).toBeNull();
  });

  it("moves a card through learning to review and lowers retrievability over time", () => {
    let state = applyReview(scheduler, null, event("Z:map_to_name", T0, 3));
    expect(state?.phase).toBe("learning");
    state = applyReview(scheduler, state, event("Z:map_to_name", T0 + 10 * 60_000, 3));
    expect(state?.phase).toBe("review");
    if (!state) throw new Error("state");
    expect(retrievability(scheduler, state, state.due)).toBeCloseTo(0.9, 1);
    expect(retrievability(scheduler, state, state.due + 30 * DAY_MS)).toBeLessThan(0.9);
  });

  it("uses the requested retention", () => {
    const events = [event("R:map_to_name", T0, 3), event("R:map_to_name", T0 + 600_000, 3)];
    const strict = replay(createScheduler({ requestRetention: 0.95 }), "R:map_to_name", events);
    const loose = replay(createScheduler({ requestRetention: 0.8 }), "R:map_to_name", events);
    expect(strict?.scheduledDays ?? 0).toBeLessThan(loose?.scheduledDays ?? 0);
  });

  it("seeds a correct placement answer in review, due in days rather than minutes", () => {
    const placed = { ...event("P:map_to_name", T0, 3), mode: "placement" as const };
    const state = applyReview(scheduler, null, placed);
    expect(state?.phase).toBe("review");
    expect((state?.due ?? 0) - T0).toBeGreaterThanOrEqual(2 * DAY_MS);
    expect((state?.due ?? 0) - T0).toBeLessThanOrEqual(5 * DAY_MS);
    // Later reviews of that card use the normal scheduler.
    const next = applyReview(scheduler, state, event("P:map_to_name", state?.due ?? T0, 1));
    expect(next?.phase).toBe("relearning");
    // A daily-session answer on a new card still starts with the short learning step.
    expect(applyReview(scheduler, null, event("Q:map_to_name", T0, 3))?.phase).toBe("learning");
  });
});
