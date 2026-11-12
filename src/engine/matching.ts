/**
 * Typed answer matching. Accepts names and aliases in both languages,
 * tolerates small typos, and rejects answers that are closer to a different entity.
 */

const LETTER_FOLDS: [RegExp, string][] = [
  [/æ/g, "ae"],
  [/ø/g, "o"],
  [/å/g, "aa"],
  [/ß/g, "ss"],
  [/œ/g, "oe"],
  [/ł/g, "l"],
  [/đ/g, "d"],
  [/ı/g, "i"],
];

/** Lowercase, fold Nordic letters, strip diacritics and punctuation, drop a leading "the". */
export function normalizeAnswer(text: string): string {
  let result = text.toLowerCase();
  for (const [pattern, replacement] of LETTER_FOLDS) result = result.replace(pattern, replacement);
  return result
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .replace(/['’ʻ`´.]/g, "")
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .trim()
    .replace(/^the /, "");
}

/** Optimal string alignment distance (Damerau-Levenshtein with adjacent transpositions). */
export function editDistance(a: string, b: string): number {
  if (a === b) return 0;
  const rows = a.length + 1;
  const cols = b.length + 1;
  const d: number[][] = Array.from({ length: rows }, (_, i) =>
    Array.from({ length: cols }, (_, j) => (i === 0 ? j : j === 0 ? i : 0)),
  );
  for (let i = 1; i < rows; i++) {
    for (let j = 1; j < cols; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      const row = d[i] as number[];
      const prev = d[i - 1] as number[];
      let best = Math.min(
        (prev[j] as number) + 1,
        (row[j - 1] as number) + 1,
        (prev[j - 1] as number) + cost,
      );
      if (i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) {
        best = Math.min(best, ((d[i - 2] as number[])[j - 2] as number) + 1);
      }
      row[j] = best;
    }
  }
  return (d[a.length] as number[])[b.length] as number;
}

/** Typos allowed for a name of this normalized length: 0 up to 4, 1 for 5 to 8, 2 from 9. */
export function typoThreshold(length: number): number {
  if (length <= 4) return 0;
  if (length <= 8) return 1;
  return 2;
}

/** Something that can be named: a country, a capital, a currency, a language. */
export type Answerable = { id: string; names: readonly string[] };

export type MatchResult =
  | { kind: "exact"; id: string; matched: string }
  | { kind: "typo"; id: string; matched: string; distance: number }
  | { kind: "wrong"; nearestId: string | null };

type Index = { id: string; name: string; normalized: string }[];

export function buildIndex(entities: readonly Answerable[]): Index {
  return entities.flatMap((entity) =>
    [...new Set(entity.names)].map((name) => ({
      id: entity.id,
      name,
      normalized: normalizeAnswer(name),
    })),
  );
}

/**
 * Matches typed input against the target's accepted names. Exact matches always win.
 * A typo is accepted only if the input is not also within the typo threshold of a name
 * belonging to another entity (Niger vs Nigeria, Austria vs Australia).
 */
export function matchAnswer(input: string, targetId: string, index: Index): MatchResult {
  const typed = normalizeAnswer(input);
  if (typed === "") return { kind: "wrong", nearestId: null };

  const exact = index.find((entry) => entry.normalized === typed);
  if (exact) {
    return exact.id === targetId
      ? { kind: "exact", id: targetId, matched: exact.name }
      : { kind: "wrong", nearestId: exact.id };
  }

  let bestTarget: { name: string; distance: number } | null = null;
  let otherWithinThreshold = false;
  for (const entry of index) {
    const distance = editDistance(typed, entry.normalized);
    if (distance > typoThreshold(entry.normalized.length)) continue;
    if (entry.id === targetId) {
      if (!bestTarget || distance < bestTarget.distance)
        bestTarget = { name: entry.name, distance };
    } else {
      otherWithinThreshold = true;
    }
  }
  if (bestTarget && !otherWithinThreshold) {
    return { kind: "typo", id: targetId, matched: bestTarget.name, distance: bestTarget.distance };
  }
  return { kind: "wrong", nearestId: resolveNearest(typed, index) };
}

/** Nearest entity within edit distance 2 of normalized input, for confusion tracking. */
export function resolveNearest(normalizedInput: string, index: Index): string | null {
  let best: { id: string; distance: number } | null = null;
  for (const entry of index) {
    const distance = editDistance(normalizedInput, entry.normalized);
    if (distance <= 2 && (!best || distance < best.distance)) best = { id: entry.id, distance };
  }
  return best?.id ?? null;
}
