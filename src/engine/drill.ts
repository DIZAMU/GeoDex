/**
 * Drill mode (PLAN.md 6.12): free practice on a region or a confused pair. The answers are
 * logged with `scheduled: false`, so drill never touches scheduling or the streak.
 */
import { createRng, shuffle } from "./random";
import type { CardState } from "./scheduler";
import type { QueueItem } from "./session";
import { type CardId, parseCardId } from "./types";

export const DRILL_SIZE = 20;

export type DrillTarget =
  | { kind: "region"; subregion: string }
  | { kind: "pair"; a: string; b: string };

const LOCATION = ["map_to_name", "name_to_map"] as const;

export function drillQueue(input: {
  target: DrillTarget;
  countries: readonly { id: string; subregion: string }[];
  states: ReadonlyMap<CardId, CardState>;
  seed: string;
  size?: number;
}): QueueItem[] {
  const { target, countries, states } = input;
  const subregionOf = new Map(countries.map((c) => [c.id, c.subregion]));
  if (target.kind === "region") {
    const ids = countries.filter((c) => c.subregion === target.subregion).map((c) => c.id);
    const studied = [...states.values()]
      .filter((s) => s.phase !== "new" && ids.includes(parseCardId(s.cardId).entityId))
      .map((s) => s.cardId);
    // Studied cards come first; location cards for every country fill the rest, so a
    // region barely started still gives a full drill.
    const fill = ids
      .flatMap((id) => LOCATION.map((t) => `${id}:${t}`))
      .filter((id) => !studied.includes(id));
    const rng = createRng(input.seed);
    return arrange([...shuffle(studied, rng), ...shuffle(fill, rng)]);
  }
  const pair = [target.a, target.b];
  const contrast = `${[...pair].sort().join("|")}:contrast`;
  const cards = [
    ...pair.flatMap((id) => [...LOCATION, "flag_to_name"].map((t) => `${id}:${t}`)),
    ...(states.has(contrast) ? [contrast] : []),
  ];
  return arrange(shuffle(cards, createRng(input.seed)));

  function arrange(ordered: CardId[]): QueueItem[] {
    const items = ordered.slice(0, input.size ?? DRILL_SIZE).map((cardId) => {
      const { entityId } = parseCardId(cardId);
      const first = entityId.split("|")[0] ?? entityId;
      return { cardId, entityId, subregion: subregionOf.get(first) ?? "", isNew: false };
    });
    return interleave(items);
  }
}

/**
 * Orders items so the same entity never comes twice in a row when any order allows it:
 * always take from the entity with the most items left, other than the previous one.
 */
export function interleave(items: readonly QueueItem[]): QueueItem[] {
  const groups = new Map<string, QueueItem[]>();
  for (const item of items) groups.set(item.entityId, [...(groups.get(item.entityId) ?? []), item]);
  const out: QueueItem[] = [];
  let previous: string | null = null;
  while (out.length < items.length) {
    const ranked = [...groups.entries()]
      .filter(([, list]) => list.length > 0)
      .sort((a, b) => b[1].length - a[1].length);
    const pick = ranked.find(([id]) => id !== previous) ?? ranked[0];
    if (!pick) break;
    const next = pick[1].shift() as QueueItem;
    out.push(next);
    previous = pick[0];
  }
  return out;
}
