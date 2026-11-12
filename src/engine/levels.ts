/**
 * Memory level 1 to 10: how much of a set of cards you hold right now.
 * Each card counts by how long its memory holds, and the weighted share of cards remembered
 * sets the level on a curve: level = 1 + 9 x share^LEVEL_CURVE (docs/DECISIONS.md 044). The
 * first levels come within a few sessions; level 10 still needs every card mastered. It
 * falls when cards are forgotten; XP (xp.ts) is what only goes up.
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

/**
 * How steeply the first levels come. Linear (1) put level 2 at 11% of every card's points,
 * about 870 started cards with the countries alone; at 0.57 it is about 170, and the first
 * 40 answers or so are a third of the way there.
 */
export const LEVEL_CURVE = 0.57;

export type MemoryLevel = {
  level: number;
  /** Weighted share of the cards remembered, 0 to 1. */
  share: number;
  /** How far into the current level, 0 to 1 (1 at the top level). */
  within: number;
  cards: number;
  /** Cards that must each move up one step to reach the next level; null at the top. */
  cardsToNext: number | null;
};

// Floating point sums of 0.2 and 0.3 land a hair under exact thresholds.
const EPSILON = 1e-9;

/** Levels climbed so far as a continuous number, 0 to 9: the level is 1 + its whole part. */
function climbed(share: number): number {
  return 9 * Math.max(0, share) ** LEVEL_CURVE;
}

export function levelForShare(share: number): number {
  return Math.min(MAX_LEVEL, 1 + Math.floor(climbed(share) + EPSILON));
}

/** The weighted share a level starts at. */
export function shareForLevel(level: number): number {
  return ((Math.min(MAX_LEVEL, Math.max(1, level)) - 1) / 9) ** (1 / LEVEL_CURVE);
}

export function memoryLevel(states: readonly (CardState | undefined)[]): MemoryLevel {
  const steps = states.map(stepOf);
  const cards = steps.length;
  if (cards === 0) return { level: 1, share: 0, within: 0, cards: 0, cardsToNext: null };
  const points = steps.reduce<number>((sum, s) => sum + STEP_WEIGHTS[s], 0);
  const share = points / cards;
  const level = levelForShare(share);
  if (level >= MAX_LEVEL) return { level, share, within: 1, cards, cardsToNext: null };
  const within = Math.min(1, Math.max(0, climbed(share) - (level - 1)));
  // The fewest cards to the next level's share, taking the biggest one-step gains first.
  const needed = shareForLevel(level + 1) * cards - points;
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
  return { level, share, within, cards, cardsToNext: Math.max(1, count) };
}
