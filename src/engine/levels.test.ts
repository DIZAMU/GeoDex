import { describe, expect, it } from "vitest";
import { levelForShare, MAX_LEVEL, memoryLevel, STEP_DAYS, stepOf } from "./levels";
import type { CardState } from "./scheduler";

function card(phase: CardState["phase"], stability = 0): CardState {
  return {
    cardId: `X${Math.random()}:map_to_name`,
    phase,
    due: 0,
    stability,
    difficulty: 5,
    elapsedDays: 0,
    scheduledDays: 0,
    learningSteps: 0,
    reps: 1,
    lapses: 0,
    lastReview: 0,
  };
}

describe("stepOf", () => {
  it("ramps by how long a memory holds", () => {
    expect(stepOf(undefined)).toBe(0);
    expect(stepOf(card("new"))).toBe(0);
    expect(stepOf(card("learning", 30))).toBe(1);
    expect(stepOf(card("relearning", 30))).toBe(1);
    expect(stepOf(card("review", 6.9))).toBe(1);
    expect(stepOf(card("review", STEP_DAYS[0]))).toBe(2);
    expect(stepOf(card("review", STEP_DAYS[1]))).toBe(3);
    expect(stepOf(card("review", STEP_DAYS[2]))).toBe(4);
  });
});

describe("memoryLevel", () => {
  it("is level 1 with nothing started and 10 with everything mastered", () => {
    expect(memoryLevel([undefined, undefined]).level).toBe(1);
    const all = memoryLevel([card("review", 100), card("review", 100)]);
    expect(all.level).toBe(MAX_LEVEL);
    expect(all.cardsToNext).toBeNull();
    expect(memoryLevel([]).level).toBe(1);
  });

  it("follows 1 + 9 x the weighted share", () => {
    // Shares 0.2, 0.5, 0.8: levels 2, 5, 8.
    expect(memoryLevel([card("learning")]).level).toBe(2);
    expect(memoryLevel([card("review", 7)]).level).toBe(5);
    expect(memoryLevel([card("review", 21)]).level).toBe(8);
    expect(levelForShare(1 / 9)).toBe(2);
    expect(levelForShare(0.999)).toBe(9);
  });

  it("falls when a card is forgotten", () => {
    const held = memoryLevel([card("review", 30), card("review", 30)]);
    const lapsed = memoryLevel([card("review", 30), card("relearning", 2)]);
    expect(lapsed.level).toBeLessThan(held.level);
  });

  it("counts the fewest cards to the next level, biggest gains first", () => {
    // 10 unstarted cards: share 0, level 1. Level 2 needs share 1/9, so 1.11 points:
    // six cards started (0.2 each) is the fewest single steps.
    const fresh = memoryLevel(Array.from({ length: 10 }, () => undefined));
    expect(fresh.cardsToNext).toBe(6);
    // Started cards gain 0.3 each by holding a week, so they come first.
    const mixed = memoryLevel([...Array.from({ length: 9 }, () => card("learning")), undefined]);
    expect(mixed.level).toBe(2);
    // Level 3 needs 2.22 points from 1.8: two cards holding a week.
    expect(mixed.cardsToNext).toBe(2);
  });
});
