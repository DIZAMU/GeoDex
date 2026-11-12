/** Confusion tracking. Derived from review events; nothing is stored. */
import { type CardId, DAY_MS, type ReviewEventCore } from "./types";

export const CONFUSION_WINDOW_DAYS = 90;
/** A pair confused this often gets its own contrast card. */
export const CONTRAST_THRESHOLD = 2;

export function pairKey(a: string, b: string): string {
  return a < b ? `${a}|${b}` : `${b}|${a}`;
}

export function contrastCardId(a: string, b: string): CardId {
  return `${pairKey(a, b)}:contrast`;
}

/**
 * Counts wrong answers per unordered pair (target, chosen) in the last 90 days.
 * `resolve` maps an event to [target entity, chosen entity], or null when the chosen
 * answer is not an entity (typed text far from any name).
 */
export function confusionScores(
  events: readonly ReviewEventCore[],
  now: number,
  resolve: (event: ReviewEventCore) => [string, string] | null,
): Map<string, number> {
  const since = now - CONFUSION_WINDOW_DAYS * DAY_MS;
  const scores = new Map<string, number>();
  for (const event of events) {
    if (event.correct || event.reviewedAt < since || event.chosenAnswer === null) continue;
    const pair = resolve(event);
    if (!pair || pair[0] === pair[1]) continue;
    const key = pairKey(pair[0], pair[1]);
    scores.set(key, (scores.get(key) ?? 0) + 1);
  }
  return scores;
}

/** Contrast cards earned so far, in a stable order. */
export function contrastCards(scores: ReadonlyMap<string, number>): CardId[] {
  return [...scores]
    .filter(([, score]) => score >= CONTRAST_THRESHOLD)
    .map(([key]) => `${key}:contrast`)
    .sort();
}

/** Entities the learner confused with this one, most confused first. */
export function confusionsFor(entityId: string, scores: ReadonlyMap<string, number>): string[] {
  return [...scores]
    .flatMap(([key, score]) => {
      const [a, b] = key.split("|");
      if (a === entityId && b) return [{ id: b, score }];
      if (b === entityId && a) return [{ id: a, score }];
      return [];
    })
    .sort((x, y) => y.score - x.score || x.id.localeCompare(y.id))
    .map((x) => x.id);
}
