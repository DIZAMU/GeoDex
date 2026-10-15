/**
 * Memory level 1 to 10 (PLAN.md 11.3): how much of a set of cards you hold right now.
 * level = 1 + 9 x the weighted share of cards remembered, where each card counts by how long
 * its memory holds. It falls when cards are forgotten; XP (xp.ts) is what only goes up.
 */
import { MASTERED_AFTER_DAYS } from "./estimate";
import type { CardState } from "./scheduler";

export const MAX_LEVEL = 10;

/** Card steps: not started, started, holds a week, holds three weeks, mastered. */
export type Step = 0 | 1 | 2 | 3 | 4;
export const STEP_WEIGHTS = [0, 0.2, 0.5, 0.8, 1] as const;
/** Stability in days at which a card reaches steps 2, 3 and 4. */
export const STEP_DAYS = [7, 21, MASTERED_AFTER_DAYS] as const;

export function stepOf(state: CardState | undefined): Step {
  if (!state || state.phase === "new") return 0;
  if (state.phase !== "review" || state.stability < STEP_DAYS[0]) return 1;
  if (state.stability < STEP_DAYS[1]) return 2;
  if (state.stability < STEP_DAYS[2]) return 3;
  return 4;
}

export type MemoryLevel = {
  level: number;
  /** Weighted share of the cards remembered, 0 to 1. */
  share: number;
  cards: number;
  /** Cards that must each move up one step to reach the next level; null at the top. */
  cardsToNext: number | null;
};

// Floating point sums of 0.2 and 0.3 land a hair under exact thresholds.
const EPSILON = 1e-9;

export function levelForShare(share: number): number {
  return Math.min(MAX_LEVEL, 1 + Math.floor(9 * share + EPSILON));
}

export function memoryLevel(states: readonly (CardState | undefined)[]): MemoryLevel {
  const steps = states.map(stepOf);
  const cards = steps.length;
  if (cards === 0) return { level: 1, share: 0, cards: 0, cardsToNext: null };
  const points = steps.reduce<number>((sum, s) => sum + STEP_WEIGHTS[s], 0);
  const share = points / cards;
  const level = levelForShare(share);
  if (level >= MAX_LEVEL) return { level, share, cards, cardsToNext: null };
  // The next level needs a share of level / 9. The fewest cards get there by taking the
  // biggest one-step gains first.
  const needed = (level / 9) * cards - points;
  const gains = steps
    .filter((s) => s < 4)
    .map((s) => STEP_WEIGHTS[(s + 1) as Step] - STEP_WEIGHTS[s])
    .sort((a, b) => b - a);
  let sum = 0;
  let count = 0;
  for (const gain of gains) {
    if (sum >= needed - EPSILON) break;
    sum += gain;
    count++;
  }
  return { level, share, cards, cardsToNext: Math.max(1, count) };
}
