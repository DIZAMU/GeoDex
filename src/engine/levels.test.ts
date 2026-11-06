import { describe, expect, it } from "vitest";
import { levelForShare, MAX_LEVEL, memoryLevel, STEP_DAYS, shareForLevel, stepOf } from "./levels";
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

  it("follows 1 + 9 x the weighted share on a curve", () => {
    // Every card started, holding a week, holding three weeks: levels 4, 7, 8.
    expect(memoryLevel([card("learning")]).level).toBe(4);
    expect(memoryLevel([card("review", 7)]).level).toBe(7);
    expect(memoryLevel([card("review", 21)]).level).toBe(8);
    expect(levelForShare(0.999)).toBe(9);
    // Each level starts exactly at its share.
    for (let level = 1; level <= MAX_LEVEL; level++) {
      expect(levelForShare(shareForLevel(level))).toBe(level);
      if (level > 1) expect(levelForShare(shareForLevel(level) - 1e-6)).toBe(level - 1);
    }
  });

  it("makes the first level quick: 25 cards started of 1,560 is about a third of the way", () => {
    // About 40 answers start 25 country cards; the countries alone are 1,560 cards.
    const states = Array.from({ length: 1560 }, (_, i) => (i < 25 ? card("learning") : undefined));
    const m = memoryLevel(states);
    expect(m.level).toBe(1);
    expect(m.within).toBeGreaterThan(0.3);
    expect(m.within).toBeLessThan(0.4);
  });

  it("puts progress within the level at 0 to 1, and 1 at the top", () => {
    expect(memoryLevel([undefined]).within).toBe(0);
    expect(memoryLevel([card("review", 100)]).within).toBe(1);
  });

  it("falls when a card is forgotten", () => {
    const held = memoryLevel([card("review", 30), card("review", 30)]);
    const lapsed = memoryLevel([card("review", 30), card("relearning", 2)]);
    expect(lapsed.level).toBeLessThan(held.level);
  });

  it("counts the fewest cards to the next level, biggest gains first", () => {
    // 100 unstarted cards: level 2 needs a share of (1/9)^(1/0.57), 2.13 points: eleven
    // cards started (0.2 each) is the fewest single steps.
    const fresh = memoryLevel(Array.from({ length: 100 }, () => undefined));
    expect(fresh.level).toBe(1);
    expect(fresh.cardsToNext).toBe(11);
    // Started cards gain 0.3 each by holding a week, so they come first. 20 started of 100
    // is level 2; level 3 needs 7.15 points from 4: eleven of them holding a week.
    const mixed = memoryLevel([
      ...Array.from({ length: 20 }, () => card("learning")),
      ...Array.from({ length: 80 }, () => undefined),
    ]);
    expect(mixed.level).toBe(2);
    expect(mixed.cardsToNext).toBe(11);
  });
});
