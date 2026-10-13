/** Seeded randomness. Everything that varies between runs takes a seed derived from data. */

/** 32-bit FNV-1a hash of a string. */
export function hashString(text: string): number {
  let hash = 0x811c9dc5;
  for (let i = 0; i < text.length; i++) {
    hash ^= text.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }
  return hash >>> 0;
}

export type Rng = () => number;

/** Mulberry32: small, fast, good enough for picking items. Returns floats in [0, 1). */
export function createRng(seed: number | string): Rng {
  let state = typeof seed === "string" ? hashString(seed) : seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function shuffle<T>(items: readonly T[], rng: Rng): T[] {
  const result = [...items];
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [result[i], result[j]] = [result[j] as T, result[i] as T];
  }
  return result;
}

/** Picks one item with probability proportional to its weight. */
export function weightedPick<T>(items: readonly T[], weight: (item: T) => number, rng: Rng): T {
  const total = items.reduce((sum, item) => sum + Math.max(0, weight(item)), 0);
  if (items.length === 0) throw new Error("weightedPick on an empty list");
  if (total <= 0) return items[Math.floor(rng() * items.length)] as T;
  let roll = rng() * total;
  for (const item of items) {
    roll -= Math.max(0, weight(item));
    if (roll < 0) return item;
  }
  return items[items.length - 1] as T;
}
