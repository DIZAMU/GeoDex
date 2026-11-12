/**
 * Groups of countries (docs/DECISIONS.md 034): which cards a group has, when it starts, how a
 * set of taps is graded, and wrong answers for its questions. Pure.
 */
import { createRng, type Rng, shuffle } from "./random";
import { GROUP_CARD_TYPES, type GroupCardType, type Rating } from "./types";

/** Groups larger than this skip "tap every member": too many taps to be a fair card. */
export const MAX_TAP_MEMBERS = 13;

export function groupCardTypes(memberCount: number): GroupCardType[] {
  return GROUP_CARD_TYPES.filter((t) => t !== "group_to_map" || memberCount <= MAX_TAP_MEMBERS);
}

/** A group starts once at least half its members (in scope) are introduced. */
export function groupReady(introducedMembers: number, members: number): boolean {
  return members > 0 && introducedMembers >= Math.ceil(members / 2);
}

/** An empire starts once a third of the countries it covers are introduced, at least one. */
export function empireReady(introduced: number, covered: number): boolean {
  return covered > 0 && introduced >= Math.max(1, Math.ceil(covered / 3));
}

export type TapResult = {
  /** Members not tapped. */
  missed: string[];
  /** Taps on countries outside the group. "Sometimes" members are neither right nor wrong. */
  wrong: string[];
  rating: Rating;
  correct: boolean;
};

/** No misses and no wrong taps is Good, one slip is Hard, more is Again. */
export function gradeTaps(
  members: readonly string[],
  sometimes: readonly string[],
  tapped: Iterable<string>,
): TapResult {
  const picked = new Set(tapped);
  const missed = members.filter((id) => !picked.has(id));
  const wrong = [...picked].filter((id) => !members.includes(id) && !sometimes.includes(id));
  const errors = missed.length + wrong.length;
  const rating: Rating = errors === 0 ? 3 : errors === 1 ? 2 : 1;
  return { missed, wrong: wrong.sort(), rating, correct: errors <= 1 };
}

/**
 * Picks `count` ids from preference pools in order (each pool shuffled), skipping excluded
 * ids and repeats. Used for wrong answers: near ones first, then the rest of the world.
 */
export function pickFromPools(
  pools: readonly (readonly string[])[],
  exclude: ReadonlySet<string>,
  count: number,
  rng: Rng,
): string[] {
  const out: string[] = [];
  const seen = new Set(exclude);
  for (const pool of pools) {
    for (const id of shuffle(pool, rng)) {
      if (out.length >= count) return out;
      if (seen.has(id)) continue;
      seen.add(id);
      out.push(id);
    }
  }
  return out;
}

/** The member a "which of these is in X" review asks for: rotates with the seed. */
export function pickMember(members: readonly string[], seed: string): string {
  const rng = createRng(seed);
  return members[Math.floor(rng() * members.length)] ?? members[0] ?? "";
}

export type GroupFacts = { id: string; members: readonly string[] };

/**
 * Other groups as wrong names for a highlighted group: overlapping groups first (Scandinavia
 * for the Nordic countries), then groups on the same continents, then any.
 */
export function groupNameDistractors(
  group: GroupFacts,
  groups: readonly GroupFacts[],
  continentOf: (countryId: string) => string | undefined,
  count: number,
  rng: Rng,
): string[] {
  const own = new Set(group.members);
  const continents = new Set(group.members.map(continentOf));
  const others = groups.filter((g) => g.id !== group.id);
  const overlapping = others.filter((g) => g.members.some((m) => own.has(m))).map((g) => g.id);
  const sameContinent = others
    .filter((g) => g.members.some((m) => continents.has(continentOf(m))))
    .map((g) => g.id);
  return pickFromPools(
    [overlapping, sameContinent, others.map((g) => g.id)],
    new Set([group.id]),
    count,
    rng,
  );
}
